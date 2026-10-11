# Ultimate AI Trading — Canonical Project State & Phase Verification

**Last Verified:** 2026-10-11T07:19:30Z  
**Product Name:** Ultimate AI Trading (`UltimateAI`)  
**Current Active Mode:** `SIMULATED` (Simulated Paper Trading)  
**Broker Gateway Status:** `OFFLINE / NOT_DETECTED` (`http://127.0.0.1:8000`)  
**Live-Release Gate:** `LOCKED_PENDING_PREREQUISITES` (Fail-Closed)  
**Automated Verification:** **46 / 46 Passing Unit & Safety Tests** (`npm test`)  
**TypeScript Linting:** Clean (0 errors via `tsc --noEmit`)  
**Applet Compilation:** Succeeded (`npm run build`)  

---

## Phase Status Summary Table

| Phase | Phase Name | Status | Key Evidence / File Location | Real Blocker / Next Action |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | **Baseline Claims & Truthfulness** | `VERIFIED` | `ReleasePackagesView.tsx`, `brokerGateway.ts`, `App.tsx` | All fake filenames, fake checksums, and fake "ready" statuses removed. |
| **P1** | **Simulated Mode & UI Truth** | `VERIFIED` | `OverviewView.tsx`, `TopBar.tsx`, `NavigationSidebar.tsx` | Derived mode active; feed unmistakably marked as synthetic paper data. |
| **P2** | **XM/MT5 Read-Only Integration** | `IMPLEMENTED BUT UNVERIFIED` | `scripts/windows_mt5_bridge.py`, `src/services/brokerGateway.ts` | Blocked until user runs `python scripts/windows_mt5_bridge.py` on Windows MT5 host. |
| **P3** | **Deterministic Risk & Authorization** | `VERIFIED` | `src/services/riskEngine.ts`, Tests 1-15, 41-42 | 0.20% risk, 1.00% daily, 8-entry cap, 30m lock, 3-position ceiling, entry separation. |
| **P4** | **Order Lifecycle & Broker Truth** | `VERIFIED` | `src/services/orderLifecycleManager.ts`, Tests 27-33 | Separate intent/order/deal/position models, idempotency, no blind retries. |
| **P5** | **Durable Recovery & Audit** | `VERIFIED` | `src/services/storageCheckpoint.ts`, `shadowValidationService.ts`, Test 44 | Schema v2 ledger with integrity hash; synthetic quotes excluded from shadow gate. |
| **P6** | **Strategies & Research** | `SIMULATED` | `src/services/strategyEngine.ts`, `src/views/StrategiesView.tsx` | 6 proposal-only strategies with walk-forward and out-of-sample caveats. |
| **P7** | **Safety Testing & Phase Gates** | `VERIFIED` | `src/tests/runTests.ts` (46/46 passed) | Focused automated tests for all changed safety behaviors. |
| **P8** | **Real Platform Packaging** | `PWA VERIFIED / NATIVE BLOCKED` | `public/manifest.json`, `public/sw.js`, `public/icons/` | PWA active. Native installers blocked due to missing signing certificates. |

---

## Detailed Phase Breakdown

### Phase 0: Baseline Claims & Misleading Assertions Correction
- **Derivation of Operating Mode:** The operating mode is dynamically derived via `brokerGateway.deriveOperatingMode()`. If the loopback bridge (`127.0.0.1:8000`) is offline or MT5 terminal is not detected, requested Demo mode truthfully falls back to `simulated` (Simulated Paper Mode).
- **Feed Labeling:** The generated quote feed is explicitly tagged: `provider: "Local In-Memory Simulation (Paper Engine)"`, `freshness: "simulated"`. Never labeled Live or XM Demo.
- **Removed Fabrications:** Fake executable names (e.g. `UltimateAITrading-Setup-1.0.0.exe`), fake SHA-256 hashes, and fabricated `STAGED_READY` statuses have been completely eliminated.
- **Product Name Decision:** Established as **"Ultimate AI Trading"** (Decision recorded in `docs/DECISIONS.md`).

### Phase 1: Simulated Mode & Financial Command Center UI Truth
- **Consistent Labels Across Views:** `OverviewView`, `TopBar`, `NavigationSidebar`, `MarketsView`, `ConnectionsSettingsView`, and `ReleasePackagesView` maintain consistent labels.
- **Accessibility & Hierarchy:** Accessible dark theme with high contrast (`#0B0F19` base), visible focus outlines, tabular numerals for financial data, screen-reader labels on buttons, and unambiguous state badges.
- **Emergency Action:** One-click Emergency Halt (Kill Switch) and Entry Pause are prominently available in the top bar across all views.

### Phase 2: XM/MT5 Read-Only Integration
- **Windows Python Loopback Bridge:** Implemented in `scripts/windows_mt5_bridge.py`. Strictly binds to `127.0.0.1:8000` (loopback only) and requires Bearer token authorization via `MT5_BRIDGE_BEARER_TOKEN`.
- **Truthful Terminal Queries:** Interacts with official `MetaTrader5` Python package on Windows (`mt5.account_info()`, `mt5.symbol_info()`, `mt5.symbol_info_tick()`).
- **Platform Boundaries:** Documented in `docs/CROSS_PLATFORM_ARCHITECTURE.md`. Non-Windows clients (macOS, Android, iOS) act strictly as remote telemetry monitors over authenticated secure tunnel; they never attempt native Windows MT5 execution.
- **Current Blocker:** Real XM MT5 terminal daemon is not running in the current browser runtime. The adapter marks connection as `NOT_DETECTED` and fails closed.

### Phase 3: Deterministic Risk & Authorization Engine
- **Separation of Entry Counting:** `riskEngine.recordOrderEntry()` increments daily trade count (8 entries/day cap) upon order submission. `riskEngine.recordPositionClosed()` handles trade closure P&L and consecutive loss tracking without inflating the daily entry count.
- **Breaker Preservation:** Resetting the Emergency Kill Switch preserves active 30-minute consecutive loss lockout and daily loss limit breakers.
- **Enforced Boundaries:**
  - 0.20% maximum risk per trade based on reference equity.
  - 1.00% daily loss limit (including floating P&L).
  - 5-consecutive-loss lockout with mandatory 30-minute cooldown.
  - Maximum 3 concurrent open positions ceiling.
  - Maximum 3.0x effective portfolio leverage ceiling.
  - Daily equity reference reset at 00:00:00 UTC.

### Phase 4: Order Lifecycle & Broker Truth
- **Separated Domain Entities:** Separate models for `OrderIntentRecord`, `BrokerOrderRecord`, `DealExecutionRecord`, and `PositionRecord`.
- **Submission Gateway:** Preflight deterministic risk validation is the only gateway to order execution.
- **Uncertainty & Timeouts:** Timed out submissions are marked `TIMEOUT_UNKNOWN` with `blindRetryForbidden = true`. Blind retries are strictly prohibited until reconciliation against broker records.
- **Idempotency:** Idempotency keys are recorded before submission; duplicate broker responses are dropped without position inflation.

### Phase 5: Durable Recovery, Shadow & Audit
- **Durable Structured Ledger:** Implemented in `src/services/storageCheckpoint.ts` (Schema Version 2). Calculates a cryptographic integrity digest on save.
- **Fail-Closed Restoration:** Corrupted, tampered, or incomplete state fails validation (`INTEGRITY_MISMATCH` / `INCOMPLETE_STATE`) and blocks resumption until audited.
- **Shadow Mode Provenance:** Synthetic in-memory observations are excluded from genuine Phase 9 shadow verification evidence.

### Phase 6: Strategies & Research Governance
- **Proposal-Only Code:** All 6 strategies in `src/services/strategyEngine.ts` generate proposal evaluations only; they cannot bypass the risk gate or directly place orders.
- **Research Status:** Marked `HYPOTHESIS_PENDING_OUT_OF_SAMPLE` with explicit limitations and out-of-sample walk-forward notices.

### Phase 7: Safety Testing & Phase Gates
- **Automated Verification:** **46 / 46 Tests PASSED** (`npm test`).
  - Unit tests for 0.20% sizing, gold/btc contract sizes, daily loss, 8-trade cap, 5-loss lockout, 3 positions, 3x leverage, stale feed rejection, kill switch, stop loss validation, news blackout, currency conversions.
  - Strategy engine failure modes, idempotency duplicate rejection, multi-record state separation, partial fills, partial closes, submission timeouts, shadow provenance exclusions, live release gate lock.
  - Tests 40-44: True operating mode derivation, entry separation from closures, breaker preservation on kill-switch reset, truthful package statuses, and durable ledger integrity.

### Phase 8: Real Platform Packaging & Release Portal
- **Web App (PWA):** `VERIFIED_ACTIVE`.
  - Manifest (`/public/manifest.json`): SHA-256 `8f58a89daaa98509b4fd5646295ce9c10bac15d5d63e0a438b2a23f52f8fdd7e`
  - Service Worker (`/public/sw.js`): SHA-256 `27502c93e3a88592985c246f0a4dad1c7a109991a46555520b7970c482f55cc1`
  - Icons (`/public/icons/`): Standardized 192x192, 512x512, and maskable PNG icons with Apple-inspired aesthetic.
- **Windows (.exe/.msix):** `NOT_BUILT_BLOCKED`. Missing Windows build host and Authenticode EV/OV certificate.
- **macOS (.dmg/.pkg):** `NOT_BUILT_BLOCKED`. Missing macOS Xcode host, Apple Developer ID certificate, and notarytool notarization.
- **Android (.apk/.aab):** `NOT_BUILT_BLOCKED`. Missing Android SDK/Gradle and Release Keystore.
- **iOS (.ipa):** `NOT_BUILT_BLOCKED`. Missing Apple Developer Team membership and provisioning profile.
