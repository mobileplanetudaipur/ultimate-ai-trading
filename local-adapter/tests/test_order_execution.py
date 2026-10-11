from __future__ import annotations

import tempfile
import unittest
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

sys_path = str(Path(__file__).resolve().parents[1])
import sys

if sys_path not in sys.path:
    sys.path.insert(0, sys_path)

from order_execution import MT5OrderExecutor, OrderExecutionError
from bridge import LocalMT5Connector, serve_stdio


class FakeMT5:
    DEAL_ENTRY_IN = 0
    DEAL_ENTRY_INOUT = 2
    ORDER_TYPE_BUY = 0
    ORDER_TYPE_SELL = 1
    ORDER_FILLING_FOK = 0
    ORDER_FILLING_IOC = 1
    ORDER_FILLING_RETURN = 2
    ORDER_TIME_GTC = 0
    SYMBOL_TRADE_EXECUTION_MARKET = 2
    SYMBOL_TRADE_MODE_FULL = 4
    TRADE_ACTION_DEAL = 1
    TRADE_RETCODE_DONE = 10009
    TRADE_RETCODE_DONE_PARTIAL = 10010
    TRADE_RETCODE_PLACED = 10008

    def __init__(self):
        self.terminal = SimpleNamespace(connected=True, trade_allowed=True, tradeapi_disabled=False)
        self.account = SimpleNamespace(
            company="XM Global Limited",
            server="XMGlobal-MT5 Demo 9",
            trade_mode=0,
            currency="USD",
            trade_allowed=True,
            trade_expert=True,
            balance=10000.0,
            equity=10000.0,
            margin_free=9000.0,
            login=123456,
        )
        self.info = SimpleNamespace(
            name="GBPUSD#",
            visible=True,
            trade_mode=4,
            digits=5,
            point=0.00001,
            trade_stops_level=0,
            volume_min=0.01,
            volume_max=50.0,
            volume_step=0.01,
            trade_contract_size=100000.0,
            filling_mode=2,
            trade_exemode=2,
        )
        self.tick = SimpleNamespace(
            bid=1.1,
            ask=1.1002,
            time_msc=int(datetime.now(timezone.utc).timestamp() * 1000),
        )
        self.check_retcode = 0
        self.send_result = SimpleNamespace(
            retcode=self.TRADE_RETCODE_DONE,
            order=11,
            deal=12,
            comment="Request executed",
            volume=0.01,
            price=1.1002,
            bid=1.1,
            ask=1.1002,
            request_id=17,
        )
        self.orders_sent = []
        self.raise_on_send = False
        self.initialize_calls = []
        self.shutdown_calls = 0

    def initialize(self, **kwargs):
        self.initialize_calls.append(kwargs)
        return True

    def shutdown(self):
        self.shutdown_calls += 1

    def terminal_info(self):
        return self.terminal

    def account_info(self):
        return self.account

    def symbol_info(self, symbol):
        return self.info if symbol == self.info.name else None

    def symbol_info_tick(self, symbol):
        return self.tick if symbol == self.info.name else None

    def order_calc_profit(self, order_type, _symbol, volume, price, close):
        direction = 1 if order_type == self.ORDER_TYPE_BUY else -1
        return (close - price) * 100000 * volume * direction

    def order_calc_margin(self, _order_type, _symbol, volume, price):
        return 100000 * volume * price / 100

    def positions_get(self):
        return ()

    def orders_get(self):
        return ()

    def history_deals_get(self, *_args):
        return ()

    def order_check(self, _request):
        return SimpleNamespace(retcode=self.check_retcode, comment="Preflight")

    def order_send(self, request):
        self.orders_sent.append(request)
        if self.raise_on_send:
            raise OSError("connection lost")
        return self.send_result


class OrderExecutionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        self.mt5 = FakeMT5()
        self.executor = MT5OrderExecutor(self.mt5, Path(self.temp.name) / "orders.sqlite3")
        self.payload = {
            "client_order_id": "client-order-000001",
            "symbol": "GBPUSD#",
            "side": "BUY",
            "volume": 0.01,
            "stop_loss": 1.099,
            "take_profit": 1.102,
        }

    def tearDown(self):
        self.temp.cleanup()

    def _prepare(self, live_enabled=True):
        return self.executor.prepare_order(self.payload, session_enabled=live_enabled)

    def _submit(self, prepared, *, confirm_order=True, confirm_live=False, live_enabled=True):
        return self.executor.submit_order(
            prepared["confirmation_id"],
            confirm_order,
            confirm_live,
            session_enabled=live_enabled,
        )

    def test_demo_requires_session_enable_and_explicit_order_confirmation(self):
        with self.assertRaises(OrderExecutionError) as error:
            self._prepare(live_enabled=False)
        self.assertEqual(error.exception.code, "ORDER_SUBMISSION_LOCKED")
        self.assertEqual(self.mt5.orders_sent, [])

        prepared = self._prepare()
        self.assertEqual(prepared["state"], "ORDER_PREPARED")
        self.assertFalse(prepared["order_submission"])
        self.assertEqual(self.mt5.orders_sent, [])
        with self.assertRaises(OrderExecutionError) as error:
            self._submit(prepared, confirm_order=False)
        self.assertEqual(error.exception.code, "ORDER_CONFIRMATION_REQUIRED")
        self.assertEqual(self.mt5.orders_sent, [])

        result = self._submit(prepared)
        self.assertEqual(result["state"], "FILLED")
        self.assertTrue(result["order_submission"])
        self.assertEqual(result["broker_result"]["deal_ticket"], 12)
        self.assertEqual(len(self.mt5.orders_sent), 1)

    def test_live_release_gate_blocks_preflight_and_submission(self):
        self.mt5.account.trade_mode = 2
        self.mt5.account.server = "XMGlobal-MT5 9"
        with self.assertRaises(OrderExecutionError) as error:
            self._prepare(live_enabled=False)
        self.assertEqual(error.exception.code, "LIVE_RELEASE_NOT_APPROVED")
        with self.assertRaises(OrderExecutionError) as enabled_error:
            self._prepare()
        self.assertEqual(enabled_error.exception.code, "LIVE_RELEASE_NOT_APPROVED")
        self.assertEqual(self.mt5.orders_sent, [])

    def test_preflight_rejection_never_sends(self):
        self.mt5.check_retcode = 10030
        with self.assertRaises(OrderExecutionError) as error:
            self._prepare()
        self.assertEqual(error.exception.code, "BROKER_PREFLIGHT_REJECTED")
        self.assertEqual(self.mt5.orders_sent, [])

    def test_expired_and_account_changed_confirmations_never_send(self):
        prepared = self._prepare()
        self.executor._confirmations[prepared["confirmation_id"]]["expires_at"] = datetime.min.replace(tzinfo=timezone.utc)
        with self.assertRaises(OrderExecutionError) as error:
            self._submit(prepared)
        self.assertEqual(error.exception.code, "CONFIRMATION_EXPIRED")

        prepared = self._prepare()
        self.mt5.account.login = 654321
        with self.assertRaises(OrderExecutionError) as error:
            self._submit(prepared)
        self.assertEqual(error.exception.code, "ACCOUNT_CHANGED")
        self.assertEqual(self.mt5.orders_sent, [])

    def test_broker_states_are_truthful_and_confirmation_is_one_use(self):
        self.mt5.send_result = SimpleNamespace(retcode=10008, order=21, deal=0, comment="Placed")
        prepared = self._prepare()
        result = self._submit(prepared)
        self.assertEqual(result["state"], "PLACED")
        self.assertEqual(result["broker_result"]["order_ticket"], 21)

        with self.assertRaises(OrderExecutionError) as error:
            self._submit(prepared)
        self.assertEqual(error.exception.code, "CONFIRMATION_EXPIRED")

        self.mt5.send_result = SimpleNamespace(retcode=10010, order=31, deal=32, comment="Partial")
        self.payload["client_order_id"] = "client-order-000002"
        partial = self._submit(self._prepare())
        self.assertEqual(partial["state"], "PARTIALLY_FILLED")

        self.mt5.send_result = SimpleNamespace(retcode=10006, order=0, deal=0, comment="Rejected")
        self.payload["client_order_id"] = "client-order-000003"
        rejected = self._submit(self._prepare())
        self.assertEqual(rejected["state"], "REJECTED")
        self.assertTrue(rejected["order_submission"])

    def test_unknown_send_result_blocks_all_new_orders(self):
        self.mt5.send_result = None
        result = self._submit(self._prepare())
        self.assertEqual(result["state"], "UNKNOWN")
        self.assertTrue(result["order_submission"])
        with self.assertRaises(OrderExecutionError) as error:
            self._prepare()
        self.assertEqual(error.exception.code, "ORDER_RECOVERY_REQUIRED")
        self.assertEqual(len(self.mt5.orders_sent), 1)

    def test_exception_during_send_is_reported_unknown_and_blocks_retry(self):
        self.mt5.raise_on_send = True
        result = self._submit(self._prepare())
        self.assertEqual(result["state"], "UNKNOWN")
        self.assertTrue(result["order_submission"])
        with self.assertRaises(OrderExecutionError) as error:
            self._prepare()
        self.assertEqual(error.exception.code, "ORDER_RECOVERY_REQUIRED")
        self.assertEqual(len(self.mt5.orders_sent), 1)

    def test_stale_quote_and_unsupported_broker_fail_closed(self):
        self.mt5.tick.time_msc -= 60_000
        with self.assertRaises(OrderExecutionError) as error:
            self._prepare()
        self.assertEqual(error.exception.code, "QUOTE_NOT_FRESH")
        self.assertEqual(self.mt5.orders_sent, [])

        self.mt5.tick.time_msc = int(datetime.now(timezone.utc).timestamp() * 1000)
        self.mt5.account.company = "Other Broker"
        with self.assertRaises(OrderExecutionError) as broker_error:
            self._prepare()
        self.assertEqual(broker_error.exception.code, "UNVERIFIED_BROKER")
        self.assertEqual(self.mt5.orders_sent, [])

    def test_stdio_gates_demo_orders_and_rejects_live_activation(self):
        connector = LocalMT5Connector(
            self.mt5,
            terminal_path_provider=lambda: [r"C:\XM\terminal64.exe"],
            order_ledger_path=Path(self.temp.name) / "stdio-orders.sqlite3",
        )
        for method in ("enable_trading", "disable_trading", "prepare_order", "submit_order"):
            self.assertTrue(callable(getattr(connector, method)))

        requests = [
            {
                "action": "enable_trading",
                "account_mode": "DEMO",
                "confirmation": "wrong phrase",
            },
            {
                "action": "enable_trading",
                "account_mode": "DEMO",
                "confirmation": "ENABLE DEMO ORDER SUBMISSION",
            },
            {"action": "prepare_order", "order": self.payload},
        ]
        request_output = io.StringIO()

        def request_lines():
            for request in requests:
                yield json.dumps(request) + "\n"
            prepared_response = json.loads(request_output.getvalue().splitlines()[2])
            yield json.dumps({
                "action": "submit_order",
                "confirmation": {
                    "confirmation_id": prepared_response["confirmation_id"],
                    "confirm_order": True,
                    "confirm_live": False,
                },
            }) + "\n"

        serve_stdio(
            connector,
            request_lines(),
            request_output,
        )
        responses = [json.loads(line) for line in request_output.getvalue().splitlines()]
        self.assertEqual(responses[0]["state"], "ERROR")
        self.assertEqual(responses[1]["state"], "DEMO_ORDER_SUBMISSION_ENABLED_FOR_SESSION")
        prepared = responses[2]
        self.assertEqual(prepared["state"], "ORDER_PREPARED")
        self.assertFalse(prepared["order_submission"])
        self.assertEqual(responses[3]["state"], "FILLED")
        self.assertEqual(len(self.mt5.orders_sent), 1)

        self.mt5.account.trade_mode = 2
        self.mt5.account.server = "XMGlobal-MT5 9"
        live_connector = LocalMT5Connector(
            self.mt5,
            terminal_path_provider=lambda: [r"C:\XM\terminal64.exe"],
            order_ledger_path=Path(self.temp.name) / "live-orders.sqlite3",
        )
        with self.assertRaises(OrderExecutionError) as live_error:
            live_connector.enable_trading("ENABLE LIVE ORDER SUBMISSION", "LIVE")
        self.assertEqual(live_error.exception.code, "LIVE_RELEASE_NOT_APPROVED")
        self.assertEqual(len(self.mt5.orders_sent), 1)


if __name__ == "__main__":
    unittest.main()
