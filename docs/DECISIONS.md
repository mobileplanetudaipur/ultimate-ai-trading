# Decisions

## 2026-10-11 — Preserve the active worktree and its changes

Keep the current branch and all pre-existing audit changes. Do not commit, push, merge, publish, or deploy without separate explicit authorization. The accessible workspace has both `origin` and the selected `aitrading` remote; this task changes neither remote.

## 2026-10-11 — Local read-only XM MT5 demo observer

Target the already signed-in XM MT5 demo terminal through a separate local Windows adapter. The adapter accepts only XM demo accounts, binds to loopback, requires a locally generated bearer token, and has read-only GET endpoints only. It does not connect to strategy, chart, risk, or order paths. Terminal trade permissions are observations and never imply that this application can trade.

## 2026-10-11 — Treat stale or invalid MT5 quotes as unusable

The inspected terminal reported XM Global Limited and an XM MT5 demo server. Available quote timestamps were stale or future-dated, so no market-data readiness or symbol mapping is claimed. Keep the phase blocked until the exact intended symbols provide valid fresh ticks and are separately verified.

## 2026-10-11 — Use one Tauri 2 native shell for requested platforms

Adopt Tauri 2 around the existing React/Vite app for Windows, macOS, Android, and iOS/iPadOS. This shares UI and product behavior while reserving OS-specific work for native capabilities and packaging. Preserve the browser app and domain logic; prove the shell on each platform before broad migration. Do not begin a rewrite. The Tauri proof of concept, platform signing, and artifact verification are not complete.

Keep the Python XM/MT5 adapter on the user's Windows MT5 machine and loopback only. macOS/mobile clients have no direct terminal path and may connect only to a deliberately secured, authenticated service that requires separate architecture approval and explicit deployment authorization. No cloud service or public endpoint is authorized.

## 2026-10-11 — Keep the Windows installer candidate local and unsigned

The Tauri Windows NSIS candidate built successfully and passed a local install/startup/uninstall smoke test on Windows 11 x64 build 26200. Its Authenticode status is `NotSigned`; its checksum and exact artifact path are recorded in `docs/releases/README.md`. Do not distribute or describe it as release-ready until a trusted signing identity is provisioned and the signed artifact is independently verified. No artifact was uploaded or published.

## 2026-10-11 — Only local simulation may submit paper entries

The deterministic risk gate permits entries only in `simulated` mode. Read-only observation, pending demo, and disconnected modes reject proposals. No mode enables live execution.

## 2026-10-11 — Bind local Vite servers to loopback

Vite dev and preview use `127.0.0.1`; package scripts must not override the host to expose the app on all network interfaces.

## 2026-10-11 — Make Windows MT5 discovery automatic in the installed app

The user selected the installed Windows desktop app as the automatic connection target. Implemented: the app bundles and supervises a local MT5 connector over private stdio pipes, discovers an already-running terminal, and displays read-only status without requiring Python, PowerShell, tokens, or manual bridge startup. Official MT5 handles sign-in; the app does not request or store the trading password. The helper stops when the app exits and explicitly reports unavailable or ambiguous states. Its stdio protocol and host snapshot were smoke-tested; this does not verify every MT5/account/reconnect scenario.

The current browser workflow still needs its separately launched local adapter. Do not extend this local Windows design to macOS/mobile; do not enable demo order submission or live trading. Automated trading remains blocked pending a verified broker execution adapter plus broker-specific sizing, safety, reconciliation, and recovery gates.

## 2026-10-11 — Support demo/live observation; gate all broker writes

The user wants read/write capability for both demo and real XM accounts, and selected implementation of both paths while live remains locked behind safety/testing and separate release/activation gates. This is authorization to build toward the capability, not authorization to place orders now. No return, maximum-profit, or minimum-loss guarantee may be claimed.

Current implementation: verify and label XM demo/live account observations read-only. The Windows Tauri app now reads broker quotes and M15 candles through unique exact-symbol mappings for strategy analysis, and offers read-only reconciliation. The persistent run/stop control only gates local paper proposals; broker orders remain disconnected. The isolated demo order prototype is not exposed through the installed Tauri app or connector protocol until broker contract/execution validation, explicit demo arming, complete broker/app reconciliation, recovery, and end-to-end demo testing pass. Live writes are not implemented; any future live path requires separate review, all release gates, and deliberate live activation. Logging into MT5 alone never authorizes writing.

## 2026-10-11 — Expose only the gated manual demo order ticket

The user selected proceeding with a gated demo order ticket. The Windows connector and Tauri allowlist now expose session enable/disable, prepare, and submit actions for that ticket. The order path performs a broker preflight, displays review terms, and requires explicit confirmation for each demo order. It is not connected to strategy automation. The SQLite ledger and fail-closed unknown-outcome block are local safeguards, not proof of broker recovery behavior.

Live order preparation and submission remain hard-locked by `LIVE_RELEASE_APPROVED = False` in the executor; a live login cannot activate the route. No MT5 terminal or broker order was used in development or release checks. The local Windows installer remains unsigned and must not be treated as provenance evidence for any previously installed binary.
