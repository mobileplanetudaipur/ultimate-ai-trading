# Ultimate AI Trading

A browser-based trading research and paper-simulation dashboard. The app demonstrates market monitoring, strategy evaluation, deterministic risk checks, simulated order lifecycles, and local recovery checkpoints.

## Safety and data status

- **Paper simulation only.** Market prices and candles are generated locally; orders and fills are simulated in the browser.
- **No live broker trading.** The MT5 bridge is disconnected and does not submit or confirm orders.
- **No profitability claims.** Strategy signals and historical simulations are research aids, not investment advice or evidence of future returns.
- **Browser-local recovery only.** Checkpoints use local storage on the current browser and device. They are not broker-confirmed records or a substitute for a backup.

## Requirements

- [Bun](https://bun.sh/) 1.x

## Run locally

```sh
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs entirely in the browser and does not require broker credentials or API keys.

## Verify

```sh
bun run lint
bun run test
bun run build
```

## Project areas

- `src/views/` and `src/components/`: dashboard screens and controls
- `src/services/`: local market simulation, strategy evaluation, risk checks, order lifecycle, and checkpoint storage
- `src/types/`: shared trading and account-state types
- `src/tests/runTests.ts`: risk, order-safety, and checkpoint-recovery checks
- `docs/MASTER_BUILD_PROMPT.md`: product safety and development requirements

## Current limitations

Quotes, candles, and fills are synthetic and transient. Checkpoints are manually saved in browser local storage. The project does not yet provide a production market-data feed, broker integration, account authentication, or broker reconciliation. Treat all dashboard data as simulated unless a future implementation explicitly verifies and labels another source.
