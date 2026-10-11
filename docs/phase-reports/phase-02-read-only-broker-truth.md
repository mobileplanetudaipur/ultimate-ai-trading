# Phase 2 — Read-Only Broker Truth

**Status: READ-ONLY ADAPTER IMPLEMENTED; FRESH MARKET-DATA VERIFICATION BLOCKED**

## Evidence

The user selected the already signed-in XM MT5 demo terminal on the local Windows machine, read-only and without order submission. `local-adapter/bridge.py` now exposes authenticated localhost-only GET endpoints for terminal status, demo-account summary, and exact visible symbol metadata/quotes. It rejects non-XM/non-demo terminal state, binds to `127.0.0.1`, and does not implement order/position mutation. The UI displays these observations separately from the simulated strategy feed. `src/services/marketDataService.ts` continues to generate local synthetic quotes/candles; `src/services/brokerGateway.ts` remains `NOT_IMPLEMENTED` for order execution.

At the latest local terminal inspection, the connected company/server identified XM and account mode was DEMO. The terminal reported trade permissions, but these are informational only and the adapter remains read-only. Symbol variants exist (including suffixed exact names), so no aliasing or substitutions are made. Quote observations included stale timestamps and a future timestamp; they cannot be treated as fresh market data. No account login identifier or financial snapshot is stored in this report.

The `demo_pending` mode remains explicitly unavailable and blocked by the risk engine. The adapter does not establish strategy readiness or authorize trading.

## Safety boundary and next action

Recheck the terminal while it is receiving current quotes, confirm the exact intended visible symbols and their current metadata, and establish a verified symbol map before considering any market-data use. Keep MT5 data out of strategy/risk/order paths until separately authorized and tested. Order execution remains local simulation only; the read-only adapter is not demo-trading readiness.

Do not request credentials in chat, persist the local bridge token, expose the adapter beyond loopback, or enable order submission.
