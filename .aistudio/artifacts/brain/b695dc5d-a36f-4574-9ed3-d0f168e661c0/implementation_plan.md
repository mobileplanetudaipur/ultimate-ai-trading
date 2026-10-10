# Ultimate AI Trading: Engineering Verification & Comprehensive Enhancement Plan

A production-grade, fail-closed paper trading and quantitative risk terminal adhering to strict institutional safety controls (0.20% trade risk, 1.00% daily loss limit, 3 max positions, 3x leverage ceiling). This plan addresses all static archive findings, refines UI density and typography, deepens algorithmic strategy formulations, expands test coverage to 18 automated safety tests, and details broker bridge protocol specifications.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Operational Boundaries (Non-Negotiable Rule 1)**:
> 1. **Strict Demo / Paper Simulation Only**: Real-money live broker execution remains impossible across all views, APIs, and engine components.
> 2. **Prioritization Choice**: User selected "all of above", activating all four enhancement streams: UI refinement, strategy additions, test suite expansion, and bridge diagnostics.
> 3. **Fail-Closed Safety**: Any stale feed, news blackout window, or ambiguous order state defaults to complete execution lockout ("NO TRADE").

- **Confirmed Decision 1**: Modernize dashboard typography and reduce nested card clutter while retaining institutional dark terminal ergonomics.
- **Confirmed Decision 2**: Introduce two verified quantitative strategies with formal mathematical formulation and hypothesis invalidation rules.
- **Confirmed Decision 3**: Expand automated test suite in `src/tests/runTests.ts` from 12 to 18 rigorous edge-case assertions.
- **Confirmed Decision 4**: Provide formal JSON-RPC / REST schemas for the desktop MT5/FastAPI bridge without simulating live fills.

---

## 1. Overview & Core Concept

- **What It Does**: A high-integrity quantitative trading cockpit and paper execution simulator. It models multi-asset market data (FX, Metals, Crypto), runs rule-based strategy evaluators, enforces strict capital preservation limits before any order can be staged, and logs chronological audit events with local session durability.
- **Target Audience / Persona**: Systematic quantitative traders, risk officers, and algorithmic strategy researchers who require absolute transparency, strict mathematical risk sizing, and zero deceptive simulation artifacts.
- **Key Value**: Replaces misleading "broker connected" assumptions with verified truth-in-advertising: transparent data freshness, mathematical lot sizing, continuous drawdown protection, and reproducible test verification.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Cockpit Overview*: Trader views live simulated quotes, account equity curves, current active paper positions, and real-time risk utilization dials.
  2. *Market Analysis & Order Sizing*: Inspects instruments, calculates exact position lot size based on custom stop loss distance and current account equity, ensuring the 0.20% risk ceiling is never breached.
  3. *Strategy Evaluation*: Runs automated hypothesis checks across multi-timeframe candle data, viewing exact condition-by-condition match logs and explicit "NO TRADE" reasons when criteria fail.
  4. *Risk Center & Kill Switches*: Monitors the 5-loss / 30-minute lockout timer, 8 trades/day cap, 3-position ceiling, and tests the immediate manual Kill Switch.
  5. *Shadow & Bridge Diagnostics*: Inspects the external MT5 bridge connection status, latency metrics, and API endpoint schema documentation.
  6. *Audit & Checkpoints*: Verifies chronological ledger entries and exports session state.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Refined Institutional Dark Terminal (Slate-950 canvas with emerald/rose accents, precision borders, softened card paddings, and eliminated monospace clutter).
  - *Color Palette & Tokens*:
    - Background: `bg-slate-950` (main canvas), `bg-slate-900/80` (panels), `bg-slate-900/40` (subtle containers)
    - Borders: `border-slate-800/80` (replacing harsh high-contrast borders)
    - Accents: `emerald-400` (long / profit), `rose-400` (short / risk breach), `amber-400` (warning / simulation tag), `sky-400` (strategy signals)
    - Text: `text-slate-100` (primary titles), `text-slate-300` (body descriptions), `text-slate-400` (metadata), `text-slate-500` (labels)
  - *Typography & Hierarchy*:
    - Standard headings in clean Sans-Serif (`font-semibold tracking-tight text-slate-100`)
    - Monospace font strictly reserved for numerical figures, prices, lot sizes, and timestamps (`font-mono text-xs text-slate-200`)
    - Removal of forced all-caps monospace labels; replacement with clean sentence-case badges and tooltips.
  - *Layout Density*: Reduced card-in-card nesting, increased whitespace rhythm (gap-4 / gap-6), and sticky view headers with clear contextual breadcrumbs.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: UI Typography & Density Cleanup**:
  - *Chosen Approach*: Refactor heavy card borders, replace overused uppercase monospace tags with clean Tailwind badges, and soften contrast to improve prolonged viewing comfort.
  - *Why*: Eliminates visual fatigue and presents data with clear hierarchy.
- **Decision 2: Realistic Strategy Engine Expansion**:
  - *Chosen Approach*: Implement two distinct quantitative models:
    1. *Bollinger Bands + RSI Mean Reversion*: Measures 20-period 2-sigma envelopes with RSI < 30 / > 70 divergence and strict volume confirmation.
    2. *London/NY Session Open Breakout*: Identifies first-hour consolidation range breaks with session-window invalidation.
  - *Why*: Diversifies beyond trend-following to provide balanced market regime testing.
- **Decision 3: Fail-Closed Test Suite Expansion (12 -> 18 Tests)**:
  - *Chosen Approach*: Write 6 additional test scenarios in `src/tests/runTests.ts` covering news blackout entry blocks, drawdown threshold enforcement, sub-minimum lot protection, USD/JPY 3-digit pip value scaling, multi-timeframe alignment, and idempotency protection.
  - *Why*: Guarantees regressions in mathematical risk checks are caught immediately during CI/build.
- **Decision 4: Broker Bridge Protocol Specification**:
  - *Chosen Approach*: Provide complete desktop bridge contract definitions (FastAPI / ZeroMQ JSON-RPC spec) in UI and documentation, with simulated bridge ping diagnostics and clear step-by-step setup instructions for future desktop integration.
  - *Why*: Gives users full architectural visibility for when they run the Python MT5 service locally, without faking live execution in the web browser.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Ultimate AI Trading Client                      │
│                                                                        │
│   ┌─────────────────────┐   ┌───────────────────┐   ┌──────────────┐   │
│   │   Market Feeds      │   │   Risk Engine     │   │  Strategy    │   │
│   │ (Simulated Paper    │──▶│ (0.20% Per Trade, │──▶│  Engine      │   │
│   │  Tick & Candles)    │   │  1.00% Daily DD,  │   │ (Hypothesis  │   │
│   └─────────────────────┘   │  Max 3 Positions) │   │  Evaluation) │   │
│              │              └───────────────────┘   └──────────────┘   │
│              ▼                        │                     │          │
│   ┌─────────────────────┐             ▼                     ▼          │
│   │  App Navigation     │   ┌───────────────────┐   ┌──────────────┐   │
│   │  & Active Views     │◀──│  Order Lifecycle  │◀──│ Sizing Calc  │   │
│   │ (Overview, Markets, │   │  (Paper Fills &   │   │ (Instrument- │   │
│   │  Risk, Strategies)  │   │   Audit Trails)   │   │  Aware Math) │   │
│   └─────────────────────┘   └───────────────────┘   └──────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                                 │ Disconnected (Demo Mode)
                                 ▼
               ┌───────────────────────────────────┐
               │  Local Windows MT5 Desktop Bridge │
               │  (FastAPI / ZeroMQ on localhost)  │
               └───────────────────────────────────┘
```

### Static Findings Verification Summary

| Lead / Suspected Issue | Verified File & Location | Verified Status in Code | Remediation in this Plan |
| :--- | :--- | :--- | :--- |
| **Market Data Provider Label** | `src/services/marketDataService.ts:96-114` | Provider is explicitly `'Local In-Memory Simulation (Paper Engine)'`. Freshness is `'simulated'`. | Maintain simulation labeling in all UI charts and tooltips. |
| **App Initial Account** | `src/App.tsx:54-66` | Account starts with `brokerConfirmed: false` and `reconciliationStatus: 'BROKER_GATEWAY_DISCONNECTED'`. | Retain strict isolation of paper account state. |
| **Order Execution** | `src/services/orderLifecycleManager.ts:118-138` | Order tokens are prefixed `paper_pos_` with `brokerConfirmed: false`. | Keep explicit paper fill notation. |
| **Reconciliation Ledger** | `src/services/reconciliationService.ts:28-32` | Discloses that MT5 bridge is disconnected and real broker comparison is unavailable. | Keep transparent ledger check. |
| **Risk Baseline Limits** | `src/services/riskEngine.ts:14-24` | 0.20% per trade, 1.00% daily loss, 3 max positions, 8 trades/day, 5-loss lockout, 3x max leverage. | Expand automated tests to verify edge conditions. |
| **Strategy Formulations** | `src/services/strategyEngine.ts:4-53` | Formulations marked `HYPOTHESIS_PENDING_OUT_OF_SAMPLE` with explicit invalidation. | Add Bollinger Mean Reversion and Session Open Breakout. |
| **Economic Calendar** | `src/services/economicCalendarService.ts:13-53` | All events flagged `isSyntheticTestScenario: true`. | Improve blackout proximity indicator. |
| **Mode Selector Modal** | `src/components/ModeSelectorModal.tsx:99-101` | Live mode selection is completely locked out. | Maintain lockout and Non-Negotiable Rule 1. |
