# Phase 4 — Gated Manual Demo Orders

**Status: IMPLEMENTED IN CANDIDATE SOURCE; NO XM ORDER OR FILL VERIFIED**

## Execution boundary

- Windows Tauri IPC admits only the required connector actions. The bundled local connector attaches to the already signed-in XM MT5 terminal; no login password is read or stored.
- Demo order submission requires a deliberate session activation phrase, current account/mode verification, a fresh order validation, broker `order_check`, review of the resulting terms, and explicit confirmation for each order.
- The executor persists `SUBMITTING` before the one `order_send` call, reports broker result states without synthesizing fills, and blocks new submissions when a result is unknown or interrupted.
- Session disable, account changes, and connector disconnection clear outstanding one-use review confirmations.
- Live account order preparation and submission remain hard-locked in both the connector and executor by `LIVE_RELEASE_APPROVED = False`.
- Strategy signals are not connected to the manual ticket or broker write path. Browser paper orders remain separate local simulation.

## Verification

- Frontend type-check and risk suite passed: `npm run lint`; `npm run test` (37/37).
- Adapter and fake-MT5 order suite passed: 33 tests. It exercises preflight, risk gates, order-state reporting, session gates, and live rejection using a fake API only.
- Rust native command checks passed: `cargo check --manifest-path src-tauri/Cargo.toml`.
- Packaged connector accepted its stdio actions with MT5 discovery disabled, reported `WAITING_FOR_TERMINAL`, rejected enable/prepare/submit requests without a terminal, locked the session, and shut down cleanly.
- Windows NSIS package built and the isolated install/startup/uninstall smoke test passed. The smoke test explicitly disables MT5 process discovery.
- The installer is unsigned; no publisher signing certificate was available. No live terminal was connected and no broker order was submitted.

## Not established

No XM demo order, fill, real broker result, live execution, or actual-terminal recovery behavior has been verified. Automatic recovery/clearing of unknown ledger entries, strategy-to-broker routing, 24/7 operation, and signed distribution remain unavailable or blocked. Mock tests and packaging checks do not establish production readiness or expected returns.
