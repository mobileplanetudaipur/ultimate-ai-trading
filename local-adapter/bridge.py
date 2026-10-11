from __future__ import annotations

import hmac
import json
import math
import os
import sys
import time
import argparse
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any, Callable, TextIO
from urllib.parse import parse_qs, urlsplit

from order_execution import LIVE_RELEASE_APPROVED, MT5OrderExecutor, OrderExecutionError


HOST = "127.0.0.1"
PORT = 8000
ALLOWED_ORIGINS = {"http://127.0.0.1:3000", "http://localhost:3000"}
FRESHNESS_LIMIT_MS = 15_000
MAX_VISIBLE_SYMBOLS = 500
TIMEFRAME_NAMES = ("M5", "M15", "H1", "H4", "D1")


class AdapterError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def account_mode_name(mode: int) -> str:
    return {0: "DEMO", 2: "LIVE"}.get(mode, "UNSUPPORTED")


def finite_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def trade_mode_name(mode: int) -> str:
    return {
        0: "DISABLED",
        1: "LONG_ONLY",
        2: "SHORT_ONLY",
        3: "CLOSE_ONLY",
        4: "FULL",
    }.get(mode, "UNKNOWN")


class ReadOnlyMT5Adapter:
    def __init__(self, mt5_api: Any):
        self.mt5 = mt5_api

    def _account_context(self) -> tuple[Any, Any]:
        terminal = self.mt5.terminal_info()
        account = self.mt5.account_info()
        if terminal is None or account is None:
            raise AdapterError(503, "TERMINAL_STATE_UNAVAILABLE", "MT5 terminal or account state is unavailable.")
        if not terminal.connected:
            raise AdapterError(503, "TERMINAL_DISCONNECTED", "MT5 terminal is not connected.")
        company = str(account.company)
        server = str(account.server)
        if "xm" not in company.lower() or "xm" not in server.lower():
            raise AdapterError(403, "UNEXPECTED_BROKER", "The connected terminal is not verified as the configured XM account.")
        if account_mode_name(int(account.trade_mode)) == "UNSUPPORTED":
            raise AdapterError(403, "UNSUPPORTED_ACCOUNT_MODE", "Only verified XM demo or live accounts are supported for read-only access.")
        return terminal, account

    def status(self) -> dict[str, Any]:
        terminal, account = self._account_context()
        return {
            "state": "CONNECTED_READ_ONLY",
            "adapter": "MetaTrader5 Python API",
            "broker_company": str(account.company),
            "server": str(account.server),
            "account_mode": account_mode_name(int(account.trade_mode)),
            "currency": str(account.currency),
            "terminal_connected": bool(terminal.connected),
            "terminal_trade_allowed": bool(terminal.trade_allowed),
            "terminal_trade_api_disabled": bool(getattr(terminal, "tradeapi_disabled", False)),
            "account_trade_allowed": bool(account.trade_allowed),
            "account_expert_allowed": bool(account.trade_expert),
            "capabilities": ["read_status", "read_account", "read_visible_symbols"],
            "order_submission": False,
            "observed_at_utc": datetime.now(timezone.utc).isoformat(),
        }

    def account_snapshot(self) -> dict[str, Any]:
        _, account = self._account_context()
        return {
            "currency": str(account.currency),
            "balance": finite_number(account.balance),
            "equity": finite_number(account.equity),
            "profit": finite_number(account.profit),
            "margin_used": finite_number(account.margin),
            "free_margin": finite_number(account.margin_free),
            "margin_level_percent": finite_number(account.margin_level),
            "leverage": int(account.leverage),
            "account_mode": account_mode_name(int(account.trade_mode)),
            "server": str(account.server),
            "observed_at_utc": datetime.now(timezone.utc).isoformat(),
        }

    def _symbol_snapshot(self, symbol: str) -> dict[str, Any]:
        info = self.mt5.symbol_info(symbol)
        if info is None or not info.visible:
            raise AdapterError(404, "SYMBOL_NOT_VISIBLE", "The exact symbol is not present in the terminal's visible market watch.")

        tick = self.mt5.symbol_info_tick(symbol)
        received_at = datetime.now(timezone.utc)
        tick_time_ms = int(getattr(tick, "time_msc", 0) or 0) if tick is not None else 0
        age_ms = int(received_at.timestamp() * 1000) - tick_time_ms if tick_time_ms else None
        bid = finite_number(tick.bid) if tick is not None else None
        ask = finite_number(tick.ask) if tick is not None else None
        if tick is None or bid is None or ask is None or bid <= 0 or ask < bid:
            freshness = "INVALID"
        elif age_ms is None:
            freshness = "UNAVAILABLE"
        elif age_ms < 0:
            freshness = "FUTURE_TIMESTAMP"
        elif age_ms > FRESHNESS_LIMIT_MS:
            freshness = "STALE"
        else:
            freshness = "FRESH"

        return {
            "symbol": str(info.name),
            "description": str(info.description),
            "visible": bool(info.visible),
            "trade_mode": trade_mode_name(int(info.trade_mode)),
            "digits": int(info.digits),
            "point": finite_number(info.point),
            "contract_size": finite_number(info.trade_contract_size),
            "tick_size": finite_number(info.trade_tick_size),
            "tick_value_profit": finite_number(info.trade_tick_value_profit),
            "tick_value_loss": finite_number(info.trade_tick_value_loss),
            "volume_min": finite_number(info.volume_min),
            "volume_max": finite_number(info.volume_max),
            "volume_step": finite_number(info.volume_step),
            "stops_level_points": int(info.trade_stops_level),
            "freeze_level_points": int(info.trade_freeze_level),
            "margin_initial": finite_number(info.margin_initial),
            "margin_maintenance": finite_number(info.margin_maintenance),
            "currency_base": str(info.currency_base),
            "currency_profit": str(info.currency_profit),
            "currency_margin": str(info.currency_margin),
            "execution_mode": int(info.trade_exemode),
            "filling_mode": int(info.filling_mode),
            "bid": bid,
            "ask": ask,
            "tick_timestamp_utc": (
                datetime.fromtimestamp(tick_time_ms / 1000, timezone.utc).isoformat()
                if tick_time_ms else None
            ),
            "received_at_utc": received_at.isoformat(),
            "tick_age_ms": age_ms,
            "freshness": freshness,
        }

    def visible_symbols(self, requested_symbol: str | None = None) -> list[dict[str, Any]]:
        self._account_context()
        if requested_symbol is not None:
            if not requested_symbol or len(requested_symbol) > 64 or any(ord(char) < 32 for char in requested_symbol):
                raise AdapterError(400, "INVALID_SYMBOL", "Provide one exact terminal symbol name.")
            return [self._symbol_snapshot(requested_symbol)]

        symbols = self.mt5.symbols_get()
        if symbols is None:
            raise AdapterError(503, "SYMBOL_LIST_UNAVAILABLE", "MT5 did not provide the visible symbol list.")
        visible_names = [str(item.name) for item in symbols if bool(getattr(item, "visible", False))]
        if len(visible_names) > MAX_VISIBLE_SYMBOLS:
            raise AdapterError(503, "SYMBOL_LIST_TOO_LARGE", "Visible symbol list exceeds the adapter safety limit.")
        return [self._symbol_snapshot(name) for name in visible_names]

    def quote_snapshot(self, requested_symbols: list[str]) -> dict[str, Any]:
        _, account = self._account_context()
        if not requested_symbols or len(requested_symbols) > 20 or len(set(requested_symbols)) != len(requested_symbols):
            raise AdapterError(400, "INVALID_SYMBOLS", "Provide between 1 and 20 unique exact broker symbols.")
        symbols = [self._symbol_snapshot(symbol) for symbol in requested_symbols]
        return {"symbols": symbols, "count": len(symbols), "account_mode": account_mode_name(int(account.trade_mode)), "server": str(account.server), "observed_at_utc": datetime.now(timezone.utc).isoformat(), "order_submission": False}

    def snapshot(self) -> dict[str, Any]:
        status = self.status()
        return {
            "state": "CONNECTED_READ_ONLY",
            "message": f"Connected to the signed-in XM {status['account_mode'].casefold()} terminal in read-only mode.",
            "status": status,
            "account": self.account_snapshot(),
            "symbols": self.visible_symbols(),
            "order_submission": False,
        }

    def candle_history(self, symbol: str, timeframe: str, count: int) -> dict[str, Any]:
        self._account_context()
        if timeframe not in TIMEFRAME_NAMES or not 2 <= count <= 500:
            raise AdapterError(400, "INVALID_HISTORY_REQUEST", "Use an allowed timeframe and between 2 and 500 bars.")
        self._symbol_snapshot(symbol)
        period = getattr(self.mt5, f"TIMEFRAME_{timeframe}", None)
        if period is None:
            raise AdapterError(503, "TIMEFRAME_UNAVAILABLE", "The MT5 connector does not expose the requested timeframe.")
        # Position zero is still forming. Strategy input is limited to closed bars.
        rates = self.mt5.copy_rates_from_pos(symbol, period, 1, count)
        if rates is None:
            raise AdapterError(503, "CANDLE_HISTORY_UNAVAILABLE", "XM candle history is unavailable for this symbol and timeframe.")
        now_s = int(time.time())
        candles = []
        for rate in rates:
            stamp = int(rate["time"])
            values = {key: finite_number(rate[key]) for key in ("open", "high", "low", "close", "tick_volume")}
            if stamp <= 0 or stamp > now_s or any(value is None for value in values.values()):
                continue
            if values["high"] < max(values["open"], values["close"]) or values["low"] > min(values["open"], values["close"]):
                continue
            candles.append({"time": stamp * 1000, "open": values["open"], "high": values["high"], "low": values["low"], "close": values["close"], "volume": values["tick_volume"]})
        candles.sort(key=lambda item: item["time"])
        if len(candles) < 2:
            raise AdapterError(503, "CANDLE_HISTORY_INSUFFICIENT", "XM returned fewer than two valid historical bars.")
        return {"symbol": symbol, "timeframe": timeframe, "candles": candles, "observed_at_utc": datetime.now(timezone.utc).isoformat(), "provider": "XM MetaTrader 5 terminal", "order_submission": False}

    def reconciliation_snapshot(self) -> dict[str, Any]:
        self._account_context()
        now = datetime.now(timezone.utc)
        from datetime import timedelta
        start = now - timedelta(days=30)
        positions, orders = self.mt5.positions_get(), self.mt5.orders_get()
        history_orders, deals = self.mt5.history_orders_get(start, now), self.mt5.history_deals_get(start, now)
        if any(value is None for value in (positions, orders, history_orders, deals)):
            raise AdapterError(503, "RECONCILIATION_INCOMPLETE", "XM did not return every required open and historical order/position/deal collection.")
        numeric = {"price_open", "price_current", "price", "sl", "tp", "volume", "volume_initial", "volume_current", "profit", "commission", "swap", "fee"}
        integer = {"time", "time_setup", "time_done", "ticket", "order", "position_id", "type", "state", "magic", "entry"}
        def project(items: Any, fields: tuple[str, ...]) -> list[dict[str, Any]]:
            output = []
            for item in items:
                row = {}
                for field in fields:
                    value = getattr(item, field, None)
                    row[field] = finite_number(value) if field in numeric else int(value) if field in integer and value is not None else str(value)[:128] if value is not None else None
                output.append(row)
            return output
        return {
            "account": self.account_snapshot(),
            "open_positions": project(positions, ("ticket", "symbol", "type", "volume", "price_open", "price_current", "sl", "tp", "profit", "swap", "time", "magic", "comment")),
            "open_orders": project(orders, ("ticket", "symbol", "type", "state", "volume_initial", "volume_current", "price_open", "sl", "tp", "time_setup", "magic", "comment")),
            "history_orders_30d": project(history_orders, ("ticket", "symbol", "type", "state", "volume_initial", "volume_current", "price_open", "price_current", "sl", "tp", "time_setup", "time_done", "magic", "comment")),
            "deals_30d": project(deals, ("ticket", "order", "position_id", "symbol", "type", "entry", "volume", "price", "profit", "commission", "swap", "fee", "time", "magic", "comment")),
            "complete": True, "window_start_utc": start.isoformat(), "observed_at_utc": now.isoformat(), "order_submission": False,
        }


def running_terminal_paths() -> list[str]:
    if os.name != "nt":
        return []
    if os.environ.get("AITRADING_DISABLE_MT5_DISCOVERY") == "1":
        return []
    import psutil

    paths: list[str] = []
    for process in psutil.process_iter(["name", "exe"]):
        try:
            if (process.info.get("name") or "").lower() == "terminal64.exe":
                executable = process.info.get("exe")
                if executable:
                    paths.append(os.path.abspath(executable))
        except (psutil.AccessDenied, psutil.NoSuchProcess, psutil.ZombieProcess):
            continue
    return sorted(set(paths), key=str.casefold)


class LocalMT5Connector:
    def __init__(
        self,
        mt5_api: Any,
        terminal_path_provider: Callable[[], list[str]] = running_terminal_paths,
        order_ledger_path: str | Path | None = None,
    ):
        self.mt5 = mt5_api
        self.terminal_path_provider = terminal_path_provider
        self.initialized_path: str | None = None
        self.order_ledger_path = Path(order_ledger_path) if order_ledger_path else self._default_order_ledger_path()
        self.order_executor: MT5OrderExecutor | None = None
        self.order_session_mode: str | None = None
        self.order_session_account_key: str | None = None

    @staticmethod
    def _default_order_ledger_path() -> Path:
        local_app_data = os.environ.get("LOCALAPPDATA")
        root = Path(local_app_data) if local_app_data else Path.home() / "AppData" / "Local"
        return root / "Ultimate AI Trading" / "mt5-orders.sqlite3"

    def _executor(self) -> MT5OrderExecutor:
        if self.order_executor is None:
            self.order_executor = MT5OrderExecutor(self.mt5, self.order_ledger_path)
        return self.order_executor

    def _lock_order_session(self) -> None:
        self.order_session_mode = None
        self.order_session_account_key = None
        if self.order_executor is not None:
            self.order_executor.clear_confirmations()

    def _order_session_enabled(self, mode: str, account_key: str) -> bool:
        return (
            mode == "DEMO"
            and self.order_session_mode == mode
            and self.order_session_account_key == account_key
        )

    def _attach_order_status(self, result: dict[str, Any]) -> dict[str, Any]:
        result["order_submission_enabled"] = False
        result["order_submission_mode"] = None
        result["order_recovery_required"] = False
        result["unresolved_orders"] = []
        if result.get("state") != "CONNECTED_READ_ONLY":
            self._lock_order_session()
            return result
        try:
            executor = self._executor()
            terminal, account, mode, account_key = executor.account_context(require_trade_permissions=False)
            if self.order_session_account_key and self.order_session_account_key != account_key:
                self._lock_order_session()
            unresolved = executor.unresolved_orders(account_key)
            result["unresolved_orders"] = unresolved
            result["order_recovery_required"] = bool(unresolved)
            result["order_submission_mode"] = mode
            permissions_enabled = (
                bool(getattr(terminal, "trade_allowed", False))
                and not bool(getattr(terminal, "tradeapi_disabled", True))
                and bool(getattr(account, "trade_allowed", False))
                and bool(getattr(account, "trade_expert", False))
            )
            result["order_submission_enabled"] = (
                self._order_session_enabled(mode, account_key)
                and permissions_enabled
                and not unresolved
            )
            result["order_submission"] = False
            return result
        except OrderExecutionError as error:
            result["order_status_error"] = {"code": error.code, "message": error.message}
            self._lock_order_session()
            return result

    def _verified_order_context(self) -> tuple[MT5OrderExecutor, str, str]:
        snapshot = self.snapshot(include_market_watch=False)
        if snapshot.get("state") != "CONNECTED_READ_ONLY":
            raise OrderExecutionError(
                "XM_TERMINAL_NOT_READY",
                str(snapshot.get("message") or "The signed-in XM terminal is not ready."),
            )
        executor = self._executor()
        _, _, mode, account_key = executor.account_context()
        if self.order_session_account_key and self.order_session_account_key != account_key:
            self._lock_order_session()
        return executor, mode, account_key

    def enable_trading(self, confirmation: Any, account_mode: Any) -> dict[str, Any]:
        executor, mode, account_key = self._verified_order_context()
        if executor.unresolved_orders(account_key):
            raise OrderExecutionError(
                "ORDER_RECOVERY_REQUIRED",
                "Reconcile the unresolved order in MT5 before enabling another order session.",
            )
        if account_mode != mode:
            raise OrderExecutionError("ACCOUNT_MODE_CHANGED", "The signed-in MT5 account mode changed. Review the current account and try again.")
        if mode == "LIVE":
            raise OrderExecutionError(
                "LIVE_RELEASE_NOT_APPROVED",
                "Live order submission is locked pending separate release approval.",
            )
        if not LIVE_RELEASE_APPROVED and mode != "DEMO":
            raise OrderExecutionError("LIVE_RELEASE_NOT_APPROVED", "Live order submission is locked pending separate release approval.")
        if confirmation != "ENABLE DEMO ORDER SUBMISSION":
            raise OrderExecutionError("DEMO_CONFIRMATION_REQUIRED", "Type the exact demo activation phrase to unlock this session.")
        executor.clear_confirmations()
        self.order_session_mode = mode
        self.order_session_account_key = account_key
        return {
            "state": "DEMO_ORDER_SUBMISSION_ENABLED_FOR_SESSION",
            "account_mode": mode,
            "order_submission": False,
            "message": "Demo order submission is enabled for this signed-in account in this app session.",
        }

    def disable_trading(self) -> dict[str, Any]:
        self._lock_order_session()
        return {
            "state": "ORDER_SUBMISSION_LOCKED",
            "order_submission": False,
            "message": "Order submission is locked for this app session.",
        }

    def prepare_order(self, payload: Any) -> dict[str, Any]:
        executor, mode, account_key = self._verified_order_context()
        enabled = self._order_session_enabled(mode, account_key)
        return executor.prepare_order(payload, session_enabled=enabled)

    def submit_order(self, confirmation: Any) -> dict[str, Any]:
        executor, mode, account_key = self._verified_order_context()
        enabled = self._order_session_enabled(mode, account_key)
        if not isinstance(confirmation, dict):
            raise OrderExecutionError("INVALID_CONFIRMATION", "The order review confirmation is invalid.")
        return executor.submit_order(
            confirmation.get("confirmation_id"),
            confirmation.get("confirm_order"),
            confirmation.get("confirm_live"),
            session_enabled=enabled,
        )

    def _state(self, state: str, message: str) -> dict[str, Any]:
        return {"state": state, "message": message, "order_submission": False}

    def snapshot(self, include_market_watch: bool = True) -> dict[str, Any]:
        if self.mt5 is None:
            return self._state(
                "CONNECTOR_UNAVAILABLE",
                "The bundled MetaTrader connector could not load. Reinstall the application.",
            )
        paths = self.terminal_path_provider()
        xm_paths = [path for path in paths if "xm" in path.casefold()]
        if len(xm_paths) == 1:
            terminal_path = xm_paths[0]
        elif len(paths) == 1:
            terminal_path = paths[0]
        elif not paths:
            if self.initialized_path is not None:
                self.mt5.shutdown()
                self.initialized_path = None
            self._lock_order_session()
            return self._state(
                "WAITING_FOR_TERMINAL",
                "Open XM MT5 and sign in there. This app never asks for your trading password.",
            )
        else:
            return self._state(
                "AMBIGUOUS_TERMINAL",
                "More than one MT5 terminal is open. Close the other terminals and leave XM MT5 open.",
            )

        if self.initialized_path != terminal_path:
            if self.initialized_path is not None:
                self.mt5.shutdown()
            self._lock_order_session()
            self.order_executor = None
            self.initialized_path = None
            if not self.mt5.initialize(path=terminal_path, timeout=5000):
                self.mt5.shutdown()
                return self._state(
                    "CONNECTING",
                    "XM MT5 is open. Waiting for its signed-in account to become available.",
                )
            self.initialized_path = terminal_path

        try:
            adapter = ReadOnlyMT5Adapter(self.mt5)
            if not include_market_watch:
                status = adapter.status()
                result = {"state": "CONNECTED_READ_ONLY", "message": "XM terminal verified; no order was submitted.", "status": status, "order_submission": False}
            else:
                result = adapter.snapshot()
            result["order_submission"] = False
            return self._attach_order_status(result)
        except AdapterError as error:
            if error.code == "TERMINAL_STATE_UNAVAILABLE":
                return self._state(
                    "WAITING_FOR_LOGIN",
                    "Sign in to your XM account in the official MT5 terminal. Your password is never handled by this app.",
                )
            if error.code == "TERMINAL_DISCONNECTED":
                return self._state(
                    "WAITING_FOR_LOGIN",
                    "XM MT5 is not connected. Sign in or reconnect in the official terminal.",
                )
            return self._state(
                "ACCOUNT_NOT_SUPPORTED",
                "The connected account could not be verified as a supported XM demo or live account. No broker data or order is enabled.",
            )


def serve_stdio(
    connector: LocalMT5Connector,
    input_stream: TextIO = sys.stdin,
    output_stream: TextIO = sys.stdout,
) -> None:
    try:
        for line in input_stream:
            try:
                request = json.loads(line)
                if isinstance(request, dict) and request.get("action") == "shutdown":
                    response = {
                        "state": "SHUTTING_DOWN",
                        "message": "The local connector is stopping.",
                        "order_submission": False,
                    }
                    output_stream.write(json.dumps(response, allow_nan=False) + "\n")
                    output_stream.flush()
                    break
                if isinstance(request, dict) and request.get("action") == "snapshot":
                    response = connector.snapshot()
                elif isinstance(request, dict) and request.get("action") in {"candle_history", "reconciliation", "quotes"}:
                    snapshot = connector.snapshot(include_market_watch=False)
                    if snapshot.get("state") != "CONNECTED_READ_ONLY":
                        response = snapshot
                        output_stream.write(json.dumps(response, allow_nan=False) + "\n")
                        output_stream.flush()
                        continue
                    if request.get("action") == "candle_history":
                        symbol, timeframe, count = request.get("symbol"), request.get("timeframe"), request.get("count", 300)
                        if not isinstance(symbol, str) or not isinstance(timeframe, str) or isinstance(count, bool) or not isinstance(count, int):
                            raise AdapterError(400, "INVALID_HISTORY_REQUEST", "Symbol, timeframe, and integer count are required.")
                        response = ReadOnlyMT5Adapter(connector.mt5).candle_history(symbol, timeframe, count)
                    elif request.get("action") == "quotes":
                        symbols = request.get("symbols")
                        if not isinstance(symbols, list) or any(not isinstance(symbol, str) for symbol in symbols):
                            raise AdapterError(400, "INVALID_SYMBOLS", "Provide an array of exact broker symbol names.")
                        response = ReadOnlyMT5Adapter(connector.mt5).quote_snapshot(symbols)
                    else:
                        response = ReadOnlyMT5Adapter(connector.mt5).reconciliation_snapshot()
                elif isinstance(request, dict) and request.get("action") == "enable_trading":
                    response = connector.enable_trading(
                        request.get("confirmation"),
                        request.get("account_mode"),
                    )
                elif isinstance(request, dict) and request.get("action") == "disable_trading":
                    response = connector.disable_trading()
                elif isinstance(request, dict) and request.get("action") == "prepare_order":
                    response = connector.prepare_order(request.get("order"))
                elif isinstance(request, dict) and request.get("action") == "submit_order":
                    response = connector.submit_order(request.get("confirmation"))
                elif not isinstance(request, dict):
                    response = {
                        "state": "ERROR",
                        "message": "Unsupported local connector request.",
                        "order_submission": False,
                    }
                else:
                    response = {
                        "state": "ERROR",
                        "message": "Unsupported or unavailable connector request.",
                        "order_submission": False,
                    }
            except AdapterError as error:
                response = {
                    "state": "ERROR",
                    "code": error.code,
                    "message": error.message,
                    "order_submission": False,
                }
            except OrderExecutionError as error:
                response = {
                    "state": "ERROR",
                    "code": error.code,
                    "message": error.message,
                    "order_submission": False,
                }
            except json.JSONDecodeError:
                response = {
                    "state": "ERROR",
                    "message": "The local connector could not verify terminal state.",
                    "order_submission": False,
                }
            except Exception:
                response = {
                    "state": "ERROR",
                    "code": "CONNECTOR_OPERATION_FAILED",
                    "message": "The local connector could not complete the request. Check broker state before retrying.",
                    "order_submission": False,
                }
            output_stream.write(json.dumps(response, allow_nan=False) + "\n")
            output_stream.flush()
    finally:
        if connector.initialized_path is not None:
            connector.mt5.shutdown()
            connector.initialized_path = None


class RateLimiter:
    def __init__(self, limit: int = 120, window_seconds: float = 60.0):
        self.limit = limit
        self.window_seconds = window_seconds
        self.count = 0
        self.window_started = 0.0

    def allow(self, now: float) -> bool:
        if now - self.window_started >= self.window_seconds:
            self.window_started = now
            self.count = 0
        self.count += 1
        return self.count <= self.limit


def make_handler(adapter: ReadOnlyMT5Adapter, token: str) -> type[BaseHTTPRequestHandler]:
    class BridgeRequestHandler(BaseHTTPRequestHandler):
        limiter = RateLimiter()

        def log_message(self, _format: str, *_args: Any) -> None:
            return

        def _send_json(self, status: int, body: dict[str, Any]) -> None:
            payload = json.dumps(body, allow_nan=False).encode("utf-8")
            origin = self.headers.get("Origin")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Pragma", "no-cache")
            self.send_header("Vary", "Origin")
            if origin in ALLOWED_ORIGINS:
                self.send_header("Access-Control-Allow-Origin", origin)
            self.end_headers()
            self.wfile.write(payload)

        def _is_allowed_origin(self) -> bool:
            origin = self.headers.get("Origin")
            return origin is None or origin in ALLOWED_ORIGINS

        def _is_allowed_host(self) -> bool:
            port = self.server.server_address[1]
            return self.headers.get("Host") in {f"127.0.0.1:{port}", f"localhost:{port}"}

        def do_OPTIONS(self) -> None:
            if not self._is_allowed_host() or not self._is_allowed_origin():
                self._send_json(403, {"error": "ORIGIN_OR_HOST_BLOCKED"})
                return
            origin = self.headers.get("Origin")
            self.send_response(204)
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Max-Age", "300")
            self.send_header("Vary", "Origin")
            self.end_headers()

        def do_GET(self) -> None:
            if not self._is_allowed_host() or not self._is_allowed_origin():
                self._send_json(403, {"error": "ORIGIN_OR_HOST_BLOCKED"})
                return
            expected = f"Bearer {token}"
            if not hmac.compare_digest(self.headers.get("Authorization", ""), expected):
                self._send_json(401, {"error": "AUTHENTICATION_REQUIRED"})
                return
            if not self.limiter.allow(time.monotonic()):
                self._send_json(429, {"error": "RATE_LIMITED"})
                return

            parsed = urlsplit(self.path)
            if parsed.path == "/v1/status":
                result = adapter.status()
            elif parsed.path == "/v1/account":
                result = adapter.account_snapshot()
            elif parsed.path == "/v1/symbols":
                query = parse_qs(parsed.query, keep_blank_values=True)
                if set(query) - {"symbol"} or len(query.get("symbol", [])) > 1:
                    self._send_json(400, {"error": "INVALID_QUERY"})
                    return
                symbols = adapter.visible_symbols(query.get("symbol", [None])[0])
                result = {"symbols": symbols, "count": len(symbols)}
            else:
                self._send_json(404, {"error": "NOT_FOUND"})
                return
            self._send_json(200, result)

        def do_POST(self) -> None:
            self._send_json(405, {"error": "METHOD_NOT_ALLOWED"})

        def do_PUT(self) -> None:
            self._send_json(405, {"error": "METHOD_NOT_ALLOWED"})

        def do_PATCH(self) -> None:
            self._send_json(405, {"error": "METHOD_NOT_ALLOWED"})

        def do_DELETE(self) -> None:
            self._send_json(405, {"error": "METHOD_NOT_ALLOWED"})

    return BridgeRequestHandler


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stdio", action="store_true")
    args = parser.parse_args()

    if args.stdio:
        try:
            import MetaTrader5 as mt5
        except ImportError:
            serve_stdio(LocalMT5Connector(None, terminal_path_provider=lambda: []))
            return 2
        serve_stdio(LocalMT5Connector(mt5))
        return 0

    token = os.environ.get("AITRADING_BRIDGE_TOKEN", "")
    if len(token) < 32:
        print("Set AITRADING_BRIDGE_TOKEN to a locally generated value of at least 32 characters.", file=sys.stderr)
        return 2

    try:
        import MetaTrader5 as mt5
    except ImportError:
        print("MetaTrader5 Python package is missing; install local-adapter/requirements.txt.", file=sys.stderr)
        return 2

    if not mt5.initialize():
        print(f"Could not initialize the already configured MT5 terminal (error {mt5.last_error()[0]}).", file=sys.stderr)
        return 3

    adapter = ReadOnlyMT5Adapter(mt5)
    try:
        adapter.status()
    except AdapterError as error:
        mt5.shutdown()
        print(f"Read-only startup check failed: {error.code}.", file=sys.stderr)
        return 4

    server = HTTPServer((HOST, PORT), make_handler(adapter, token))
    print(f"Read-only XM MT5 adapter listening on http://{HOST}:{PORT}; order submission is not implemented.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        mt5.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
