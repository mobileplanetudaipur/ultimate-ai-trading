# Windows Candidate Build Provenance

## Source state

- Repository: `siyalsandeep/ultimate-ai-trading`
- Worktree: `UltimateAITradingBot/mobileplanetudaipur-silver-doodle`
- Branch: `mobileplanetudaipur-trading-bot-improvements`
- Git HEAD: `1c54ad73671ce9a53013335a6ce5cc3a99148288`
- Source used: the above HEAD plus the then-current uncommitted working-tree changes. The worktree contains pre-existing tracked modifications and untracked project files; they were preserved. No commit or push was made.
- The installer was built from this worktree using `scripts\build-windows-installer.ps1`. This record does **not** prove the output matches the previously installed app SHA-256 `2113607612C73B39A8F37221BC1551C417521256A95B845DC02B855ED8A43D70` or connector SHA-256 `06ED6A28C29EF7A2539122FD4B794E636D914C44A3C21720794DE4268BC07197`.

## Build configuration and dependencies

- Build command: `& .\scripts\build-windows-installer.ps1`
- Connector packaging: PyInstaller `--onedir`, entry point `local-adapter\connector_main.py`, including the pinned MetaTrader5, NumPy, and psutil runtimes.
- Native package: Tauri 2 Windows x64 NSIS; Windows config `src-tauri\tauri.windows.conf.json`.
- User instructions: `docs\XM_ORDER_GUIDE.md` is bundled into the installer at `instructions\XM_ORDER_GUIDE.md`.
- Relevant dependency records: `bun.lock`, `src-tauri\Cargo.lock`, `local-adapter\requirements.txt`, and `local-adapter\build-requirements.txt`.
- Build host/toolchain: Windows 11 x64 build 26200; Python 3.14.7; PyInstaller 6.22.3; MetaTrader5 5.0.6180; psutil 7.2.2; Rust/Cargo 1.99.0; Tauri CLI 2.12.2; MSVC 14.51.36231; Windows SDK 10.0.26100.

## Candidate artifacts

| Artifact | Exact path | Size | SHA-256 | Authenticode |
|---|---|---:|---|---|
| Windows NSIS installer | `src-tauri\target\release\bundle\nsis\Ultimate AI Trading_1.0.0_x64-setup.exe` | 24,400,675 bytes | `BA5967F8870872B264B1E7A14A761ACA9DA88B47BEE938A243942EE931AE7B20` | `NotSigned` |
| Native app executable | `src-tauri\target\release\ultimate-ai-trading.exe` | 8,913,920 bytes | `FF1475ACAF3A12E1FF74BF415667C212C025CDDB30DFA211DAAACE06BE782AF2` | `NotSigned` |
| MT5 connector executable | `local-adapter\dist\mt5-connector\mt5-connector.exe` | 8,418,457 bytes | `FC5C479040355B3D05DD944F1E460E3ABD754EDA4B8D44AB0A9ED4E3D9FDFA74` | `NotSigned` |

## Verification performed

- `npm run lint`: passed.
- `npm run test`: 37/37 passed.
- `python -m unittest discover -s local-adapter\tests -v`: 33 tests passed; broker-order tests use a fake MT5 API.
- `cargo check --manifest-path src-tauri\Cargo.toml`: passed.
- Packaged connector stdio check with `AITRADING_DISABLE_MT5_DISCOVERY=1`: reported `WAITING_FOR_TERMINAL`, rejected enable/prepare/submit without a terminal, locked, and shut down cleanly.
- Installer smoke: `& .\scripts\smoke-windows-installer.ps1 -InstallerPath '.\src-tauri\target\release\bundle\nsis\Ultimate AI Trading_1.0.0_x64-setup.exe'` passed. It verified the bundled setup guide, installed to a temporary directory, launched the visible app and bundled connector, shut both down, uninstalled, and cleaned the temporary directory. MT5 discovery was disabled for the smoke process.
- The current-user certificate-store check found no private certificate with the Authenticode Code Signing EKU. The installer remains unsigned.
- No installed-user app was replaced. No MT5 terminal was connected and no order was submitted.

## Limitations

Build, mock tests, and isolated installation do not verify a real XM connection, broker preflight semantics, actual fills, ambiguous-order recovery, live trading, or the source of any previously installed binary. Unknown/interrupted order outcomes safely block additional orders but do not have an automatic in-app resolution flow. Strategy automation is not connected to the manual demo ticket; live order submission remains locked. Do not distribute this unsigned local candidate as a verified release.
