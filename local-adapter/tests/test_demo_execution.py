from __future__ import annotations

import tempfile
import unittest
import io
import json
from datetime import datetime, timezone
from pathlib import Path
import sys
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from demo_execution import DemoExecutionAdapter, DemoExecutionError
from bridge import LocalMT5Connector, serve_stdio


class FakeMT5:
    ORDER_TYPE_BUY = 0
    ORDER_TYPE_SELL = 1
    ORDER_FILLING_FOK = 0
    ORDER_FILLING_IOC = 1
    ORDER_FILLING_RETURN = 2
    TRADE_ACTION_DEAL = 1
    ORDER_TIME_GTC = 0
    SYMBOL_TRADE_MODE_FULL = 4
    SYMBOL_TRADE_EXECUTION_MARKET = 2
    TRADE_RETCODE_DONE = 10009
    TRADE_RETCODE_PLACED = 10008
    TRADE_RETCODE_DONE_PARTIAL = 10010
    DEAL_ENTRY_IN = 0
    DEAL_ENTRY_INOUT = 2

    def __init__(self):
        self.terminal = SimpleNamespace(connected=True, trade_allowed=True, tradeapi_disabled=False)
        self.account = SimpleNamespace(
            company="XM Global Limited", server="XMGlobal-MT5 Demo 9", trade_mode=0,
            currency="USD", trade_allowed=True, trade_expert=True, balance=10000.0,
            equity=10000.0, margin_free=9000.0, leverage=100, login=123456,
        )
        self.info = SimpleNamespace(
            name="GBPUSD#", visible=True, trade_mode=4, digits=5, point=0.00001,
            trade_stops_level=0, volume_min=0.01, volume_max=50.0, volume_step=0.01,
            trade_contract_size=100000.0, currency_base="GBP", currency_profit="USD",
            filling_mode=2, trade_exemode=2,
        )
        self.tick = SimpleNamespace(
            bid=1.1, ask=1.1002,
            time_msc=int(datetime.now(timezone.utc).timestamp() * 1000),
        )
        self.orders_sent = []
        self.check_retcode = 0
        self.send_result = SimpleNamespace(retcode=10009, order=11, deal=12)
        self.positions = ()
        self.orders = ()
        self.history_orders = ()
        self.history_deals = ()
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

    def history_deals_get(self, *_args):
        return self.history_deals

    def history_orders_get(self, *_args):
        return self.history_orders

    def positions_get(self):
        return self.positions

    def orders_get(self):
        return self.orders

    def order_calc_profit(self, order_type, _symbol, volume, price, close):
        direction = 1 if order_type == self.ORDER_TYPE_BUY else -1
        return (close - price) * 100000 * volume * direction

    def order_calc_margin(self, _order_type, _symbol, volume, price):
        return 100000 * volume * price / 100

    def order_check(self, _request):
        return SimpleNamespace(retcode=self.check_retcode)

    def order_send(self, request):
        self.orders_sent.append(request)
        return self.send_result


class DemoExecutionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        self.mt5 = FakeMT5()
        self.adapter = DemoExecutionAdapter(self.mt5, Path(self.temp.name) / "orders.sqlite3")
        self.payload = {
            "client_order_id": "order-client-id-0001",
            "strategy_id": "strat_donchian_breakout",
            "signal_bar_time": int(datetime.now(timezone.utc).timestamp() * 1000) - 60_000,
            "symbol": "GBPUSD#",
            "side": "BUY",
            "stop_loss": 1.099,
            "take_profit": 1.102,
        }

    def tearDown(self):
        self.temp.cleanup()

    def test_demo_order_uses_broker_sized_volume_and_is_idempotent(self):
        first = self.adapter.place_order(self.payload)
        second = self.adapter.place_order(self.payload)
        self.assertEqual(first["state"], "COMPLETED")
        self.assertTrue(first["order_submission"])
        self.assertEqual(first["strategy_id"], "strat_donchian_breakout")
        self.assertLessEqual(first["risk_estimate_account_currency"], 20.0)
        self.assertEqual(len(self.mt5.orders_sent), 1)
        self.assertTrue(second["duplicate_replay"])

    def test_real_account_is_rejected_before_order_check_or_send(self):
        self.mt5.account.trade_mode = 2
        with self.assertRaises(DemoExecutionError) as error:
            self.adapter.place_order(self.payload)
        self.assertEqual(error.exception.code, "DEMO_ACCOUNT_REQUIRED")
        self.assertEqual(self.mt5.orders_sent, [])

    def test_stale_tick_is_rejected(self):
        self.mt5.tick.time_msc -= 60_000
        with self.assertRaises(DemoExecutionError) as error:
            self.adapter.place_order(self.payload)
        self.assertEqual(error.exception.code, "QUOTE_NOT_FRESH")
        self.assertEqual(self.mt5.orders_sent, [])

    def test_minimum_lot_that_exceeds_risk_is_rejected(self):
        self.payload["stop_loss"] = 1.0
        with self.assertRaises(DemoExecutionError) as error:
            self.adapter.place_order(self.payload)
        self.assertEqual(error.exception.code, "MINIMUM_VOLUME_EXCEEDS_RISK")
        self.assertEqual(self.mt5.orders_sent, [])

    def test_only_m15_donchian_strategy_can_submit_demo_order(self):
        self.payload["strategy_id"] = "strat_bb_mean_reversion"
        with self.assertRaises(DemoExecutionError) as error:
            self.adapter.place_order(self.payload)
        self.assertEqual(error.exception.code, "STRATEGY_NOT_ENABLED")
        self.assertEqual(self.mt5.orders_sent, [])

    def test_wrong_strategy_symbol_and_stale_signal_bar_are_rejected(self):
        self.mt5.info.currency_base = "EUR"
        with self.assertRaises(DemoExecutionError) as error:
            self.adapter.place_order(self.payload)
        self.assertEqual(error.exception.code, "STRATEGY_SYMBOL_MISMATCH")
        self.assertEqual(self.mt5.orders_sent, [])

        self.payload["signal_bar_time"] -= 16 * 60 * 1000
        with self.assertRaises(DemoExecutionError) as stale_error:
            self.adapter.place_order(self.payload)
        self.assertEqual(stale_error.exception.code, "STALE_SIGNAL_BAR")
        self.assertEqual(self.mt5.orders_sent, [])

    def test_broker_preflight_rejection_never_sends_order(self):
        self.mt5.check_retcode = 10030
        with self.assertRaises(DemoExecutionError) as error:
            self.adapter.place_order(self.payload)
        self.assertEqual(error.exception.code, "BROKER_PREFLIGHT_REJECTED")
        self.assertEqual(self.mt5.orders_sent, [])

    def test_unknown_send_outcome_cannot_be_retried_as_new_order(self):
        self.mt5.send_result = None
        with self.assertRaises(DemoExecutionError) as error:
            self.adapter.place_order(self.payload)
        self.assertEqual(error.exception.code, "ORDER_STATE_UNKNOWN")
        with self.assertRaises(DemoExecutionError) as retry_error:
            self.adapter.place_order(self.payload)
        self.assertEqual(retry_error.exception.code, "ORDER_STATE_UNKNOWN")
        self.assertEqual(len(self.mt5.orders_sent), 1)

    def test_stdio_rejects_all_broker_order_controls_for_demo_and_live(self):
        for account_mode in ("DEMO", "LIVE"):
            with self.subTest(account_mode=account_mode):
                mt5 = FakeMT5()
                if account_mode == "LIVE":
                    mt5.account.trade_mode = 2
                connector = LocalMT5Connector(
                    mt5,
                    terminal_path_provider=lambda: [r"C:\XM\terminal64.exe"],
                )
                requests = [
                    {"action": "arm_demo"},
                    {"action": "place_demo_order", "order": self.payload},
                    {"action": "disarm_demo"},
                    {"action": "shutdown"},
                ]
                output_stream = io.StringIO()
                serve_stdio(
                    connector,
                    io.StringIO("".join(json.dumps(item) + "\n" for item in requests)),
                    output_stream,
                )
                responses = [json.loads(line) for line in output_stream.getvalue().splitlines()]
                self.assertEqual([item["state"] for item in responses[:3]], ["ERROR"] * 3)
                self.assertTrue(all(item["order_submission"] is False for item in responses[:3]))
                self.assertEqual(responses[3]["state"], "SHUTTING_DOWN")
                self.assertEqual(mt5.orders_sent, [])

if __name__ == "__main__":
    unittest.main()
