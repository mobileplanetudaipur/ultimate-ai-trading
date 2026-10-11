# Ultimate AI Trading

A browser-based trading research and paper-simulation dashboard. The app demonstrates market monitoring, strategy evaluation, deterministic risk checks, simulated order lifecycles, and local recovery checkpoints.

## Safety and data status

- **Manual demo orders only.** The Windows app has a session-gated, reviewed MT5 demo ticket. Each order must pass a fresh broker check and receive explicit confirmation. Strategy automation is not routed to XM; live order submission remains locked.
- **Unverified contract assumptions.** Instrument sizing values exist only for local simulation and must not be used as broker-confirmed terms.
- **Simulation-only metrics.** Results are not out-of-sample research or broker execution evidence; metrics that cannot be calculated reliably are shown as unavailable.
- **No profitability claims.** Strategy signals and historical simulations are research aids, not investment advice or evidence of future returns.
- **Browser-local recovery only.** Checkpoints use local storage on the current browser and device. They are not broker-confirmed records or a substitute for a backup.

## Requirements

- [Bun](https://bun.sh/) 1.x

## Run locally

```sh
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs in the browser and does not require broker credentials or API keys; the optional read-only adapter runs separately on the same Windows machine.
Vite development and preview servers bind to loopback by default; they are not exposed to the local network.

## XM MT5 Windows connection

The Windows app bundles and supervises a local MT5 connector. Sign in through the official XM MT5 desktop terminal; the app does not request or store your broker password. Verified account, symbol, quote, candle, and reconciliation data are shown separately from paper simulations.

The Windows app exposes a **manual demo order ticket** in Connections & Settings. Orders require a deliberate session unlock, exact visible symbol, protective stop and target, broker preflight, review, and a separate confirmation for each order. Each order is checked against deterministic limits and MT5's returned result is shown as filled, partial, placed, rejected, or unknown. The connector never routes strategy proposals to XM. **Live order submission is locked**, and signing in alone does not authorize an order.

No live XM terminal or real broker order was used in development or release checks. Mock tests validate the gated code path but do not establish XM order behavior. An interrupted or unknown outcome locks further orders until manually reconciled in MT5; the app does not yet resolve that ledger state automatically. See the [XM order guide](docs/XM_ORDER_GUIDE.md), [Phase 4 boundary](docs/phase-reports/phase-04-demo-execution-boundary.md), and [build provenance](docs/BUILD_PROVENANCE.md).

The browser-only adapter workflow below is separate, optional, and read-only. It requires starting the loopback service manually and does not expose order submission:

In PowerShell:

```powershell
python -m pip install -r .\local-adapter\requirements.txt
$env:AITRADING_BRIDGE_TOKEN = (python -c "import secrets; print(secrets.token_urlsafe(32))")
Set-Clipboard -Value $env:AITRADING_BRIDGE_TOKEN
python .\local-adapter\bridge.py
```

Paste the clipboard token into **Connections & Settings** to request a fresh read-only snapshot. The page keeps it in memory only; it is not written to browser storage or audit logs. The server accepts authenticated `GET` requests only, applies loopback host/origin checks and rate limits, and returns stale/future/invalid quote state rather than treating it as current.

Run adapter tests with:

```powershell
python -m unittest discover -s .\local-adapter\tests -v
```

## Cross-platform app status

The native architecture and platform-specific broker boundaries are documented in [the cross-platform build plan](docs/PLATFORM_ARCHITECTURE.md). Windows packaging, signing, and XM verification status are recorded in the [release status](docs/releases/README.md). macOS, Android, and iOS/iPadOS packages have not been built. See the [Phase 4 order-boundary status](docs/phase-reports/phase-04-demo-execution-boundary.md). Mobile/macOS clients cannot connect directly to the Windows MT5 terminal.

## Verify

```sh
bun run lint
bun run test
bun run build
```

## Project areas

- `src/views/` and `src/components/`: dashboard screens and controls
- `src/services/`: local market simulation, strategy evaluation, risk checks, order lifecycle, and checkpoint storage
- `local-adapter/`: bundled MT5 connector, gated manual-demo execution boundary, and mocked adapter tests
- `src/types/`: shared trading and account-state types
- `src/tests/runTests.ts`: risk, order-safety, and checkpoint-recovery checks
- `docs/MASTER_BUILD_PROMPT.md`: product safety and development requirements

## Current limitations

Browser charts and paper fills are synthetic and transient. Checkpoints are manually saved in browser local storage. The broker ticket supports manually confirmed demo orders only; strategy automation, live trading, automatic order recovery, and broker-verified execution remain unavailable or unverified. Mock tests do not prove XM behavior or imply expected returns.
