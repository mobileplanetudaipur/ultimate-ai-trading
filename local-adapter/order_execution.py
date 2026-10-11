"""Explicitly confirmed market-order execution through the signed-in MT5 terminal."""

from __future__ import annotations

import hashlib
import json
import math
import re
import secrets
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

MAX_RISK_PER_ORDER_PERCENT = 0.20
MAX_DAILY_LOSS_PERCENT = 1.00
MAX_SESSION_DRAWDOWN_PERCENT = 5.00
MAX_DAILY_ENTRIES = 8
MAX_OPEN_POSITIONS_AND_ORDERS = 3
MAX_TICK_AGE_MS = 15_000
CONFIRMATION_LIFETIME_SECONDS = 60
LIVE_RELEASE_APPROVED = False


class OrderExecutionError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _integer(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        return int(value)
    except (TypeError, ValueError, OverflowError):
        return None


class MT5OrderExecutor:
    """Two-stage order boundary; prepare calls order_check, submit calls order_send once."""

    def __init__(self, mt5_api: Any, ledger_path: str | Path):
        self.mt5 = mt5_api
        self.ledger_path = Path(ledger_path)
        self.ledger_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._confirmations: dict[str, dict[str, Any]] = {}
        with self._db() as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS broker_orders ("
                "client_order_id TEXT PRIMARY KEY, broker_comment TEXT NOT NULL UNIQUE, "
                "account_key TEXT NOT NULL, state TEXT NOT NULL, payload_hash TEXT NOT NULL, "
                "result_json TEXT, created_at_utc TEXT NOT NULL)"
            )
            db.execute(
                "CREATE TABLE IF NOT EXISTS session_baselines ("
                "account_key TEXT PRIMARY KEY, equity REAL NOT NULL, created_at_utc TEXT NOT NULL)"
            )

    @contextmanager
    def _db(self):
        db = sqlite3.connect(self.ledger_path, timeout=5)
        try:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("PRAGMA synchronous=FULL")
            with db:
                yield db
        finally:
            db.close()

    def account_context(self, require_trade_permissions: bool = True) -> tuple[Any, Any, str, str]:
        terminal = self.mt5.terminal_info()
        account = self.mt5.account_info()
        if terminal is None or account is None or not bool(getattr(terminal, "connected", False)):
            raise OrderExecutionError("TERMINAL_UNAVAILABLE", "The signed-in MT5 terminal is disconnected.")
        company = str(getattr(account, "company", ""))
        server = str(getattr(account, "server", ""))
        if "xm" not in company.casefold() or "xm" not in server.casefold():
            raise OrderExecutionError("UNVERIFIED_BROKER", "Order submission is restricted to a verified XM account.")
        mode = {0: "DEMO", 2: "LIVE"}.get(int(getattr(account, "trade_mode", -1)))
        if mode is None:
            raise OrderExecutionError("UNSUPPORTED_ACCOUNT_MODE", "This MT5 account mode is not supported.")
        if require_trade_permissions and (
            bool(getattr(terminal, "tradeapi_disabled", True))
            or not bool(getattr(terminal, "trade_allowed", False))
        ):
            raise OrderExecutionError("TERMINAL_TRADING_DISABLED", "Enable algorithmic trading in MT5 before requesting an order.")
        if require_trade_permissions and (
            not bool(getattr(account, "trade_allowed", False))
            or not bool(getattr(account, "trade_expert", False))
        ):
            raise OrderExecutionError("ACCOUNT_TRADING_DISABLED", "XM account permissions do not allow this order.")
        login = str(getattr(account, "login", ""))
        if not login:
            raise OrderExecutionError("ACCOUNT_ID_UNAVAILABLE", "MT5 did not provide a verified account identity.")
        account_key = hashlib.sha256(
            f"{company}|{server}|{login}|{getattr(account, 'currency', '')}".encode("utf-8")
        ).hexdigest()
        return terminal, account, mode, account_key

    def _daily_metrics(self, account: Any) -> tuple[int, float]:
        now = datetime.now(timezone.utc)
        start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
        deals = self.mt5.history_deals_get(start, now)
        if deals is None:
            raise OrderExecutionError("DEAL_HISTORY_UNAVAILABLE", "XM daily deal history is unavailable; no order can be prepared.")
        realized = 0.0
        entries = 0
        entry_types = {
            getattr(self.mt5, "DEAL_ENTRY_IN", 0),
            getattr(self.mt5, "DEAL_ENTRY_INOUT", 2),
        }
        for deal in deals:
            realized += sum(
                _number(getattr(deal, key, 0)) or 0.0
                for key in ("profit", "commission", "swap", "fee")
            )
            if getattr(deal, "entry", -1) in entry_types:
                entries += 1
        balance = _number(getattr(account, "balance", None))
        equity = _number(getattr(account, "equity", None))
        opening_balance = balance - realized if balance is not None else None
        if opening_balance is None or equity is None or opening_balance <= 0:
            raise OrderExecutionError("DAILY_BASELINE_UNAVAILABLE", "The XM daily loss baseline is unavailable.")
        loss_percent = max(0.0, (opening_balance - equity) / opening_balance * 100)
        return entries, loss_percent

    def _session_baseline(self, account_key: str, account: Any) -> float:
        with self._db() as db:
            row = db.execute(
                "SELECT equity FROM session_baselines WHERE account_key=?",
                (account_key,),
            ).fetchone()
            if row:
                return float(row[0])
            equity = _number(getattr(account, "equity", None))
            if equity is None or equity <= 0:
                raise OrderExecutionError("SESSION_BASELINE_UNAVAILABLE", "A positive XM equity baseline is required.")
            db.execute(
                "INSERT INTO session_baselines(account_key,equity,created_at_utc) VALUES(?,?,?)",
                (account_key, equity, datetime.now(timezone.utc).isoformat()),
            )
            return equity

    def _broker_volume(self, value: Any, info: Any) -> float:
        try:
            volume = Decimal(str(value))
            minimum = Decimal(str(info.volume_min))
            maximum = Decimal(str(info.volume_max))
            step = Decimal(str(info.volume_step))
        except (InvalidOperation, AttributeError, TypeError):
            raise OrderExecutionError("INVALID_VOLUME_RULES", "XM did not provide valid lot-size rules.")
        if not volume.is_finite() or min(minimum, maximum, step) <= 0:
            raise OrderExecutionError("INVALID_VOLUME", "Enter a finite positive lot size.")
        if volume < minimum or volume > maximum:
            raise OrderExecutionError("VOLUME_OUT_OF_RANGE", "Lot size is outside the current XM symbol limits.")
        steps = (volume - minimum) / step
        if steps != steps.to_integral_value():
            raise OrderExecutionError("VOLUME_STEP_MISMATCH", "Lot size does not match the current XM volume step.")
        return float(volume)

    def _validated_request(
        self,
        payload: dict[str, Any],
        account: Any,
        mode: str,
        account_key: str,
        broker_comment: str,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        required = {"client_order_id", "symbol", "side", "volume", "stop_loss", "take_profit"}
        if set(payload) != required:
            raise OrderExecutionError("INVALID_ORDER_REQUEST", "Order fields are invalid or incomplete.")
        client_id = payload.get("client_order_id")
        symbol = payload.get("symbol")
        side = payload.get("side")
        stop = _number(payload.get("stop_loss"))
        target = _number(payload.get("take_profit"))
        if not isinstance(client_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{16,64}", client_id):
            raise OrderExecutionError("INVALID_CLIENT_ORDER_ID", "A unique 16–64 character client order ID is required.")
        if not isinstance(symbol, str) or not symbol or len(symbol) > 64 or any(ord(char) < 32 for char in symbol):
            raise OrderExecutionError("INVALID_SYMBOL", "Select an exact symbol visible in the signed-in MT5 terminal.")
        if side not in {"BUY", "SELL"} or stop is None or target is None or stop <= 0 or target <= 0:
            raise OrderExecutionError("INVALID_ORDER_PRICES", "Side, stop loss, and take profit must be finite positive values.")

        info = self.mt5.symbol_info(symbol)
        if info is None or not bool(getattr(info, "visible", False)):
            raise OrderExecutionError("SYMBOL_NOT_VISIBLE", "The exact selected symbol is not visible in MT5 Market Watch.")
        trade_mode = int(getattr(info, "trade_mode", -1))
        if trade_mode != getattr(self.mt5, "SYMBOL_TRADE_MODE_FULL", 4):
            raise OrderExecutionError("SYMBOL_NOT_FULLY_TRADABLE", "XM does not currently allow full trading on this symbol.")
        volume = self._broker_volume(payload.get("volume"), info)
        tick = self.mt5.symbol_info_tick(symbol)
        bid, ask = _number(getattr(tick, "bid", None)), _number(getattr(tick, "ask", None))
        tick_ms = int(getattr(tick, "time_msc", 0) or 0) if tick is not None else 0
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        age_ms = now_ms - tick_ms
        if bid is None or ask is None or bid <= 0 or ask < bid or age_ms < 0 or age_ms > MAX_TICK_AGE_MS:
            raise OrderExecutionError("QUOTE_NOT_FRESH", "The exact XM symbol quote is invalid or older than 15 seconds.")

        point = _number(getattr(info, "point", None))
        digits = int(getattr(info, "digits", 0))
        stops_level = int(getattr(info, "trade_stops_level", 0))
        equity = _number(getattr(account, "equity", None))
        free_margin = _number(getattr(account, "margin_free", None))
        if point is None or point <= 0 or digits < 1 or equity is None or equity <= 0 or free_margin is None:
            raise OrderExecutionError("ACCOUNT_OR_SYMBOL_DATA_INVALID", "MT5 account or symbol risk data is incomplete.")

        entry = ask if side == "BUY" else bid
        minimum_distance = max(0, stops_level) * point
        if side == "BUY":
            if stop >= bid or target <= ask or bid - stop < minimum_distance or target - ask < minimum_distance:
                raise OrderExecutionError("INVALID_BUY_PROTECTION", "Buy stop loss or take profit violates XM quote/stop-distance rules.")
            order_type = self.mt5.ORDER_TYPE_BUY
        else:
            if stop <= ask or target >= bid or stop - ask < minimum_distance or bid - target < minimum_distance:
                raise OrderExecutionError("INVALID_SELL_PROTECTION", "Sell stop loss or take profit violates XM quote/stop-distance rules.")
            order_type = self.mt5.ORDER_TYPE_SELL

        potential_loss = _number(self.mt5.order_calc_profit(order_type, symbol, volume, entry, stop))
        risk_limit = equity * MAX_RISK_PER_ORDER_PERCENT / 100
        if potential_loss is None or potential_loss >= 0 or abs(potential_loss) > risk_limit + 0.01:
            raise OrderExecutionError(
                "RISK_LIMIT_EXCEEDED",
                f"Potential stop loss must not exceed {MAX_RISK_PER_ORDER_PERCENT:.2f}% of current XM equity.",
            )
        margin = _number(self.mt5.order_calc_margin(order_type, symbol, volume, entry))
        if margin is None or margin < 0 or margin > free_margin * 0.8:
            raise OrderExecutionError("INSUFFICIENT_MARGIN", "XM margin calculation exceeds the 80% free-margin buffer.")

        positions = self.mt5.positions_get()
        pending_orders = self.mt5.orders_get()
        if positions is None or pending_orders is None:
            raise OrderExecutionError("BROKER_STATE_UNAVAILABLE", "XM positions/orders could not be reconciled; no order can be prepared.")
        if len(positions) + len(pending_orders) >= MAX_OPEN_POSITIONS_AND_ORDERS:
            raise OrderExecutionError("MAX_OPEN_POSITIONS", "The three-position/order limit is already reached.")
        if pending_orders:
            raise OrderExecutionError("PENDING_ORDERS_PRESENT", "Reconcile existing pending orders before placing another order.")
        for position in positions:
            if not _number(getattr(position, "sl", 0)):
                raise OrderExecutionError("UNPROTECTED_POSITION", "An existing position has no verified stop loss.")
            existing_info = self.mt5.symbol_info(str(getattr(position, "symbol", "")))
            if existing_info is None or not _number(getattr(existing_info, "trade_contract_size", None)):
                raise OrderExecutionError("POSITION_DATA_UNAVAILABLE", "An existing position has unknown contract data.")

        entries, daily_loss = self._daily_metrics(account)
        if entries >= MAX_DAILY_ENTRIES:
            raise OrderExecutionError("DAILY_ENTRY_LIMIT", "The eight-entry UTC daily limit has been reached.")
        if daily_loss >= MAX_DAILY_LOSS_PERCENT:
            raise OrderExecutionError("DAILY_LOSS_LIMIT", "The one-percent daily loss limit has been reached.")
        baseline = self._session_baseline(account_key, account)
        if (baseline - equity) / baseline * 100 >= MAX_SESSION_DRAWDOWN_PERCENT:
            raise OrderExecutionError("SESSION_DRAWDOWN_LIMIT", "The five-percent session drawdown limit has been reached.")

        filling_flags = int(getattr(info, "filling_mode", 0))
        if filling_flags & 2:
            filling = self.mt5.ORDER_FILLING_IOC
        elif filling_flags & 1:
            filling = self.mt5.ORDER_FILLING_FOK
        elif int(getattr(info, "trade_exemode", -1)) != getattr(self.mt5, "SYMBOL_TRADE_EXECUTION_MARKET", 2):
            filling = self.mt5.ORDER_FILLING_RETURN
        else:
            raise OrderExecutionError("FILLING_POLICY_UNKNOWN", "XM reported no supported market-order fill policy.")

        request = {
            "action": self.mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": volume,
            "type": order_type,
            "price": round(entry, digits),
            "sl": round(stop, digits),
            "tp": round(target, digits),
            "deviation": 20,
            "magic": 261011,
            "comment": broker_comment,
            "type_time": self.mt5.ORDER_TIME_GTC,
            "type_filling": filling,
        }
        check = self.mt5.order_check(request)
        check_retcode = getattr(check, "retcode", None) if check is not None else None
        if check is None or isinstance(check_retcode, bool) or check_retcode != 0:
            raise OrderExecutionError("BROKER_PREFLIGHT_REJECTED", "MT5 order_check rejected or could not validate this request.")

        details = {
            "client_order_id": client_id,
            "account_mode": mode,
            "symbol": symbol,
            "side": side,
            "volume": volume,
            "quoted_price": request["price"],
            "stop_loss": request["sl"],
            "take_profit": request["tp"],
            "potential_loss_account_currency": round(abs(potential_loss), 2),
            "risk_limit_percent": MAX_RISK_PER_ORDER_PERCENT,
            "estimated_margin_account_currency": round(margin, 2),
            "free_margin_account_currency": round(free_margin, 2),
            "account_currency": str(account.currency),
            "broker_check": {
                "retcode": int(check.retcode),
                "comment": str(getattr(check, "comment", "")),
                "margin": _number(getattr(check, "margin", None)),
                "free_margin": _number(getattr(check, "margin_free", None)),
            },
            "quote_age_ms": age_ms,
        }
        return request, details

    def prepare_order(
        self,
        payload: Any,
        session_enabled: bool,
    ) -> dict[str, Any]:
        with self._lock:
            if not isinstance(payload, dict):
                raise OrderExecutionError("INVALID_ORDER_REQUEST", "A structured broker order is required.")
            _, account, mode, account_key = self.account_context()
            if mode == "LIVE" and not LIVE_RELEASE_APPROVED:
                raise OrderExecutionError("LIVE_RELEASE_NOT_APPROVED", "Live order submission is locked pending separate release approval.")
            if not session_enabled:
                raise OrderExecutionError("ORDER_SUBMISSION_LOCKED", "Enable order submission for this verified account and app session before preparing an order.")
            unresolved = self.unresolved_orders(account_key)
            if unresolved:
                raise OrderExecutionError(
                    "ORDER_RECOVERY_REQUIRED",
                    "A previous order has an unknown or interrupted result. Reconcile it in MT5 before preparing another order.",
                )
            client_id = payload.get("client_order_id")
            if not isinstance(client_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{16,64}", client_id):
                raise OrderExecutionError("INVALID_CLIENT_ORDER_ID", "A unique 16–64 character client order ID is required.")
            with self._db() as db:
                prior = db.execute(
                    "SELECT state FROM broker_orders WHERE client_order_id=?",
                    (client_id,),
                ).fetchone()
            if prior:
                raise OrderExecutionError(
                    "ORDER_ID_ALREADY_USED",
                    f"Order ID already has broker state {prior[0]}; reconcile it instead of submitting again.",
                )
            broker_comment = "UAT-" + hashlib.sha256(client_id.encode()).hexdigest()[:20]
            request, details = self._validated_request(payload, account, mode, account_key, broker_comment)
            confirmation_id = secrets.token_urlsafe(32)
            now = datetime.now(timezone.utc)
            expires = now + timedelta(seconds=CONFIRMATION_LIFETIME_SECONDS)
            self._confirmations[confirmation_id] = {
                "payload": dict(payload),
                "request": request,
                "details": details,
                "account_key": account_key,
                "mode": mode,
                "expires_at": expires,
                "broker_comment": broker_comment,
            }
            self._expire_confirmations(now)
            return {
                "state": "ORDER_PREPARED",
                "confirmation_id": confirmation_id,
                "expires_at_utc": expires.isoformat(),
                "order_submission": False,
                **details,
            }

    def unresolved_orders(self, account_key: str) -> list[dict[str, str]]:
        with self._db() as db:
            rows = db.execute(
                "SELECT client_order_id, state, created_at_utc FROM broker_orders "
                "WHERE account_key=? AND state IN ('SUBMITTING','UNKNOWN') ORDER BY created_at_utc",
                (account_key,),
            ).fetchall()
        return [
            {"client_order_id": str(client_id), "state": str(state), "created_at_utc": str(created_at)}
            for client_id, state, created_at in rows
        ]

    def _expire_confirmations(self, now: datetime) -> None:
        self._confirmations = {
            key: value for key, value in self._confirmations.items()
            if value["expires_at"] > now
        }

    def clear_confirmations(self) -> None:
        with self._lock:
            self._confirmations.clear()

    @staticmethod
    def _broker_result(result: Any) -> dict[str, Any]:
        if result is None:
            return {"available": False}
        retcode = _integer(getattr(result, "retcode", None))
        return {
            "available": True,
            "response_complete": retcode is not None,
            "retcode": retcode,
            "comment": str(getattr(result, "comment", "")),
            "order_ticket": _integer(getattr(result, "order", 0)) or 0,
            "deal_ticket": _integer(getattr(result, "deal", 0)) or 0,
            "volume": _number(getattr(result, "volume", None)),
            "price": _number(getattr(result, "price", None)),
            "bid": _number(getattr(result, "bid", None)),
            "ask": _number(getattr(result, "ask", None)),
            "request_id": _integer(getattr(result, "request_id", 0)) or 0,
        }

    def submit_order(
        self,
        confirmation_id: Any,
        confirm_order: Any,
        confirm_live: Any,
        session_enabled: bool,
    ) -> dict[str, Any]:
        with self._lock:
            if not session_enabled:
                raise OrderExecutionError("ORDER_SUBMISSION_LOCKED", "Enable order submission for this verified account and app session first.")
            if confirm_order is not True:
                raise OrderExecutionError("ORDER_CONFIRMATION_REQUIRED", "Explicitly confirm the exact prepared order before submission.")
            now = datetime.now(timezone.utc)
            self._expire_confirmations(now)
            prepared = self._confirmations.get(confirmation_id) if isinstance(confirmation_id, str) else None
            if prepared is None:
                raise OrderExecutionError("CONFIRMATION_EXPIRED", "Order confirmation is missing or expired. Prepare and review the order again.")
            if prepared["mode"] == "LIVE":
                if not LIVE_RELEASE_APPROVED:
                    raise OrderExecutionError("LIVE_RELEASE_NOT_APPROVED", "Live order submission is locked pending separate release approval.")
                if confirm_live is not True:
                    raise OrderExecutionError("LIVE_CONFIRMATION_REQUIRED", "Explicit per-order live confirmation is required.")

            _, account, mode, account_key = self.account_context()
            if mode != prepared["mode"] or account_key != prepared["account_key"]:
                self._confirmations.pop(confirmation_id, None)
                raise OrderExecutionError("ACCOUNT_CHANGED", "The signed-in MT5 account changed after review. Prepare the order again.")

            request, details = self._validated_request(
                prepared["payload"],
                account,
                mode,
                account_key,
                prepared["broker_comment"],
            )
            if request != prepared["request"]:
                self._confirmations.pop(confirmation_id, None)
                raise OrderExecutionError("ORDER_REVIEW_CHANGED", "Market or broker terms changed after review. Re-validate the updated order.")

            payload_hash = hashlib.sha256(
                json.dumps(prepared["payload"], sort_keys=True, separators=(",", ":")).encode("utf-8")
            ).hexdigest()
            with self._db() as db:
                db.execute("BEGIN IMMEDIATE")
                unresolved = db.execute(
                    "SELECT client_order_id FROM broker_orders "
                    "WHERE account_key=? AND state IN ('SUBMITTING','UNKNOWN') LIMIT 1",
                    (account_key,),
                ).fetchone()
                if unresolved:
                    raise OrderExecutionError(
                        "ORDER_RECOVERY_REQUIRED",
                        "Another order is unresolved for this account. Reconcile it in MT5 before submitting.",
                    )
                _, account, mode, fresh_account_key = self.account_context()
                if mode != prepared["mode"] or fresh_account_key != prepared["account_key"]:
                    self._confirmations.pop(confirmation_id, None)
                    raise OrderExecutionError("ACCOUNT_CHANGED", "The signed-in MT5 account changed after review. Prepare the order again.")
                request, details = self._validated_request(
                    prepared["payload"],
                    account,
                    mode,
                    fresh_account_key,
                    prepared["broker_comment"],
                )
                if request != prepared["request"]:
                    self._confirmations.pop(confirmation_id, None)
                    raise OrderExecutionError("ORDER_REVIEW_CHANGED", "Market or broker terms changed after review. Re-validate the updated order.")
                db.execute(
                    "INSERT INTO broker_orders(client_order_id,broker_comment,account_key,state,payload_hash,created_at_utc) "
                    "VALUES(?,?,?,?,?,?)",
                    (
                        details["client_order_id"],
                        prepared["broker_comment"],
                        account_key,
                        "SUBMITTING",
                        payload_hash,
                        now.isoformat(),
                    ),
                )
            self._confirmations.pop(confirmation_id, None)

            try:
                result = self.mt5.order_send(request)
            except Exception:
                response = {
                    "state": "UNKNOWN",
                    "account_mode": mode,
                    "client_order_id": details["client_order_id"],
                    "symbol": details["symbol"],
                    "side": details["side"],
                    "requested_volume": details["volume"],
                    "order_submission": True,
                    "broker_result": {"available": False},
                    "message": "MT5 did not return a definitive result. Do not retry; reconcile the order in MT5.",
                    "created_at_utc": datetime.now(timezone.utc).isoformat(),
                    "duplicate_replay": False,
                }
                try:
                    self._save_result(details["client_order_id"], "UNKNOWN", response)
                except sqlite3.Error:
                    response["message"] += " The local order ledger could not be updated; reconcile in MT5 before any further action."
                return response

            try:
                broker = self._broker_result(result)
                retcode = broker["retcode"] if broker["available"] else None
                if (
                    broker.get("response_complete")
                    and retcode == getattr(self.mt5, "TRADE_RETCODE_DONE", 10009)
                    and broker["deal_ticket"] > 0
                ):
                    state = "FILLED"
                elif (
                    broker.get("response_complete")
                    and retcode == getattr(self.mt5, "TRADE_RETCODE_DONE_PARTIAL", 10010)
                    and broker["deal_ticket"] > 0
                ):
                    state = "PARTIALLY_FILLED"
                elif (
                    broker.get("response_complete")
                    and retcode == getattr(self.mt5, "TRADE_RETCODE_PLACED", 10008)
                    and broker["order_ticket"] > 0
                ):
                    state = "PLACED"
                elif broker.get("response_complete") and retcode not in {
                    getattr(self.mt5, "TRADE_RETCODE_DONE", 10009),
                    getattr(self.mt5, "TRADE_RETCODE_DONE_PARTIAL", 10010),
                    getattr(self.mt5, "TRADE_RETCODE_PLACED", 10008),
                }:
                    state = "REJECTED"
                else:
                    state = "UNKNOWN"
            except Exception:
                broker = {"available": False}
                state = "UNKNOWN"

            response = {
                "state": state,
                "account_mode": mode,
                "client_order_id": details["client_order_id"],
                "symbol": details["symbol"],
                "side": details["side"],
                "requested_volume": details["volume"],
                "order_submission": True,
                "broker_result": broker,
                "created_at_utc": datetime.now(timezone.utc).isoformat(),
                "duplicate_replay": False,
            }
            if state == "UNKNOWN":
                response["message"] = "MT5 did not return conclusive fill/order evidence. Do not retry; reconcile the order in MT5."
            try:
                self._save_result(details["client_order_id"], state, response)
            except sqlite3.Error:
                response["state"] = "UNKNOWN"
                response["message"] = "MT5 responded, but the local order ledger could not persist its result. Do not retry; reconcile the order in MT5."
            return response

    def _save_result(self, client_id: str, state: str, result: dict[str, Any] | None) -> None:
        with self._db() as db:
            db.execute(
                "UPDATE broker_orders SET state=?,result_json=? WHERE client_order_id=?",
                (
                    state,
                    json.dumps(result, allow_nan=False) if result is not None else None,
                    client_id,
                ),
            )
