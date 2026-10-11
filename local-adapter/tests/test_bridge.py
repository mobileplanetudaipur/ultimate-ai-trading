from __future__ import annotations

import json
import io
import sys
import threading
import unittest
import time
import tempfile
from datetime import datetime, timezone
from http.client import HTTPConnection
from http.server import HTTPServer
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from bridge import (
    AdapterError,
    LocalMT5Connector,
    ReadOnlyMT5Adapter,
    make_handler,
    serve_stdio,
)

TOKEN = "test-token-" + ("x" * 40)


class FakeMT5:
    def __init__(self, trade_mode: int = 0, connected: bool = True):
        self.terminal = SimpleNamespace(
            connected=connected,
            trade_allowed=False,
            tradeapi_disabled=False,
        )
        self.account = SimpleNamespace(
            company="XM Global Limited",
            server="XMGlobal-MT5 9",
            trade_mode=trade_mode,
            currency="USD",
            trade_allowed=True,
            trade_expert=True,
            balance=10000.0,
            equity=10000.0,
            profit=0.0,
            margin=0.0,
            margin_free=10000.0,
            margin_level=0.0,
            leverage=100,
        )
        self.symbol = SimpleNamespace(
            name="EURUSD#",
            description="Euro vs US Dollar",
            visible=True,
            trade_mode=4,
            digits=5,
            point=0.00001,
            trade_contract_size=100000.0,
            trade_tick_size=0.00001,
            trade_tick_value_profit=1.0,
            trade_tick_value_loss=1.0,
            volume_min=0.01,
            volume_max=50.0,
            volume_step=0.01,
            trade_stops_level=0,
            trade_freeze_level=0,
            margin_initial=0.0,
            margin_maintenance=0.0,
            currency_base="EUR",
            currency_profit="USD",
            currency_margin="EUR",
            trade_exemode=2,
            filling_mode=3,
        )
        self.tick = SimpleNamespace(
            time_msc=int(datetime.now(timezone.utc).timestamp() * 1000),
            bid=1.1,
            ask=1.1002,
        )
        self.initialize_calls = []
        self.shutdown_calls = 0
        self.history_request = None
        self.TIMEFRAME_M15 = 15
        self.rates = [
            {"time": int(time.time()) - 900, "open": 1.0, "high": 1.2, "low": 0.9, "close": 1.1, "tick_volume": 20},
            {"time": int(time.time()), "open": 1.1, "high": 1.3, "low": 1.0, "close": 1.2, "tick_volume": 25},
        ]

    def initialize(self, **kwargs):
        self.initialize_calls.append(kwargs)
        return True

    def shutdown(self):
        self.shutdown_calls += 1

    def terminal_info(self):
        return self.terminal

    def account_info(self):
        return self.account

    def symbols_get(self):
        return [self.symbol]

    def symbol_info(self, name: str):
        return self.symbol if name == self.symbol.name else None

    def symbol_info_tick(self, name: str):
        return self.tick if name == self.symbol.name else None

    def copy_rates_from_pos(self, name, timeframe, start, count):
        self.history_request = (name, timeframe, start, count)
        return self.rates if name == self.symbol.name and timeframe == self.TIMEFRAME_M15 else None

    def positions_get(self): return []
    def orders_get(self): return []
    def history_orders_get(self, start, end): return []
    def history_deals_get(self, start, end): return []


class AdapterTests(unittest.TestCase):
    def _connector(self, fake, terminal_path_provider):
        temp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        self.addCleanup(temp.cleanup)
        return LocalMT5Connector(
            fake,
            terminal_path_provider=terminal_path_provider,
            order_ledger_path=Path(temp.name) / "orders.sqlite3",
        )

    def test_connector_waits_for_existing_terminal_without_starting_one(self):
        fake = FakeMT5()
        connector = self._connector(fake, terminal_path_provider=lambda: [])

        result = connector.snapshot()

        self.assertEqual(result["state"], "WAITING_FOR_TERMINAL")
        self.assertFalse(result["order_submission"])
        self.assertEqual(fake.initialize_calls, [])

    def test_connector_attaches_to_existing_demo_terminal_and_returns_real_snapshot(self):
        fake = FakeMT5()
        path = r"C:\Program Files\XM Global MT5\terminal64.exe"
        connector = self._connector(fake, terminal_path_provider=lambda: [path])

        result = connector.snapshot()

        self.assertEqual(result["state"], "CONNECTED_READ_ONLY")
        self.assertFalse(result["order_submission"])
        self.assertEqual(fake.initialize_calls, [{"path": path, "timeout": 5000}])
        self.assertEqual(result["status"]["server"], "XMGlobal-MT5 9")
        self.assertEqual(result["account"]["balance"], 10000.0)
        self.assertEqual(result["symbols"][0]["symbol"], "EURUSD#")
        self.assertEqual(result["symbols"][0]["currency_base"], "EUR")

    def test_connector_rejects_ambiguous_or_unsupported_terminals(self):
        fake = FakeMT5()
        paths = [
            r"C:\Program Files\MetaTrader 5\terminal64.exe",
            r"C:\Program Files\Other MT5\terminal64.exe",
        ]
        connector = self._connector(fake, terminal_path_provider=lambda: paths)

        self.assertEqual(connector.snapshot()["state"], "AMBIGUOUS_TERMINAL")
        self.assertEqual(fake.initialize_calls, [])

        fake.account.trade_mode = 1
        connector = self._connector(fake, terminal_path_provider=lambda: [r"C:\XM\terminal64.exe"])
        result = connector.snapshot()
        self.assertEqual(result["state"], "ACCOUNT_NOT_SUPPORTED")
        self.assertNotIn("account", result)
        self.assertFalse(result["order_submission"])

    def test_connector_attaches_to_live_account_read_only(self):
        fake = FakeMT5(trade_mode=2)
        fake.account.server = "XMGlobal-MT5 Real 9"
        connector = self._connector(fake, terminal_path_provider=lambda: [r"C:\XM\terminal64.exe"])

        result = connector.snapshot()

        self.assertEqual(result["state"], "CONNECTED_READ_ONLY")
        self.assertEqual(result["status"]["account_mode"], "LIVE")
        self.assertEqual(result["account"]["account_mode"], "LIVE")
        self.assertFalse(result["order_submission"])

    def test_stdio_protocol_serves_read_only_data_and_rejects_order_action(self):
        fake = FakeMT5()
        connector = self._connector(fake, terminal_path_provider=lambda: [r"C:\XM\terminal64.exe"])
        input_stream = io.StringIO('{"action":"snapshot"}\n{"action":"candle_history","symbol":"EURUSD#","timeframe":"M15","count":2}\n{"action":"reconciliation"}\n{"action":"arm_demo"}\n{"action":"place_demo_order"}\n{"action":"disarm_demo"}\n{"action":"enable_trading"}\n{"action":"disable_trading"}\n{"action":"prepare_order"}\n{"action":"submit_order"}\n')
        output_stream = io.StringIO()

        serve_stdio(connector, input_stream, output_stream)

        responses = [json.loads(line) for line in output_stream.getvalue().splitlines()]
        self.assertEqual(responses[0]["state"], "CONNECTED_READ_ONLY")
        self.assertFalse(responses[0]["order_submission"])
        self.assertEqual(responses[1]["symbol"], "EURUSD#")
        self.assertEqual(len(responses[1]["candles"]), 2)
        self.assertTrue(responses[2]["complete"])
        self.assertEqual(
            [item["state"] for item in responses[3:]],
            ["ERROR", "ERROR", "ERROR", "ERROR", "ORDER_SUBMISSION_LOCKED", "ERROR", "ERROR"],
        )
        self.assertTrue(all(item["order_submission"] is False for item in responses[3:]))
        self.assertTrue(all("order" not in item for item in responses[3:]))
        self.assertEqual(fake.shutdown_calls, 1)

    def test_accepts_verified_demo_and_live_accounts_as_read_only(self):
        for trade_mode, expected_mode in [(0, "DEMO"), (2, "LIVE")]:
            with self.subTest(expected_mode=expected_mode):
                result = ReadOnlyMT5Adapter(FakeMT5(trade_mode=trade_mode)).snapshot()
                self.assertEqual(result["status"]["account_mode"], expected_mode)
                self.assertEqual(result["account"]["account_mode"], expected_mode)
                self.assertFalse(result["order_submission"])

    def test_rejects_unsupported_account_modes_and_wrong_broker_accounts(self):
        for fake, expected in [
            (FakeMT5(trade_mode=1), "UNSUPPORTED_ACCOUNT_MODE"),
            (FakeMT5(), None),
        ]:
            if expected is None:
                fake.account.company = "Other Broker"
                expected = "UNEXPECTED_BROKER"
            with self.subTest(expected=expected):
                with self.assertRaises(AdapterError) as error:
                    ReadOnlyMT5Adapter(fake).status()
                self.assertEqual(error.exception.code, expected)

    def test_reports_exact_visible_symbols_and_freshness(self):
        result = ReadOnlyMT5Adapter(FakeMT5()).visible_symbols()
        self.assertEqual(result[0]["symbol"], "EURUSD#")
        self.assertEqual(result[0]["freshness"], "FRESH")
        self.assertEqual(result[0]["contract_size"], 100000.0)

    def test_quote_refresh_reads_only_exact_requested_names_and_reports_mode(self):
        result = ReadOnlyMT5Adapter(FakeMT5()).quote_snapshot(["EURUSD#"])
        self.assertEqual(result["account_mode"], "DEMO")
        self.assertEqual([item["symbol"] for item in result["symbols"]], ["EURUSD#"])
        with self.assertRaises(AdapterError):
            ReadOnlyMT5Adapter(FakeMT5()).quote_snapshot(["EURUSD"])

    def test_quote_refresh_reports_current_demo_or_live_mode_without_order_access(self):
        for trade_mode, expected_mode in [(0, "DEMO"), (2, "LIVE")]:
            with self.subTest(expected_mode=expected_mode):
                result = ReadOnlyMT5Adapter(FakeMT5(trade_mode=trade_mode)).quote_snapshot(["EURUSD#"])
                self.assertEqual(result["account_mode"], expected_mode)
                self.assertEqual(result["symbols"][0]["symbol"], "EURUSD#")
                self.assertFalse(result["order_submission"])

    def test_reads_bounded_candle_history_using_exact_broker_symbol(self):
        adapter = ReadOnlyMT5Adapter(FakeMT5())
        history = adapter.candle_history("EURUSD#", "M15", 2)
        self.assertEqual(history["symbol"], "EURUSD#")
        self.assertEqual(history["provider"], "XM MetaTrader 5 terminal")
        self.assertEqual([bar["close"] for bar in history["candles"]], [1.1, 1.2])
        self.assertEqual(adapter.mt5.history_request[2], 1, "Forming bar must be excluded from strategy history")
        with self.assertRaises(AdapterError):
            adapter.candle_history("EURUSD", "M15", 2)
        with self.assertRaises(AdapterError):
            adapter.candle_history("EURUSD#", "W1", 2)

    def test_reconciliation_fails_closed_when_broker_collection_is_missing(self):
        result = ReadOnlyMT5Adapter(FakeMT5()).reconciliation_snapshot()
        self.assertTrue(result["complete"])
        self.assertFalse(result["order_submission"])
        fake = FakeMT5()
        fake.history_deals_get = lambda *_args: None
        with self.assertRaises(AdapterError) as error:
            ReadOnlyMT5Adapter(fake).reconciliation_snapshot()
        self.assertEqual(error.exception.code, "RECONCILIATION_INCOMPLETE")

    def test_marks_stale_and_future_ticks_unusable(self):
        fake = FakeMT5()
        fake.tick.time_msc -= 60_000
        stale = ReadOnlyMT5Adapter(fake).visible_symbols()[0]
        self.assertEqual(stale["freshness"], "STALE")

        fake.tick.time_msc += 120_000
        future = ReadOnlyMT5Adapter(fake).visible_symbols()[0]
        self.assertEqual(future["freshness"], "FUTURE_TIMESTAMP")

        fake.tick.time_msc = int(datetime.now(timezone.utc).timestamp() * 1000)
        fake.tick.bid = 0.0
        invalid = ReadOnlyMT5Adapter(fake).visible_symbols()[0]
        self.assertEqual(invalid["freshness"], "INVALID")

        fake.tick.bid = 1.1
        fake.tick.ask = 1.09
        crossed = ReadOnlyMT5Adapter(fake).visible_symbols()[0]
        self.assertEqual(crossed["freshness"], "INVALID")

    def test_rejects_unknown_or_hidden_exact_symbol_without_substitution(self):
        fake = FakeMT5()
        adapter = ReadOnlyMT5Adapter(fake)
        with self.assertRaises(AdapterError) as error:
            adapter.visible_symbols("EUR/USD")
        self.assertEqual(error.exception.code, "SYMBOL_NOT_VISIBLE")

    def test_http_api_requires_auth_and_has_no_order_route(self):
        server = HTTPServer(
            ("127.0.0.1", 0),
            make_handler(ReadOnlyMT5Adapter(FakeMT5()), TOKEN),
        )
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        port = server.server_address[1]
        try:
            connection = HTTPConnection("127.0.0.1", port)
            connection.request("GET", "/v1/status", headers={"Host": f"127.0.0.1:{port}"})
            response = connection.getresponse()
            self.assertEqual(response.status, 401)
            response.read()
            connection.close()

            connection = HTTPConnection("127.0.0.1", port)
            connection.request(
                "GET",
                "/v1/status",
                headers={
                    "Host": f"127.0.0.1:{port}",
                    "Authorization": "Bearer wrong-token",
                    "Origin": "http://127.0.0.1:3000",
                },
            )
            response = connection.getresponse()
            self.assertEqual(response.status, 401)
            response.read()
            connection.close()

            connection = HTTPConnection("127.0.0.1", port)
            connection.request(
                "GET",
                "/v1/status",
                headers={
                    "Host": f"127.0.0.1:{port}",
                    "Authorization": f"Bearer {TOKEN}",
                    "Origin": "http://malicious.example",
                },
            )
            response = connection.getresponse()
            self.assertEqual(response.status, 403)
            response.read()
            connection.close()

            connection = HTTPConnection("127.0.0.1", port)
            connection.request(
                "GET",
                "/v1/status",
                headers={
                    "Host": f"127.0.0.1:{port}",
                    "Authorization": f"Bearer {TOKEN}",
                    "Origin": "http://127.0.0.1:3000",
                },
            )
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            status = json.loads(response.read())
            self.assertEqual(status["state"], "CONNECTED_READ_ONLY")
            self.assertFalse(status["order_submission"])
            connection.close()

            connection = HTTPConnection("127.0.0.1", port)
            connection.request(
                "POST",
                "/v1/orders",
                headers={
                    "Host": f"127.0.0.1:{port}",
                    "Authorization": f"Bearer {TOKEN}",
                },
            )
            response = connection.getresponse()
            self.assertEqual(response.status, 405)
            connection.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
