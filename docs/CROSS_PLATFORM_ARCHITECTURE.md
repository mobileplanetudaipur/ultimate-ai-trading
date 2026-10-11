# Cross-Platform Architecture & MT5 Broker Boundary Specification

## 1. Executive Summary & Architecture Selection

### Core Decision: Progressive Web Architecture (PWA) + Local Daemon IPC + Native Container Packaging (Capacitor / Electron Architecture Model)

To install and run **Ultimate AI Trading** seamlessly across **Windows, macOS, Android (phones/tablets), and iOS/iPadOS (iPhones/iPads)** while preserving the existing verified React 19 / TypeScript codebase:
1. **Shared Presentation & Business Logic Core:**
   - Single source of truth in TypeScript/React (`src/`).
   - Zero duplicated logic for risk checks (`riskEngine.ts`), order lifecycle (`orderLifecycleManager.ts`), strategy verification (`strategyEngine.ts`), and live release gating (`liveReleaseGateService.ts`).
   - Fully standards-compliant PWA manifest (`manifest.json`), service worker, and responsive viewport ergonomics meeting Apple HIG and Material Design standards.
2. **Platform Native Shells:**
   - **Windows:** Progressive Desktop Web App & Electron/MSIX wrapper targeting Windows 10/11 (x64 / ARM64).
   - **macOS:** Progressive Desktop Web App & macOS native package container (`.dmg` / `.pkg`) targeting macOS Sonoma / Sequoia (Apple Silicon & Intel).
   - **Android:** Progressive Web App & Android App Bundle (`.aab` / `.apk`) targeting Android 10+ (API 29+).
   - **iOS / iPadOS:** Progressive Web App (Add to Home Screen standalone full screen) & Capacitor/Xcode project ready for TestFlight / App Store provisioning targeting iOS/iPadOS 16+.

---

## 2. Platform & Broker Boundaries (XM / MetaTrader 5 Adapter)

### The Inviolable Windows MT5 Constraint:
The official MetaTrader 5 client terminal and its native IPC Python library (`MetaTrader5`) run **exclusively on Windows OS** (or complex Wine setups on x86). Mobile devices (iPhones, Android phones) and Apple Silicon macOS **cannot directly run the Windows MT5 desktop terminal executable or load its Windows DLLs**.

### Distributed Architecture Model:
```
┌────────────────────────────────────────────────────────────────────────┐
│                        USER'S WINDOWS WORKSTATION                      │
│                                                                        │
│   ┌──────────────────────────┐         ┌───────────────────────────┐   │
│   │   Official MetaTrader 5  │  IPC    │   Local Python MT5 Bridge │   │
│   │   Terminal (XMGlobal)    │◄───────►│   (FastAPI/Uvicorn Daemon)│   │
│   │   * Holds credentials    │         │   http://127.0.0.1:8000   │   │
│   └──────────────────────────┘         └─────────────┬─────────────┘   │
│                                                      │                 │
│                                             mTLS / WireGuard /         │
│                                             Encrypted Tailscale Token  │
└──────────────────────────────────────────────────────┼─────────────────┘
                                                       │
                           ┌───────────────────────────┴───────────────────────────┐
                           ▼                                                       ▼
            ┌─────────────────────────────┐                         ┌─────────────────────────────┐
            │   macOS & Desktop Clients   │                         │  Mobile Clients (iOS/Droid) │
            │   (Full Telemetry & Mgmt)   │                         │   (Monitoring & Kill Switch)│
            │   - Read-only Telemetry     │                         │   - Read-only Telemetry     │
            │   - Risk Budget Inspection  │                         │   - Emergency Kill Switch   │
            │   - Order Approvals (Demo)  │                         │   - Push Notification Alert │
            └─────────────────────────────┘                         └─────────────────────────────┘
```

### Security & Credential Isolation Rules:
1. **Zero Credentials in Transit or App Bundles:** Broker account numbers, master passwords, investor passwords, and server names are **NEVER** stored in mobile apps, web bundles, git commits, or logs.
2. **Local Tokenized Gateway:** The local bridge binds to `127.0.0.1:8000` on Windows. For remote macOS or mobile connections, access must use authenticated tunnels (e.g. WireGuard, Tailscale, or client certificate mTLS with Bearer JWT tokens).
3. **Emergency Disconnect:** All platforms have an immediate local **Kill Switch** that halts order dispatch even if remote broker connectivity is degraded.

---

## 3. Platform Matrix & Feature Availability

| Platform | Primary Distribution | Secondary Distribution | MT5 Direct Terminal Execution | Telemetry & Risk Monitor | Strategy Signals | Emergency Kill Switch | Order Execution (Demo) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Windows 10/11** | Standalone PWA / MSIX | Signed `.exe` Installer | **YES** (Direct Local MT5 Loopback) | **Full** | **Full** | **Full** | **Direct Local IPC** |
| **macOS (Sonoma+)** | Standalone PWA / `.dmg` | Signed `.pkg` Installer | **NO** (Connects via Remote Bridge) | **Full** | **Full** | **Full** | **Via Authenticated Bridge** |
| **Android (10+)** | Trusted Web App / `.apk` | Google Play `.aab` | **NO** (Connects via Remote Bridge) | **Full** | **Full** | **Full** | **Via Authenticated Bridge** |
| **iOS / iPadOS (16+)**| Safari Standalone PWA | TestFlight / App Store | **NO** (Connects via Remote Bridge) | **Full** | **Full** | **Full** | **Via Authenticated Bridge** |

---

## 4. Signing, Notarization & Distribution Prerequisites

### Windows Installer (`.exe` / MSIX):
- **Requirement:** Microsoft Authenticode Code Signing Certificate (EV or Standard from DigiCert / Sectigo) or self-signed developer certificate for side-loading.
- **Packaging Tool:** Inno Setup / electron-builder / WiX Toolset.
- **Status in Linux Build Container:** Binary packages can be staged; production signing requires the private HSM key/certificate.

### macOS Installer (`.dmg` / `.pkg`):
- **Requirement:** Apple Developer Program membership ($99/year), Developer ID Application Certificate, and `xcrun notarytool` notarization ticket.
- **Status in Linux Build Container:** Packaged artifact structures can be compiled; notarization requires Apple Developer credentials (`APPLE_ID`, `APP_SPECIFIC_PASSWORD`, `TEAM_ID`).

### Android (`.apk` / `.aab`):
- **Requirement:** Android SDK build-tools, Java Keytool keystore (`upload-key.keystore`), Google Play Developer Console account ($25 one-time).
- **Status in Linux Build Container:** Web assets build cleanly into PWA/TWA; release keystore must be user-provided for Play Store signature.

### iOS / iPadOS:
- **Requirement:** Apple Developer Program, iOS Distribution Certificate, App Store Provisioning Profile, macOS machine with Xcode 15+ for archive generation.
- **PWA Alternative (Zero Provisioning Needed):** Standard Safari "Add to Home Screen" provides 100% full-screen standalone application behavior, offline asset caching, and persistent local storage without Apple developer fees or app store review delays.
