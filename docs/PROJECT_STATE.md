# Project State

Last verified: 2026-10-11

## Current implementation

- React 19 / TypeScript app with browser-local paper simulation, risk controls, and persistent local strategy run controls.
- Tauri 2 Windows app supervises the bundled MT5 connector over private stdio IPC. It discovers an already-running terminal and never handles the broker password.
- Connections & Settings displays terminal/account status and offers a manual XM demo order ticket. Session enable requires an exact phrase; each order is separately broker-checked, reviewed, and confirmed.
- The connector records `SUBMITTING` before `order_send`, reports actual response states, and blocks new orders on `UNKNOWN` or interrupted submission records. Account changes, disable, and disconnect clear pending review tokens.
- Strategy proposals remain paper-only. The live order path is hard-locked by `LIVE_RELEASE_APPROVED = False` in the executor; live logins remain read-only.
- Browser charts and paper fills remain synthetic. Its optional loopback adapter is read-only and separate from the native Windows connector.

## Verified in this worktree

- `npm run lint`: passed.
- `npm run test`: 37/37 passed.
- `python -m unittest discover -s local-adapter\tests -v`: 33 tests passed. Execution tests use a fake MT5 API.
- `cargo check --manifest-path src-tauri\Cargo.toml`: passed.
- Packaged connector stdio check ran with MT5 discovery disabled: reported `WAITING_FOR_TERMINAL`, rejected enable/prepare/submit without a terminal, then locked and shut down.
- Windows NSIS installer built and passed isolated install/startup/uninstall smoke testing. The smoke test disables MT5 discovery and uses a temporary install directory.
- `Get-AuthenticodeSignature`: `NotSigned`. No matching private code-signing certificate was present in the current-user certificate store.
- No MT5 connection or broker order was made during development or release checks.

## Release artifact

- Installer: `src-tauri\target\release\bundle\nsis\Ultimate AI Trading_1.0.0_x64-setup.exe`
- Size: 24,400,675 bytes
- SHA-256: `BA5967F8870872B264B1E7A14A761ACA9DA88B47BEE938A243942EE931AE7B20`
- Unsigned local candidate only; not uploaded, published, or installed over the existing app.
- The installer includes `XM_ORDER_GUIDE.md`, verified by the isolated smoke test.

## Source and provenance

- Repository: `siyalsandeep/ultimate-ai-trading`
- Branch: `mobileplanetudaipur-trading-bot-improvements`
- HEAD: `1c54ad73671ce9a53013335a6ce5cc3a99148288`
- Worktree has tracked changes and untracked files; they were preserved and remain uncommitted. No push or deployment occurred.
- This new candidate has not been proven to match the previously installed app or connector hashes supplied earlier. The smoke test installed it temporarily, then uninstalled it.

## Remaining blockers

- No XM demo connection, actual order, broker fill, or real-terminal response has been verified. Passing fake-API tests do not prove broker behavior.
- Automatic resolution of unknown/interrupted orders is not implemented. The local ledger safely blocks follow-on orders but may require support to recover.
- Strategy-to-broker routing, live-order release approval, 24/7 service operation, and complete broker/app recovery remain unavailable.
- The installer is unsigned; a trusted publisher certificate/signing process was not available. Do not distribute it as a signed release.
- macOS, Android, and iOS/iPadOS packages are not built.
