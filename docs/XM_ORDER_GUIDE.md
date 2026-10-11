# XM MT5 Connection and Manual Demo Orders

## Connect the Windows app

1. Install and open the Windows app. It starts its bundled connector automatically; do not install Python or run a separate bridge.
2. Open the official XM MetaTrader 5 terminal and sign in there. The app never asks for, stores, or sends the trading password.
3. In **Connections & Settings**, wait for the terminal status to show the verified XM company, server, and account mode. The order ticket is available only inside the Windows app.

Signing in only connects the account for observation. It does not enable order submission.

## Enable and review a demo order

1. Confirm the connection is a **demo** account and that the MT5 terminal/account permits algorithmic trading.
2. In the manual ticket, type `ENABLE DEMO ORDER SUBMISSION` and select **Enable demo order submission**. This unlock applies only to the current app process and verified account.
3. Select an exact visible, fully tradable XM symbol, side, lot volume, stop loss, and take profit. The app rejects stale quotes, invalid broker terms, unavailable risk data, and unsupported symbols.
4. Select **Validate and review**. MT5's `order_check` must accept the current request. Review the fresh quote, volume, stop/target, estimated risk, margin, and broker check.
5. Deliberately confirm that individual order and select **Submit reviewed demo order**. MT5's actual response is displayed; a successful preflight is not a fill.
6. Use **Lock demo order submission** when finished. Disabling, disconnecting, or changing account invalidates pending review confirmations.

The current deterministic gates include 0.20% maximum potential stop-loss risk per order, 1.00% maximum UTC daily loss, 5.00% drawdown from the locally saved account baseline, eight daily entries, three combined open positions/orders, a fresh quote no older than 15 seconds, protected existing positions, and a free-margin buffer. Broker checks remain authoritative; these safeguards do not guarantee a fill or prevent losses.

## Live and recovery boundaries

Live login remains read-only. Live preflight and submission are blocked in both the connector and order executor until a separate release approval has been implemented; the per-order live confirmation pathway is not enabled.

The connector stores an account-keyed SQLite order ledger at `%LOCALAPPDATA%\\Ultimate AI Trading\\mt5-orders.sqlite3`. Before sending, it persists a `SUBMITTING` record. If the terminal returns no definitive result, the ledger records `UNKNOWN` and blocks further orders for that account. Check the official MT5 terminal and reconcile the outcome before any retry. This build has no in-app process to resolve or clear an ambiguous ledger record; a restart or machine failure may therefore require support before the ticket can be used again.

## Verification limits

Unit tests use a fake MT5 API and send no broker orders. The installer smoke test disables MT5 process discovery and does not connect to a terminal. No XM demo order, actual fill, live order, restart recovery, or unattended operation has been verified. The ticket is manual only; strategy signals and paper simulation do not submit broker orders or make profitability claims.
