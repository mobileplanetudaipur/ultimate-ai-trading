# Downloads and Release Status

**There are no signed, public, or distributed release packages.** The local Windows NSIS installer listed below was built from the current worktree and passed an isolated install/startup/uninstall smoke test. It is unsigned and is not a signed release. No artifact has been uploaded or released. Current app version: **1.0.0**.

| Platform/package | Artifact | Tested device / OS | Version | Build date | Size | Signing / verification | SHA-256 | Installation / availability |
|---|---|---|---|---|---:|---|---|---|
| Windows NSIS local candidate | `src-tauri\target\release\bundle\nsis\Ultimate AI Trading_1.0.0_x64-setup.exe` | Windows 11 x64 build 26200 | 1.0.0 | 2026-10-11; not released | 24,400,675 bytes | Authenticode `NotSigned`; isolated install/startup/uninstall smoke test passed with MT5 discovery disabled and the usage guide present; no signing certificate available. | `BA5967F8870872B264B1E7A14A761ACA9DA88B47BEE938A243942EE931AE7B20` | Local candidate only. Not uploaded or distributed; do not treat as signed or verified against any previously installed build.
| macOS disk image (`.dmg`) or package (`.pkg`) | Not built | Not tested | 1.0.0 source only | Not released | N/A | Not signed or notarized; no macOS build host/Xcode verified | N/A | No installer. |
| Android release (`.apk`; `.aab` if needed for Google Play) | Not built | Not tested | 1.0.0 source only | Not released | N/A | Not signed; Android toolchain and release key unavailable here | N/A | No package. |
| iOS/iPadOS app for TestFlight/App Store | Not built | Not tested | 1.0.0 source only | Not released | N/A | No Apple signing/provisioning/archive/TestFlight verification. **No installable IPA is available.** | N/A | No app build. |

## Windows candidate build and verification

- Build command: `& .\scripts\build-windows-installer.ps1`; PyInstaller bundled the connector and Tauri produced the NSIS installer successfully.
- Build script: `scripts\build-windows-installer.ps1` (PyInstaller connector bundle plus Tauri NSIS package); explicit host MSVC and Windows SDK linker/include/library paths are configured in the script.
- Toolchain: Windows 11 x64 build 26200; Python 3.14.7; PyInstaller 6.22.3; MetaTrader5 5.0.6180; psutil 7.2.2; Rust/Cargo stable 1.99.0; Tauri CLI 2.12.2; MSVC 14.51.36231; Windows SDK 10.0.26100.
- Smoke command: `& .\scripts\smoke-windows-installer.ps1 -InstallerPath '.\src-tauri\target\release\bundle\nsis\Ultimate AI Trading_1.0.0_x64-setup.exe'`. Installation to a temporary directory, visible app startup, bundled connector launch, shutdown, uninstall, and cleanup passed.
- During the smoke test and packaged-connector protocol check, `AITRADING_DISABLE_MT5_DISCOVERY=1` prevented MT5 process discovery. No MT5 terminal was connected and no broker order was submitted.

- Current-source checks: app tests 37/37; lint passed; production build passed; 33 adapter/mock-order tests passed; Rust `cargo check` passed; packaged connector fail-closed stdio check passed; installer smoke test passed.
- App executable SHA-256: `FF1475ACAF3A12E1FF74BF415667C212C025CDDB30DFA211DAAACE06BE782AF2`. Connector executable SHA-256: `FC5C479040355B3D05DD944F1E460E3ABD754EDA4B8D44AB0A9ED4E3D9FDFA74`. Installer checksum is listed above.
- The new candidate hashes are not connected to the hashes of the previously installed app/connector; they must not be presented as its source.
- Tested Windows 11 build 26200 is the build host only; minimum/supported OS versions, update behavior, and SmartScreen reputation have not been established.

## Device capabilities and limits

- **Browser, desktop or mobile:** responsive app; synthetic quotes/candles and local paper simulation. Checkpoints use browser-local storage.
- **Windows app on the MT5 computer:** the candidate app automatically observes an already-running, already-authenticated XM MT5 demo/live terminal and exposes a session-gated, manually confirmed demo-order ticket. Live writes remain hard-locked, and strategy automation is not connected. The smoke test does not verify MT5 behavior. Authentication stays in official MT5.
- **Windows browser adapter:** separate manual local workflow; read-only and loopback-only. It is not a remote network service.
- **macOS, Android, and iOS/iPadOS:** no direct Windows MT5 terminal access. Broker connectivity is unavailable until a deliberately secured, authenticated remote service is separately designed, authorized, implemented, and verified.
- **Automated trading:** local paper simulation remains separate. The manual demo ticket is not controlled by any strategy. Broker-result and recovery behavior were tested only with a fake MT5 API; full portfolio reconciliation, automatic recovery of unknown/interrupted outcomes, and soak testing remain blockers to operational reliance. Live order submission remains locked pending separate release approval and deliberate activation after its gates pass. No strategy can guarantee returns or eliminate losses.

## Publication and artifact verification gate

Do not upload, publish, or distribute an artifact until the user explicitly authorizes it. For each release candidate, record source revision, exact build command, tool versions, supported OS/device matrix, install/startup/update test results, file size, and SHA-256. Verify platform signature; macOS must also be notarized, and iOS must have valid distribution provisioning and TestFlight/App Store eligibility. Compute SHA-256 again after signing, then verify the published/downloaded file against that digest. No unsupported OS range, package link, size, signing state, or checksum should be claimed.

### Windows signing

The current candidate is unsigned. Signing requires an approved, publicly trusted Authenticode certificate with Code Signing EKU (`1.3.6.1.5.5.7.3.3`) and secure access to its private key, e.g. protected local certificate store, hardware-backed provider, or approved signing service/CI. Never commit keys, place certificate passwords in command lines, or send either in chat. Sign the final installer with SHA-256 and an RFC 3161 timestamp; verify its chain and signature with `signtool verify /pa /all /v`. Do not self-sign or describe an untrusted signature as trusted. SmartScreen reputation is a separate check.

For checksum verification:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath .\path\to\artifact
```


## Current source build record

See [candidate build provenance](BUILD_PROVENANCE.md) for source revision, artifact hashes, connector check, tests, and installer smoke-test record. The app, connector, and installer are unsigned local build outputs. This candidate is not proven to match previously installed binaries and is not a signed public release.
