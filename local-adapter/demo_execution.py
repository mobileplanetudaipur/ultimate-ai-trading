"""Fail-closed XM MT5 demo order execution boundary.

This module is intentionally isolated from the browser simulator. It accepts
only exact broker symbols and requires an already-authenticated XM demo MT5
terminal. It never accepts a password or chooses a symbol alias.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any

MAX_RISK_PER_TRADE = 0.20
MAX_DAILY_LOSS = 1.00
MAX_SESSION_DRAWDOWN = 5.00
MAX_DAILY_ENTRIES = 8
MAX_OPEN_TRADES = 3
MAX_EFFECTIVE_LEVERAGE = 3.0
MAX_TICK_AGE_MS = 15_000


class DemoExecutionError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


class DemoExecutionAdapter:
    def __init__(self, mt5_api: Any, ledger_path: str | Path):
        self.mt5 = mt5_api
        self.ledger_path = Path(ledger_path)
        self._order_lock = threading.Lock()
        self.ledger_path.parent.mkdir(parents=True, exist_ok=True)
        with self._db() as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS demo_orders ("
                "client_order_id TEXT PRIMARY KEY, comment TEXT NOT NULL UNIQUE, "
                "state TEXT NOT NULL, payload_hash TEXT NOT NULL, result_json TEXT, "
                "created_at_utc TEXT NOT NULL)"
            )
            db.execute(
                "CREATE TABLE IF NOT EXISTS session_baselines ("
                "account_key TEXT PRIMARY KEY, equity REAL NOT NULL, "
                "created_at_utc TEXT NOT NULL)"
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

    def _account(self) -> tuple[Any, Any]:
        terminal = self.mt5.terminal_info()
        account = self.mt5.account_info()
        if terminal is None or account is None or not terminal.connected:
            raise DemoExecutionError("TERMINAL_UNAVAILABLE", "XM MT5 terminal or account is unavailable.")
        if "xm" not in str(account.company).casefold() or "xm" not in str(account.server).casefold():
            raise DemoExecutionError("UNEXPECTED_BROKER", "The connected account is not verified as XM.")
        if int(account.trade_mode) != 0:
            raise DemoExecutionError("DEMO_ACCOUNT_REQUIRED", "Order submission is restricted to XM demo accounts.")
        if bool(getattr(terminal, "tradeapi_disabled", True)) or not bool(getattr(terminal, "trade_allowed", False)):
            raise DemoExecutionError("TERMINAL_TRADING_DISABLED", "MT5 terminal trading permissions are disabled.")
        if not bool(getattr(account, "trade_allowed", False)) or not bool(getattr(account, "trade_expert", False)):
            raise DemoExecutionError("ACCOUNT_TRADING_DISABLED", "XM account trading permissions are disabled.")
        if str(account.currency).upper() != "USD":
            raise DemoExecutionError("UNSUPPORTED_ACCOUNT_CURRENCY", "Demo execution currently requires a USD-denominated account.")
        return terminal, account

    def _today_metrics(self, account: Any) -> tuple[int, float, float]:
        now = datetime.now(timezone.utc)
        start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
        deals = self.mt5.history_deals_get(start, now)
        if deals is None:
            raise DemoExecutionError("DEAL_HISTORY_UNAVAILABLE", "Cannot verify today's broker deals; new orders are blocked.")
        realized = 0.0
        entries = 0
        for deal in deals:
            pnl = sum(_number(getattr(deal, key, 0)) or 0.0 for key in ("profit", "commission", "swap", "fee"))
            realized += pnl
            if int(getattr(deal, "entry", -1)) in {
                getattr(self.mt5, "DEAL_ENTRY_IN", 0),
                getattr(self.mt5, "DEAL_ENTRY_INOUT", 2),
            }:
                entries += 1
        opening_balance = float(account.balance) - realized
        if not math.isfinite(opening_balance) or opening_balance <= 0:
            raise DemoExecutionError("DAILY_BASELINE_UNAVAILABLE", "Cannot establish today's account baseline.")
        daily_loss = max(0.0, (opening_balance - float(account.equity)) / opening_balance * 100)
        return entries, daily_loss, opening_balance

    def _session_baseline(self, account: Any) -> float:
        account_key = hashlib.sha256(
            f"{account.company}|{account.server}|{account.login}|{account.currency}".encode("utf-8")
        ).hexdigest()
        with self._db() as db:
            row = db.execute("SELECT equity FROM session_baselines WHERE account_key=?", (account_key,)).fetchone()
            if row is not None:
                return float(row[0])
            baseline = float(account.equity)
            if not math.isfinite(baseline) or baseline <= 0:
                raise DemoExecutionError("SESSION_BASELINE_UNAVAILABLE", "Cannot establish a positive session equity baseline.")
            db.execute(
                "INSERT INTO session_baselines(account_key,equity,created_at_utc) VALUES(?,?,?)",
                (account_key, baseline, datetime.now(timezone.utc).isoformat()),
            )
            return baseline

    def _reconcile_prior(self, client_id: str, comment: str) -> dict[str, Any]:
        """Resolve an interrupted submission only from broker-visible evidence."""
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=30)
        positions = self.mt5.positions_get()
        orders = self.mt5.orders_get()
        history_orders = self.mt5.history_orders_get(start, now)
        history_deals = self.mt5.history_deals_get(start, now)
        if any(value is None for value in (positions, orders, history_orders, history_deals)):
            raise DemoExecutionError("RECONCILIATION_UNAVAILABLE", "XM history is incomplete; order remains locked against retry.")

        def matches(records: Any) -> list[Any]:
            return [record for record in records if str(getattr(record, "comment", "")) == comment]

        found_positions = matches(positions)
        found_orders = matches(orders)
        found_history_orders = matches(history_orders)
        found_deals = matches(history_deals)
        if not any((found_positions, found_orders, found_history_orders, found_deals)):
            raise DemoExecutionError("ORDER_STATE_UNKNOWN", "No conclusive broker record was found; this order ID remains blocked from resubmission.")

        if found_deals or found_positions:
            state = "COMPLETED"
        elif found_orders:
            state = "PLACED"
        else:
            state = "RECONCILED_HISTORY"
        result = {
            "state": state,
            "account_mode": "DEMO",
            "client_order_id": client_id,
            "broker_comment": comment,
            "broker_records": {
                "positions": [int(getattr(item, "ticket", 0) or 0) for item in found_positions],
                "orders": [int(getattr(item, "ticket", 0) or 0) for item in found_orders],
                "history_orders": [int(getattr(item, "ticket", 0) or 0) for item in found_history_orders],
                "deals": [int(getattr(item, "ticket", 0) or 0) for item in found_deals],
            },
            "reconciled_at_utc": now.isoformat(),
            "duplicate_replay": True,
        }
        with self._db() as db:
            db.execute(
                "UPDATE demo_orders SET state=?,result_json=? WHERE client_order_id=?",
                (state, json.dumps(result, allow_nan=False), client_id),
            )
        return result

    def _volume_for_risk(self, symbol: str, side: str, price: float, stop: float, equity: float, info: Any) -> tuple[float, float]:
        order_type = self.mt5.ORDER_TYPE_BUY if side == "BUY" else self.mt5.ORDER_TYPE_SELL
        one_lot_loss = _number(self.mt5.order_calc_profit(order_type, symbol, 1.0, price, stop))
        if one_lot_loss is None or one_lot_loss >= 0:
            raise DemoExecutionError("RISK_CALCULATION_FAILED", "Broker could not calculate a finite loss at the requested stop.")
        loss_per_lot = abs(one_lot_loss)
        risk_budget = equity * (MAX_RISK_PER_TRADE / 100)
        minimum = _number(info.volume_min)
        maximum = _number(info.volume_max)
        step = _number(info.volume_step)
        if not minimum or not maximum or not step or min(minimum, maximum, step) <= 0:
            raise DemoExecutionError("INVALID_BROKER_VOLUME_RULES", "XM returned invalid volume constraints.")
        if minimum * loss_per_lot > risk_budget:
            raise DemoExecutionError("MINIMUM_VOLUME_EXCEEDS_RISK", "The XM minimum volume exceeds the 0.20% per-trade risk limit.")
        steps = math.floor((min(risk_budget / loss_per_lot, maximum) + 1e-12) / step)
        volume = round(steps * step, 8)
        if volume < minimum or volume > maximum:
            raise DemoExecutionError("VOLUME_OUT_OF_RANGE", "The risk-sized volume is outside XM's current limits.")
        risk = abs(_number(self.mt5.order_calc_profit(order_type, symbol, volume, price, stop)) or math.inf)
        if not math.isfinite(risk) or risk > risk_budget + 0.01:
            raise DemoExecutionError("RISK_LIMIT_EXCEEDED", "Rounded volume would exceed the 0.20% risk limit.")
        return volume, risk

    def _check_portfolio(self, account: Any, new_symbol: str, new_volume: float, new_price: float) -> None:
        positions = self.mt5.positions_get()
        orders = self.mt5.orders_get()
        if positions is None or orders is None:
            raise DemoExecutionError("BROKER_STATE_UNAVAILABLE", "Cannot reconcile broker positions and pending orders.")
        if len(positions) + len(orders) >= MAX_OPEN_TRADES:
            raise DemoExecutionError("MAX_OPEN_TRADES", "The three-position limit, including pending orders, is reached.")
        if orders:
            raise DemoExecutionError("PENDING_ORDERS_PRESENT", "Existing pending orders must be reconciled before another entry.")

        exposure = 0.0
        for position in positions:
            info = self.mt5.symbol_info(str(position.symbol))
            if info is None or not _number(getattr(position, "sl", 0)):
                raise DemoExecutionError("UNPROTECTED_POSITION", "An open position has unknown contract data or no stop loss.")
            contract = _number(info.trade_contract_size)
            price = _number(getattr(position, "price_current", 0))
            volume = _number(position.volume)
            if not contract or not price or not volume:
                raise DemoExecutionError("POSITION_EXPOSURE_UNKNOWN", "Cannot calculate an existing position's exposure.")
            base = str(getattr(info, "currency_base", "")).upper()
            quote = str(getattr(info, "currency_profit", "")).upper()
            if quote == "USD":
                exposure += contract * volume * price
            elif base == "USD":
                exposure += contract * volume
            else:
                raise DemoExecutionError("UNSUPPORTED_EXPOSURE_CURRENCY", "Cannot safely convert an open position's notional to USD.")

        info = self.mt5.symbol_info(new_symbol)
        contract = _number(info.trade_contract_size) if info else None
        base = str(getattr(info, "currency_base", "")).upper() if info else ""
        quote = str(getattr(info, "currency_profit", "")).upper() if info else ""
        if not contract:
            raise DemoExecutionError("CONTRACT_SIZE_UNAVAILABLE", "XM contract size is unavailable.")
        if quote == "USD":
            exposure += contract * new_volume * new_price
        elif base == "USD":
            exposure += contract * new_volume
        else:
            raise DemoExecutionError("UNSUPPORTED_EXPOSURE_CURRENCY", "Cannot safely convert this instrument's notional to USD.")
        if exposure / float(account.equity) > MAX_EFFECTIVE_LEVERAGE:
            raise DemoExecutionError("MAX_EFFECTIVE_LEVERAGE", "The order would exceed the 3x portfolio exposure limit.")

    def place_order(self, payload: Any) -> dict[str, Any]:
        with self._order_lock:
            return self._place_order_locked(payload)

    def _place_order_locked(self, payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict) or set(payload) != {
            "client_order_id", "strategy_id", "signal_bar_time", "symbol", "side", "stop_loss", "take_profit"
        }:
            raise DemoExecutionError("INVALID_ORDER_REQUEST", "Order request fields are invalid or incomplete.")
        client_id = payload.get("client_order_id")
        strategy_id = payload.get("strategy_id")
        signal_bar_time = payload.get("signal_bar_time")
        symbol = payload.get("symbol")
        side = payload.get("side")
        stop = _number(payload.get("stop_loss"))
        target = _number(payload.get("take_profit"))
        if not isinstance(client_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{16,64}", client_id):
            raise DemoExecutionError("INVALID_CLIENT_ORDER_ID", "A unique 16–64 character client order ID is required.")
        if strategy_id != "strat_donchian_breakout":
            raise DemoExecutionError("STRATEGY_NOT_ENABLED", "Only the M15 Donchian breakout strategy is enabled for demo execution.")
        if isinstance(signal_bar_time, bool) or not isinstance(signal_bar_time, int):
            raise DemoExecutionError("INVALID_SIGNAL_BAR", "A closed M15 signal-bar timestamp is required.")
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        if signal_bar_time > now_ms or now_ms - signal_bar_time > 15 * 60 * 1000:
            raise DemoExecutionError("STALE_SIGNAL_BAR", "The strategy signal is not from the latest closed M15 window.")
        if not isinstance(symbol, str) or not symbol or len(symbol) > 64 or any(ord(c) < 32 for c in symbol):
            raise DemoExecutionError("INVALID_SYMBOL", "Provide the exact XM Market Watch symbol.")
        if side not in {"BUY", "SELL"} or stop is None or target is None or stop <= 0 or target <= 0:
            raise DemoExecutionError("INVALID_ORDER_PRICES", "Side, stop loss, and take profit must be valid finite values.")

        _, account = self._account()
        payload_hash = hashlib.sha256(
            f"{json.dumps(payload, sort_keys=True, separators=(',', ':'))}|{account.server}|{account.login}".encode()
        ).hexdigest()
        comment = "UAT-" + hashlib.sha256(client_id.encode()).hexdigest()[:20]
        with self._db() as db:
            prior = db.execute("SELECT state,payload_hash,result_json FROM demo_orders WHERE client_order_id=?", (client_id,)).fetchone()
            if prior:
                if prior[1] != payload_hash:
                    raise DemoExecutionError("IDEMPOTENCY_CONFLICT", "This client order ID was already used for a different request.")
                if prior[0] in {"SUBMITTING", "UNKNOWN"} or not prior[2]:
                    return self._reconcile_prior(client_id, comment)
                if prior[0] in {"COMPLETED", "PLACED", "PARTIAL", "RECONCILED_HISTORY", "REJECTED"}:
                    result = json.loads(prior[2])
                    result["duplicate_replay"] = True
                    return result
                raise DemoExecutionError("ORDER_STATE_UNKNOWN", "This order may already have reached XM; reconcile it before retrying.")

        entries, daily_loss, _ = self._today_metrics(account)
        if daily_loss >= MAX_DAILY_LOSS:
            raise DemoExecutionError("DAILY_LOSS_LIMIT", "The 1.00% daily loss limit has been reached.")
        if entries >= MAX_DAILY_ENTRIES:
            raise DemoExecutionError("DAILY_ENTRY_LIMIT", "The eight-entry UTC daily limit has been reached.")
        baseline = self._session_baseline(account)
        if (baseline - float(account.equity)) / baseline * 100 >= MAX_SESSION_DRAWDOWN:
            raise DemoExecutionError("SESSION_DRAWDOWN_LIMIT", "The 5.00% session drawdown limit has been reached.")

        info = self.mt5.symbol_info(symbol)
        tick = self.mt5.symbol_info_tick(symbol)
        if info is None or not bool(getattr(info, "visible", False)):
            raise DemoExecutionError("SYMBOL_NOT_VISIBLE", "The exact XM symbol must be visible in Market Watch.")
        if str(getattr(info, "currency_base", "")).upper() != "GBP" or str(getattr(info, "currency_profit", "")).upper() != "USD":
            raise DemoExecutionError("STRATEGY_SYMBOL_MISMATCH", "The M15 Donchian strategy is restricted to an XM GBP/USD contract.")
        if int(getattr(info, "trade_mode", -1)) != getattr(self.mt5, "SYMBOL_TRADE_MODE_FULL", 4):
            raise DemoExecutionError("SYMBOL_NOT_FULLY_TRADABLE", "This XM symbol is not currently fully tradable.")
        bid, ask = _number(getattr(tick, "bid", None)), _number(getattr(tick, "ask", None))
        tick_ms = int(getattr(tick, "time_msc", 0) or 0) if tick is not None else 0
        age_ms = int(datetime.now(timezone.utc).timestamp() * 1000) - tick_ms
        if bid is None or ask is None or bid <= 0 or ask < bid or age_ms < 0 or age_ms > MAX_TICK_AGE_MS:
            raise DemoExecutionError("QUOTE_NOT_FRESH", "XM quote is invalid, future-dated, or older than 15 seconds.")
        point = _number(getattr(info, "point", None))
        digits = int(getattr(info, "digits", 0))
        stops_level = int(getattr(info, "trade_stops_level", 0))
        if not point or digits <= 0:
            raise DemoExecutionError("INVALID_SYMBOL_METADATA", "XM symbol precision or point size is unavailable.")
        entry = ask if side == "BUY" else bid
        minimum_distance = max(0, stops_level) * point
        if side == "BUY":
            if stop >= bid or target <= ask or bid - stop < minimum_distance or target - ask < minimum_distance:
                raise DemoExecutionError("INVALID_BUY_PROTECTION", "Buy stop loss/take profit violates the current XM quote or stop-distance rules.")
        elif stop <= ask or target >= bid or stop - ask < minimum_distance or bid - target < minimum_distance:
            raise DemoExecutionError("INVALID_SELL_PROTECTION", "Sell stop loss/take profit violates the current XM quote or stop-distance rules.")

        volume, risk = self._volume_for_risk(symbol, side, entry, stop, float(account.equity), info)
        self._check_portfolio(account, symbol, volume, entry)
        margin = _number(self.mt5.order_calc_margin(self.mt5.ORDER_TYPE_BUY if side == "BUY" else self.mt5.ORDER_TYPE_SELL, symbol, volume, entry))
        free_margin = _number(getattr(account, "margin_free", None))
        if margin is None or free_margin is None or margin > free_margin * 0.8:
            raise DemoExecutionError("INSUFFICIENT_MARGIN", "Broker-calculated margin exceeds the 80% free-margin buffer.")

        filling_flags = int(getattr(info, "filling_mode", 0))
        if filling_flags & 2:
            filling = self.mt5.ORDER_FILLING_IOC
        elif filling_flags & 1:
            filling = self.mt5.ORDER_FILLING_FOK
        elif int(getattr(info, "trade_exemode", -1)) != getattr(self.mt5, "SYMBOL_TRADE_EXECUTION_MARKET", 2):
            filling = self.mt5.ORDER_FILLING_RETURN
        else:
            raise DemoExecutionError("FILLING_POLICY_UNKNOWN", "No supported XM market-order filling policy was reported.")

        request = {
            "action": self.mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": volume,
            "type": self.mt5.ORDER_TYPE_BUY if side == "BUY" else self.mt5.ORDER_TYPE_SELL,
            "price": round(entry, digits),
            "sl": round(stop, digits),
            "tp": round(target, digits),
            "deviation": 20,
            "magic": 261011,
            "comment": comment,
            "type_time": self.mt5.ORDER_TIME_GTC,
            "type_filling": filling,
        }
        check = self.mt5.order_check(request)
        if check is None or int(getattr(check, "retcode", -1)) != 0:
            raise DemoExecutionError("BROKER_PREFLIGHT_REJECTED", "XM order_check did not approve the request; no order was sent.")

        with self._db() as db:
            db.execute(
                "INSERT INTO demo_orders(client_order_id,comment,state,payload_hash,created_at_utc) VALUES(?,?,?,?,?)",
                (client_id, comment, "SUBMITTING", payload_hash, datetime.now(timezone.utc).isoformat()),
            )
        try:
            result = self.mt5.order_send(request)
        except Exception as error:
            with self._db() as db:
                db.execute("UPDATE demo_orders SET state='UNKNOWN' WHERE client_order_id=?", (client_id,))
            raise DemoExecutionError("ORDER_STATE_UNKNOWN", "XM response was interrupted; reconcile broker history before retrying.") from error
        if result is None:
            state, retcode = "UNKNOWN", None
        else:
            retcode = int(getattr(result, "retcode", -1))
            accepted = {getattr(self.mt5, "TRADE_RETCODE_DONE", 10009), getattr(self.mt5, "TRADE_RETCODE_PLACED", 10008), getattr(self.mt5, "TRADE_RETCODE_DONE_PARTIAL", 10010)}
            state = (
                "PARTIAL" if retcode == getattr(self.mt5, "TRADE_RETCODE_DONE_PARTIAL", 10010)
                else "PLACED" if retcode == getattr(self.mt5, "TRADE_RETCODE_PLACED", 10008)
                else "COMPLETED" if retcode == getattr(self.mt5, "TRADE_RETCODE_DONE", 10009)
                else "REJECTED"
            )
        response = {
            "state": state,
            "account_mode": "DEMO",
            "strategy_id": strategy_id,
            "signal_bar_time": signal_bar_time,
            "symbol": symbol,
            "side": side,
            "requested_volume": volume,
            "risk_estimate_account_currency": round(risk, 2),
            "risk_limit_percent": MAX_RISK_PER_TRADE,
            "stop_loss": request["sl"],
            "take_profit": request["tp"],
            "broker_retcode": retcode,
            "order_ticket": int(getattr(result, "order", 0) or 0) if result else None,
            "deal_ticket": int(getattr(result, "deal", 0) or 0) if result else None,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "duplicate_replay": False,
            "order_submission": state in {"COMPLETED", "PLACED", "PARTIAL"},
        }
        with self._db() as db:
            db.execute(
                "UPDATE demo_orders SET state=?,result_json=? WHERE client_order_id=?",
                (state, json.dumps(response, allow_nan=False), client_id),
            )
        if state == "UNKNOWN":
            raise DemoExecutionError("ORDER_STATE_UNKNOWN", "XM returned no definitive result; reconcile broker history before retrying.")
        if state == "REJECTED":
            raise DemoExecutionError("BROKER_REJECTED", "XM rejected the order. No retry was attempted.")
        return response
