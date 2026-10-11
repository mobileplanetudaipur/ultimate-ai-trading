# Cross-Platform Architecture and Build Plan

**Status:** Windows NSIS candidate built from the current worktree and passed isolated install/startup/uninstall smoke testing. It is unsigned; no XM order or fill was verified, and no public release was produced.
**Decision date:** 2026-10-11
**Current application version:** 1.0.0

## Existing baseline

The product is a React 19, TypeScript, and Vite single-page application. It provides responsive browser views, synthetic browser/paper market data, local paper-trading controls, and manually saved browser-local checkpoints. The Windows app can read data from an already signed-in XM MT5 terminal and exposes a gated, manually confirmed demo-order ticket. Its optional browser bridge remains loopback-only, authenticated, and GET-only. Strategy proposals are not connected to broker execution; live order submission is locked. Broker data is not proof of order readiness; local paper account/risk data and strategy session/event context remain simulated.

The Tauri 2 shell now wraps the existing app. There is no mobile build verification, backend service, remote broker gateway, signed installation package, release pipeline, or cross-platform installation test suite in the current repository.

## Selected architecture: shared React app inside Tauri 2

Use **Tauri 2 as the single native application shell** for Windows, macOS, Android, and iOS/iPadOS, while keeping React/TypeScript as the shared presentation and application layer.

This is preferred over maintaining separate desktop (for example, Electron) and mobile (for example, Capacitor) shells because Tauri 2 targets all four requested operating-system families from one project and allows a common web UI with narrowly scoped, platform-specific native commands. It avoids duplicating the dashboard and mode/risk presentation in separate frameworks. The current Vite app can be adopted incrementally: keep its browser build and tests, add the native shell alongside them, and introduce native abstractions only for capabilities that cannot safely remain browser-based (secure storage, native HTTP transport where needed, lifecycle/update integration, and package signing).

Tauri uses the system webview for rendering and a Rust host for native capabilities. The Rust toolchain and per-platform SDKs add build complexity; this is acceptable for the four-platform requirement but must be validated in a small first vertical slice before broad native integration. If the same minimal shell cannot be built and launched for each target using its supported toolchain, pause and revise this decision before porting product behavior.

### Shared and native responsibilities

| Layer | Responsibility |
|---|---|
| React/TypeScript | Shared screens, synthetic/paper behavior, Windows read-only broker market-data analysis, a manually reviewed demo-order ticket, truthful operating-mode labels, validated view models, platform-neutral UI tests |
| Existing domain services | Preserve and reuse deterministic paper risk checks and order lifecycle; no rewrite or native bypass |
| Tauri Rust host | Narrow native commands, platform lifecycle, allowlisted HTTP transport, OS secure-store integration when required |
| Platform toolchains | Produce OS-specific bundles, enforce platform signing/provisioning, and run installation/startup verification |
| Windows MT5 adapter | Remains a separate local Windows process beside the signed-in MT5 terminal; never bundled as a mobile/macOS terminal |
| Future broker service | Optional, separately authorized secure service for non-Windows clients; not implemented and not deployed |

Checkpoints currently use `localStorage`. Preserve browser behavior during migration, but before native release add a typed persistence boundary, an explicit migration from existing browser checkpoints, and platform tests proving that local paper state survives restart without changing trading-mode safety state. Broker tokens and credentials must never be written to `localStorage`, checkpoints, source, logs, crash reports, AI prompts, or project documents. Prefer OS-protected credential storage only if a token must persist; keeping the read-only token ephemeral is safer by default.

## MT5 and broker connectivity boundary

The current adapter is **loopback-only**, is intended for the same Windows computer as MT5, and is not a remote service. Do not change its bind address, add CORS origins, tunnel its HTTP port, or expose it through port forwarding as a way to enable mobile/macOS access. Its current shared bearer token and plain HTTP transport are not a remote-service security design.

| Client/device | Permitted broker path | Available status |
|---|---|---|
| Windows desktop on the MT5 computer | Installed Tauri app starts and supervises a bundled connector for an already-running, already-authenticated XM demo or live terminal | Read-only snapshots and a session-gated, per-order-confirmed demo ticket are implemented. Live writes remain blocked. Strategy automation is not routed to XM. This worktree has not been verified as the source of any previously installed binary. |
| macOS desktop | No direct access to a Windows terminal or its loopback adapter. A future client may connect only to a deliberately secured authenticated broker service | Unavailable until the service and client authentication are designed, authorized, implemented, and independently tested. |
| Android phone | No Windows MT5 terminal runs on the phone. A future client may connect only to that deliberately secured authenticated service | Unavailable; do not point the app at a Windows LAN address or expose the adapter. |
| iPhone/iPad | No Windows MT5 terminal runs on iOS/iPadOS. A future client may connect only to that deliberately secured authenticated service | Unavailable; do not point the app at a Windows LAN address or expose the adapter. |
| Browser/PWA | Browser-local simulation only by default. The optional local adapter is a same-machine, read-only development/verification path, not a production service | Synthetic paper strategies; no direct broker data path is configured in the browser build. |

Any future non-Windows broker service must be a separate, explicitly authorized design and deployment. The intended security boundary is a **Windows-originated outbound connection** from a local connector to a broker service, rather than inbound Internet/LAN access to MT5 or the Python adapter. The service must require encrypted transport, authenticated and explicitly paired users/devices, short-lived revocable authorization, per-account authorization, rate limiting, replay protection, sanitized audit logs, and a documented key/token rotation and incident-revocation process. The mobile/macOS client must authenticate to the service and must not contain broker credentials. The first remote capability remains read-only. The current demo-only mode gate and central risk checks must remain fail-closed; live trading remains disabled absent all release gates and the user's explicit authorization.

Before implementing this service, decide and document its hosting/ownership, identity provider, account/device pairing, threat model, retention policy, network requirements, and operational incident response. No cloud service or public endpoint is authorized by this architecture record.

## Platform build and release plan

1. **Architecture gate:** Tauri 2 decision, platform responsibilities, MT5 boundary, non-goals, and environment gaps are recorded.
2. **Native proof of concept:** the smallest Tauri shell around the current Vite app is implemented. The Windows NSIS candidate builds and its install/startup/uninstall flow has been smoke-tested on one Windows 11 x64 host. macOS, Android, and iOS/iPadOS builds and launch tests remain unverified. Preserve `npm run test`, browser builds, and loopback-only Vite defaults; stop before broad integration if any target cannot be proven.
3. **Shared application integration:** add a platform-neutral persistence and broker-client interface; retain browser simulation. Use native capabilities only behind typed interfaces, and add migrations for prior browser-local checkpoints. Keep unsupported capabilities absent in UI rather than simulating a connection.
4. **Windows desktop:** bundle the pinned MT5 connector/runtime in the Tauri installer. The app starts/supervises the local connector through private stdio pipes and attaches only to an already-open, already-authenticated XM terminal. Official MT5 handles sign-in; no broker password is collected. The connector reports verified demo/live snapshots, quotes, M15 candles, and bounded read-only reconciliation; exact symbol names feed strategy analysis. The demo-order adapter prototype remains isolated and inaccessible from the installed app and stdio protocol. Contract-derived execution sizing, complete broker/app state reconciliation, recovery, and explicit demo arming remain unverified. No order was sent. Retry/reconnect, update behavior, supported-OS matrix, and independent broker/account identity audit remain unverified.
5. **macOS and mobile:** build through macOS/Xcode and Android SDK toolchains. Until a separately authorized secure service exists, all broker-dependent screens on macOS/Android/iOS must state that remote MT5 connectivity is unavailable. Test simulation, persistence, authentication boundaries, and truthful mode display on each target.
6. **Automated quality gates:** retain domain and adapter unit tests; Windows connector tests cover missing-terminal waiting, demo/live read-only snapshots and quote refreshes, unsupported-account rejection, rejected stdio order actions, and clean shutdown. Demo prototype unit tests cover sizing, preflight rejection, duplicate prevention, and uncertain state using mocked MT5 only. `scripts/smoke-windows-installer.ps1` must be rerun on a rebuilt candidate. Still add reliable Windows retry/reconnect and update tests, broker-to-paper strategy input verification, complete portfolio/order reconciliation and restart recovery, login transitions against supported MT5 installations, per-platform launch/install smoke tests, secure-storage checks, and a check that no live order path or live-enabled state is bundled.
7. **Signed release:** build from a clean, tagged source revision on controlled platform runners. Sign each artifact with the platform's required identity, verify the signature/notarization/provisioning, install and launch the exact artifact on a real device or supported simulator, compute SHA-256, and publish only after explicit user authorization. Never treat unsigned or unverified build output as release-ready.

## Toolchain and signing requirements

The inspection on 2026-10-11 was from Windows. Node.js 24, npm 12, and .NET were present. Bun 1.4.3 and stable Rust/Cargo 1.99.0 were installed and used for the Tauri shell and Windows build. Visual Studio MSVC 14.51.36231 and Windows SDK 10.0.26100 were available; SignTool is present in the Windows SDK. Java/JDK, Android SDK/NDK/ADB/Gradle, and Xcode are not available on this host. No trusted code-signing identity, Android release keystore, Apple account/team, or provisioning setup was verified. These findings describe this build environment only; no credential contents were inspected.

| Platform | Required build/signing environment | Current blocker |
|---|---|---|
| Windows | Tauri/Rust toolchain, Visual Studio C++ build tools and WebView2 prerequisites; bundled connector build; Windows SDK SignTool or equivalent; trusted code-signing certificate and secure signing access | Tauri shell, bundled MT5 connector, and automatic read-only lifecycle are verified on Windows 11 x64 build 26200. The artifact is `NotSigned`; no approved signing identity or SmartScreen reputation is verified. Minimum/supported OS range and update behavior are not established. |
| macOS | macOS host with Xcode and Tauri/Rust prerequisites; Apple Developer Program access; Developer ID Application signing identity and notarization credentials | This Windows host has no Xcode/macOS signing tools; Apple account/team and certificates not verified |
| Android | Rust Android targets/NDK, JDK, Android SDK/Gradle; Android release keystore held outside source and secure signing access | JDK, Android SDK/NDK/ADB/Gradle, and release signing key are not available on this host |
| iOS/iPadOS | macOS host with Xcode, Rust iOS targets, Apple Developer Program access, Apple Distribution identity, app identifier, and appropriate provisioning profile/device or TestFlight setup | This Windows host cannot produce or verify an iOS release; Apple account/team, signing identity, and provisioning not verified |

Never paste certificates, private keys, keystore files/passwords, API credentials, provisioning secrets, or broker credentials into chat. Use a controlled local or CI secret store after the user provisions the required platform access.

For Windows signing, use an approved publicly trusted Authenticode certificate with the Code Signing EKU (`1.3.6.1.5.5.7.3.3`) and a valid chain. The supported local handoff is a PKCS#12 `.pfx` imported into `CurrentUser\My` with private-key access protected locally, or a hardware-backed provider / approved signing-service integration that keeps the private key non-exportable. After signing with SignTool using SHA-256 and an RFC 3161 timestamp, verify the final installer with `signtool verify /pa /all /v`. Never self-sign or store key material/passwords in source, command lines, logs, or project memory. A valid signature does not guarantee SmartScreen reputation; evaluate it separately on the signed artifact.

## Safety and release gates

- Browser simulation remains the default on every platform. A platform wrapper must not change central risk rules or infer broker readiness from adapter reachability.
- The Windows connector remains a distinct local process. Demo order actions require deliberate session activation, broker preflight, and a separate confirmation per order. Live writes remain disabled until a separate release approval and all safety/recovery gates pass; no live-enabled state may be bundled.
- A connected status must name the actual data source and timestamp; stale, future, invalid, mismatched, or unavailable market data must remain unusable.
- No public deployment, upload, store release, GitHub release, or external artifact distribution without explicit user authorization.
- Report exact build command, source revision, test results, target device/simulator, artifact path, byte size, signature/notarization/provisioning result, and SHA-256 for every artifact. If any item is absent, mark that package not releasable.

## Current completion state

The existing browser application and local adapter remain intact. The Tauri shell and bundled Windows connector are packaged in a local NSIS candidate that passed an isolated install/startup/uninstall smoke test. The installer is unsigned and has not been distributed. See the [release status](releases/README.md) and [candidate provenance](BUILD_PROVENANCE.md).

Current source implements **XM demo/live observation** and a **manual demo order flow** through the bundled connector. Order requests use exact visible terminal symbols, broker-reported terms, fresh quote checks, risk gates, `order_check`, a persistent pre-send ledger, a one-use review token, and explicit submission confirmation; broker result states are reported without synthetic fills. Live writes are locked in the executor and connector. No XM order/fill, real-terminal recovery behavior, complete broker/app synchronization, 24/7 operation, or installed-binary provenance is established. The current browser build remains separate; its optional local bridge is read-only.
