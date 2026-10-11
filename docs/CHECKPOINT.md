# Durable Checkpoint & System Verification

## Current State & Milestone Checkpoint
- **Project Name:** Ultimate AI Trading (`UltimateAI`)
- **Current Phase:** Phase 1 to 8 Truthful Implementation & Verification Complete
- **Operating Mode Default:** `SIMULATED` (Simulated Paper Trading when local MT5 bridge is offline). Live execution remains strictly gated by design.
- **Automated Verification Status:** **46 / 46 Tests Passing** (`npm test` — Deterministic Risk Engine, 0.20% per-trade, 1.00% daily, 5-loss lockout, 3-position ceiling, idempotency, multi-record state separation, Phase 9 shadow gate, Live-Release gate, PWA manifest verification, Cross-Platform broker boundaries, True mode derivation, Entry/closure separation, Breaker preservation, Truthful package statuses, Durable ledger integrity).
- **TypeScript Linting:** 0 errors (`tsc --noEmit`).
- **Production Build:** Succeeded (`npm run build`).

---

## Packaging Deliverables & Status Matrix

| Artifact Target | Format | Status | Real Checksum (SHA-256) | Signing & Credential Requirement |
| :--- | :--- | :--- | :--- | :--- |
| **Cross-Platform PWA Core** | Web App Manifest + SW | **VERIFIED & ACTIVE** | Manifest: `8f58a89daaa98509b4fd5646295ce9c10bac15d5d63e0a438b2a23f52f8fdd7e` | Self-contained, standard web security |
| **Windows Package** | Native Installer (.exe/.msix) | **NOT BUILT / BLOCKED** | None (Unbuilt artifact) | Authenticode EV/OV Certificate + Windows host |
| **macOS Package** | DMG / PKG | **NOT BUILT / BLOCKED** | None (Unbuilt artifact) | Apple Developer ID + Xcode host + Notarytool |
| **Android Package** | APK / AAB | **NOT BUILT / BLOCKED** | None (Unbuilt artifact) | Release Keystore + Android SDK / Gradle |
| **iOS / iPadOS Package** | IPA Archive | **NOT BUILT / BLOCKED** | None (Unbuilt artifact) | Apple Developer Team Provisioning Profile + Mac |

---

## Verified Platform & Broker Boundaries
1. **Windows OS:** Sole host for the official MetaTrader 5 Terminal binary and local loopback Python daemon (`http://127.0.0.1:8000`).
2. **macOS & Mobile (iOS / Android):** Operate as authenticated client monitors via secure gateway tunnel (WireGuard / Tailscale / HTTPS Bearer Auth). Direct Windows MT5 terminal execution is never attempted on non-Windows hosts.
3. **Fail-Closed Execution:** All platforms support immediate local Emergency Halt (Kill Switch) and read-only telemetry mode.
4. **PWA Visual Identity:** Standardized Apple-inspired icon set in `/public/icons/` (`icon-192.png`, `icon-512.png`, `icon-192x192.png`, `icon-512x512.png`, `icon-192x192-maskable.png`, `icon-512x512-maskable.png`, `apple-touch-icon.png`) with deep navy/charcoal base, frosted glass illumination, and vector glyph.
5. **Durable Ledger:** Schema v2 structured ledger with cryptographic integrity digest and fail-closed corrupt state validation (`storageCheckpoint.ts`).
