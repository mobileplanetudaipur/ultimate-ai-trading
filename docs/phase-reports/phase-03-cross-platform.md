# Phase 3 — Cross-Platform Architecture and Packaging

**Status: TAURI SHELL AND WINDOWS READ-ONLY CONNECTOR IMPLEMENTED; WINDOWS UNSIGNED CANDIDATE BUILT AND SMOKE-TESTED; NO RELEASE PUBLISHED**

## Baseline and architecture

The existing product is a React 19/TypeScript/Vite web application with local paper simulation and browser-local checkpoints. The optional Python XM/MT5 adapter is read-only and runs on the Windows computer hosting the official MT5 terminal.

The selected architecture is Tauri 2 around the existing React/Vite UI for Windows, macOS, Android, and iOS/iPadOS. This preserves existing product behavior and browser operation while allowing narrowly scoped native capabilities; no rewrite was performed. Windows MT5 stays on the user's Windows computer. Non-Windows clients cannot access that terminal directly and would require a separately designed, explicitly authorized, secured/authenticated service. No such service exists or is authorized.

## Windows implementation

- The installed Tauri app bundles the pinned `MetaTrader5==5.0.6180` and `psutil==7.2.2` read-only connector runtime as a PyInstaller onedir payload.
- On app launch, Rust starts and supervises the hidden connector over private stdin/stdout JSON-lines pipes. It does not open a network listener or use a user-managed token. The installed-app path needs no Python install, PowerShell, token copying, or manual bridge startup.
- The connector discovers an existing MT5 terminal process and only initializes the terminal already signed in by the user. The official MT5 application owns authentication; this app does not ask for, store, or send the broker password. Ambiguous, missing, disconnected, or unsupported account states are not treated as connected. The current browser adapter workflow remains distinct and unchanged.
- The native UI reports actual connector status, account/symbol snapshots, live quotes, and M15 history. Exact visible symbols are resolved for strategy analysis; read-only reconciliation is available for demo and live accounts. The connector has no order-submission implementation and always sets `order_submission` false. Automated demo and live trading remain blocked: broker contract/execution sizing, broker-order synchronization, full reconciliation/recovery, and an XM-verified execution adapter are absent. Login alone cannot authorize trading.
- Unit tests cover missing-terminal state, attachment, demo/live read-only access, account rejection, quote/history/reconciliation validation, rejected stdio order actions, and shutdown.
- `scripts\smoke-windows-installer.ps1` installs the final candidate, verifies the visible app window and bundled connector child process, checks connector exit after app shutdown, silently uninstalls, and removes only its unique temporary install directory. This passed on Windows 11 x64 build 26200. A direct packaged connector protocol check returned `CONNECTED_READ_ONLY`, explicitly reported `order_submission=False`, then exited cleanly on shutdown. This is one host/account snapshot, not a full support or reconnect matrix.

## Windows candidate artifact

- Exact local artifact: `src-tauri\target\release\bundle\nsis\Ultimate AI Trading_1.0.0_x64-setup.exe`
- Version: 1.0.0; x64; built 2026-10-11; **unsigned, unpublished candidate only**
- Size: **23,654,406 bytes** (22.56 MiB)
- SHA-256: **`F9E4F05FAE1394B7A3793FDE904946BEF3C093E7AF40831D28C5CE0B12C18300`**
- Authenticode: **NotSigned**. Approved signing identity, trusted certificate chain, and SmartScreen reputation are not verified.
- Build command: `npm run tauri:windows:build`. It runs `scripts\build-windows-installer.ps1`, PyInstaller, `npm run build`, and Tauri NSIS packaging. Toolchain: Python 3.14.7, PyInstaller 6.22.3, MetaTrader5 5.0.6180, psutil 7.2.2, Rust/Cargo stable 1.99.0, Tauri CLI 2.12.2, MSVC 14.51.36231, Windows SDK 10.0.26100. The script establishes explicit MSVC/SDK paths to avoid Git's Unix linker shadowing `link.exe`.
- The checksum was computed on the final installer and must be recomputed after any subsequent rebuild/signing. It identifies this exact unsigned local artifact only.
- Nothing was uploaded, published, or released. The tested host does not establish the minimum/supported Windows OS range or SmartScreen reputation.

## Validation

- `npm run test` — **37/37 passed**.
- `npm run lint` — passed (`tsc --noEmit`).
- `npm run build` — passed (TypeScript and Vite production build).
- `python -m unittest discover -s .\local-adapter\tests -v` — **22/22 passed**.
- `cargo check --manifest-path .\src-tauri\Cargo.toml` — passed.
- `git diff --check` — passed; only line-ending normalization notices for `bun.lock` and `package.json`.
- `npm run tauri:windows:build` — passed; produced the artifact above.
- Packaged connector stdio snapshot/order-denial/shutdown — passed on the build host; actual state `CONNECTED_READ_ONLY`, `place_demo_order` rejected, `order_submission=false`.
- Final installer install/startup/visible-window/connector-launch/connector-shutdown/uninstall smoke test — passed on Windows 11 x64 build 26200.
- Authentication, credential storage, update/upgrade behavior, supported OS matrix, all multi-terminal/login/reconnect states, and independent verification of real-account identity remain unverified. No automated broker orders were tested or sent.

## Other platforms and release blockers

| Platform | Result | Remaining requirements |
|---|---|---|
| Windows | Local unsigned NSIS candidate verified as described above | Approved publicly trusted Authenticode Code Signing EKU certificate and secure signing access; signature/chain verification; SmartScreen assessment; defined OS support and update/reconnect/security tests |
| macOS | Not built | macOS host/Xcode, Apple Developer access, Developer ID signing, notarization, supported-OS and device verification |
| Android | Not built | JDK, Android SDK/NDK/Gradle, user-controlled release signing key, device install/update tests |
| iOS/iPadOS | Not built; no IPA | macOS/Xcode, Apple Distribution identity, provisioning/TestFlight setup, supported-device verification |

No package is release-ready or available for download. Do not publish externally without explicit authorization. Never put broker credentials, signing keys, keystore passwords, or provisioning secrets in chat or source.

## Next action

For Windows distribution, provision an approved Authenticode signing identity using a protected local certificate store, hardware-backed provider, or approved signing service, then sign and verify the final artifact and assess SmartScreen on that signed build. For cross-platform releases, provision Android's toolchain/key and the promised Mac/Xcode/Apple Developer setup. Keep demo and live order entry blocked until execution, risk, reconciliation, recovery, and release approval gates are implemented and verified.
