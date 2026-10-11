# Architectural & Product Decisions Log (ADR)

## DECISION-001: Canonical Product Name & Visual Identity
- **Status:** APPROVED & ADOPTED
- **Context:** The project requires a consistent product identity across all UI views, documentations, web app manifests, package portals, and test suites. Reviewing the initial repository target (`siyalsandeep/ultimate-ai-trading`), the root metadata (`metadata.json`), the HTML entrypoint, and the target audience (disciplined retail & institutional algorithmic traders targeting XM / MetaTrader 5):
- **Decision:** The canonical product name is **"Ultimate AI Trading"** (short name: **"UltimateAI"**).
- **Rationale:** 
  1. Matches the established repository identity and user requirements.
  2. Differentiates the platform by emphasizing disciplined, risk-first algorithmic governance rather than speculative gambling.
  3. Consistent across `metadata.json`, `index.html`, `public/manifest.json`, navigation headers, and test fixtures.

## DECISION-002: Operating Mode Derivation & Feed Truthfulness
- **Status:** APPROVED & ADOPTED
- **Context:** Previous builds allowed the UI to display "XM Demo (Default)" even when no MetaTrader 5 terminal was active, risking confusion with genuine XM quotes.
- **Decision:**
  1. Mode is dynamically derived from actual adapter state, account confirmation, data provenance, freshness, and ledger reconciliation.
  2. When the Windows MT5 bridge is offline / terminal not detected, the operating mode is strictly **`simulated`** (Simulated Paper Trading).
  3. The synthetic market feed is explicitly and permanently labeled: **`Simulated Market Feed (In-Memory Synthetic Data)`**. It is NEVER labeled live or XM demo data.
  4. Live mode remains locked by default behind a deliberate 6-point cryptographic verification gate and operator approval phrase.

## DECISION-003: Platform Packaging & Release Portal Truthfulness
- **Status:** APPROVED & ADOPTED
- **Context:** Previously, the download portal displayed fake package filenames (`UltimateAITrading-Setup-1.0.0.exe`), fake SHA-256 hashes, and claimed `STAGED_READY` when native binaries were not actually built.
- **Decision:**
  1. Remove all fabricated filenames, guessed binaries, and artificial checksums.
  2. The release portal provides active downloads ONLY for artifacts that physically exist, have been built and verified, and possess verifiable checksums:
     - **PWA Web App:** Status `VERIFIED_ACTIVE`. Manifest (`/public/manifest.json`), service worker (`/public/sw.js`), and Apple-inspired icon assets have verified SHA-256 hashes and real browser installation prompt.
     - **Windows (`.exe`/`.msi`), macOS (`.dmg`/`.pkg`), Android (`.apk`/`.aab`), iOS (`.ipa`):** Status `NOT_BUILT_BLOCKED`. Real blockers documented: missing Windows Authenticode EV/OV certificate, missing macOS Xcode host/Apple Developer ID, missing Android release Keystore, and missing iOS provisioning profile.

## DECISION-004: Windows MT5 Loopback Daemon Architecture
- **Status:** APPROVED & ADOPTED
- **Context:** Official MetaTrader 5 Python integration requires the Windows desktop MT5 client. macOS and mobile operating systems cannot execute the Windows MT5 binary directly.
- **Decision:**
  1. Maintain a dedicated Python daemon (`scripts/windows_mt5_bridge.py`) binding exclusively to loopback `http://127.0.0.1:8000`.
  2. Daemon requires Bearer token authentication and exposes read-only terminal queries (`/api/v1/health`, `/api/v1/account`, `/api/v1/symbols/{symbol}`, `/api/v1/ticks/{symbol}`).
  3. Mobile and macOS devices connect strictly as remote telemetry monitors over authenticated secure tunnel; they never attempt native MT5 binary execution.
  4. Broker credentials are never stored in source code, browser bundles, logs, screenshots, AI prompts, or `VITE_` variables.

## DECISION-005: Separation of Entry Counting from Trade Closures
- **Status:** APPROVED & ADOPTED
- **Context:** Daily trade cap (8 entries per day maximum) must restrict new risk entries, but closing an open position or taking profit must never be blocked or conflated with new entries.
- **Decision:**
  1. `recordOrderEntry()` increments the daily entry counter on new order submission/fill.
  2. `recordCompletedTrade()` records realized P&L and updates the 5-consecutive-loss lockout breaker without incrementing the daily entry count.
  3. Daily equity reference resets strictly at 00:00:00 UTC.
  4. Kill-switch resets must never clear unrelated risk breakers or active cooldowns.
