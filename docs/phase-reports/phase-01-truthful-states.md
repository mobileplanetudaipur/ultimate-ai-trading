# Phase 1 — Truthful States and Safe Defaults

**Status: VERIFIED for the implemented local states; no broker-connected state is implemented.**

## Files changed

- `vite.config.ts`, `package.json`, `README.md`
- `src/services/riskEngine.ts`, `src/App.tsx`
- `src/components/TopBar.tsx`, `src/components/ModeSelectorModal.tsx`, `src/components/NavigationSidebar.tsx`
- `src/views/OverviewView.tsx`
- `src/tests/runTests.ts`

## Behavior

- Removed all-interface host overrides from the Vite dev/preview package scripts and configured both listeners for `127.0.0.1`.
- Made the operating-mode selector reachable from the top bar, keyboard-selectable, dismissible with Escape, and synchronized with the active mode when reopened.
- Changed top bar, sidebar, and overview labels to distinguish paper simulation, synthetic read-only observation, unavailable broker demo, and disconnected states.
- Added a centralized risk-engine operating-mode gate. Only `simulated` can approve local paper entries; `read_only`, `demo_pending`, and `disconnected` return explicit rejection codes.
- Mode selection and checkpoint restoration both update the risk engine's active mode.

## Checks run

- `npm run test` — 37/37 passed, including one negative case for each non-simulation mode.
- `npm run lint` — passed.
- `npm run build` — passed.
- `git diff --check` — passed.
- Impeccable detector on changed interface files — no deterministic findings.
- Browser preview verified the read-only top bar, sidebar, and overview disclosure. HTTP returned 200; the Vite listener was verified at `127.0.0.1` and stopped after review.

## Operating mode and limits

The source defaults to local paper simulation. Orders are simulated only; no broker orders can be sent. Read-only mode still displays synthetic data and is not connected read-only broker access. Demo-connected/readiness and live modes do not exist.

## Gate and next action

The available local modes are distinguishable and non-simulation modes fail closed. Phase 1 gate passed for implemented states. Phase 2 remains blocked: the user must select a broker or market-data provider and demo/read-only environment before a real adapter can be implemented and verified.
