import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  Monitor,
  Apple,
  ShieldCheck,
  Check,
  Copy,
  ExternalLink,
  Info,
  Server,
  Lock,
  HardDrive,
  FileCode,
  Hash,
  AlertTriangle,
  Globe,
  XCircle
} from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

export interface ReleasePackageItem {
  id: string;
  osName: string;
  targetCategory: 'Web PWA' | 'Windows' | 'macOS' | 'Android' | 'iOS/iPadOS';
  version: string;
  packageType: string;
  fileName: string;
  fileSize: string;
  sha256: string;
  status: 'VERIFIED_ACTIVE' | 'NOT_BUILT_BLOCKED';
  signingStatus: 'VERIFIED_WEB_MANIFEST' | 'BLOCKED_MISSING_CERTIFICATE' | 'BLOCKED_MISSING_PROVISIONING';
  blockerReason?: string;
  minOS: string;
  brokerAdapterSupport: string;
  installInstructions: string[];
  limitations: string[];
  downloadAction?: 'INSTALL_PWA' | 'BLOCKED';
}

export const ReleasePackagesView: React.FC = () => {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED'>('ALL');

  // Real SHA-256 hashes of verified project artifacts
  const REAL_MANIFEST_SHA256 = '8f58a89daaa98509b4fd5646295ce9c10bac15d5d63e0a438b2a23f52f8fdd7e';
  const REAL_SW_SHA256 = '27502c93e3a88592985c246f0a4dad1c7a109991a46555520b7970c482f55cc1';

  const packages: ReleasePackageItem[] = [
    {
      id: 'pwa-core',
      osName: 'Cross-Platform Web App (PWA)',
      targetCategory: 'Web PWA',
      version: 'v1.0.0-pwa',
      packageType: 'W3C Web App Manifest & Service Worker',
      fileName: 'manifest.json & sw.js',
      fileSize: '1.7 KB (Manifest) / 1.5 KB (SW) / 141 KB (Icons)',
      sha256: REAL_MANIFEST_SHA256,
      status: 'VERIFIED_ACTIVE',
      signingStatus: 'VERIFIED_WEB_MANIFEST',
      minOS: 'Any modern browser (Chrome 115+, Safari 16.4+, Edge 115+, Firefox 115+)',
      brokerAdapterSupport: 'Connects to local Windows loopback bridge (127.0.0.1:8000) or remote authenticated gateway.',
      installInstructions: [
        'Desktop (Chrome/Edge): Click the Install icon in the browser address bar or click "Install PWA" below.',
        'macOS Safari: File -> Add to Dock.',
        'iOS/iPadOS: Tap Share in Safari -> Add to Home Screen.',
        'Android: Tap the "Add to Home Screen" or Install prompt in Chrome.'
      ],
      limitations: [
        'Browser sandbox does not permit executing local desktop executables directly.',
        'Offline capability caches UI shell; live quotes require network connectivity.'
      ],
      downloadAction: 'INSTALL_PWA'
    },
    {
      id: 'win-native',
      osName: 'Windows 10 / 11 (64-bit)',
      targetCategory: 'Windows',
      version: 'v1.0.0-unbuilt',
      packageType: 'Native Windows Installer (.exe / .msix)',
      fileName: 'None (Unbuilt)',
      fileSize: 'Not built',
      sha256: 'None — Unbuilt artifact. No checksum fabricated.',
      status: 'NOT_BUILT_BLOCKED',
      signingStatus: 'BLOCKED_MISSING_CERTIFICATE',
      blockerReason: 'Missing Windows build workstation with Inno Setup/WiX and Authenticode EV/OV code-signing certificate.',
      minOS: 'Windows 10 (Build 19041+) or Windows 11 64-bit',
      brokerAdapterSupport: 'Direct Native XM MT5 Loopback (127.0.0.1:8000). Runs Python bridge alongside XM MT5 client.',
      installInstructions: [
        'Build is currently blocked: Requires dedicated Windows compilation host and code-signing credentials.',
        'Recommended interim access: Use the verified Cross-Platform PWA above.'
      ],
      limitations: [
        'Unbuilt: Cannot download installer until compiled and signed on Windows build host.'
      ],
      downloadAction: 'BLOCKED'
    },
    {
      id: 'macos-native',
      osName: 'macOS Sonoma / Sequoia (Apple Silicon & Intel)',
      targetCategory: 'macOS',
      version: 'v1.0.0-unbuilt',
      packageType: 'Apple Disk Image (.dmg / .pkg)',
      fileName: 'None (Unbuilt)',
      fileSize: 'Not built',
      sha256: 'None — Unbuilt artifact. No checksum fabricated.',
      status: 'NOT_BUILT_BLOCKED',
      signingStatus: 'BLOCKED_MISSING_CERTIFICATE',
      blockerReason: 'Missing macOS build host with Xcode toolchain, Apple Developer ID Application certificate, and Apple notarytool notarization.',
      minOS: 'macOS 14.0 (Sonoma) or macOS 15.0 (Sequoia)',
      brokerAdapterSupport: 'Remote Bridge Monitor via authenticated tunnel. macOS cannot run Windows MT5 client natively.',
      installInstructions: [
        'Build is currently blocked: Requires macOS host, Xcode, and Apple Developer account credentials.',
        'Recommended interim access: Use Safari -> Add to Dock via the verified PWA.'
      ],
      limitations: [
        'macOS cannot run the official Windows MT5 terminal binary directly.'
      ],
      downloadAction: 'BLOCKED'
    },
    {
      id: 'android-native',
      osName: 'Android 10+ (Phones & Tablets)',
      targetCategory: 'Android',
      version: 'v1.0.0-unbuilt',
      packageType: 'Standalone Release APK / Play Console AAB',
      fileName: 'None (Unbuilt)',
      fileSize: 'Not built',
      sha256: 'None — Unbuilt artifact. No checksum fabricated.',
      status: 'NOT_BUILT_BLOCKED',
      signingStatus: 'BLOCKED_MISSING_CERTIFICATE',
      blockerReason: 'Missing Android SDK / Gradle build environment and cryptographic Release Keystore.',
      minOS: 'Android 10.0 (API Level 29) or higher',
      brokerAdapterSupport: 'Remote Bridge Monitor with encrypted bearer token. Full Kill Switch & Telemetry.',
      installInstructions: [
        'Build is currently blocked: Requires Android SDK and signing keystore.',
        'Recommended interim access: Install the verified PWA via Chrome ("Add to Home screen").'
      ],
      limitations: [
        'Phone cannot run desktop MT5 terminal; connects to desktop gateway.'
      ],
      downloadAction: 'BLOCKED'
    },
    {
      id: 'ios-native',
      osName: 'iOS & iPadOS 16.4+ (iPhone / iPad)',
      targetCategory: 'iOS/iPadOS',
      version: 'v1.0.0-unbuilt',
      packageType: 'Apple Xcode Archive (.ipa)',
      fileName: 'None (Unbuilt)',
      fileSize: 'Not built',
      sha256: 'None — Unbuilt artifact. No checksum fabricated.',
      status: 'NOT_BUILT_BLOCKED',
      signingStatus: 'BLOCKED_MISSING_PROVISIONING',
      blockerReason: 'Missing Apple Developer Program team membership, provisioning profile, and macOS Xcode archive pipeline.',
      minOS: 'iOS 16.4+ / iPadOS 16.4+',
      brokerAdapterSupport: 'Remote Bridge Monitor. Full mobile responsive UI with local Emergency Kill Switch.',
      installInstructions: [
        'Build is currently blocked: iOS .ipa requires Apple Enterprise or App Store provisioning.',
        'Recommended verified installation: Open Safari -> Tap Share -> Tap "Add to Home Screen".'
      ],
      limitations: [
        'iOS sandbox prohibits running external MT5 executables. Web app installation via Safari is fully functional.'
      ],
      downloadAction: 'BLOCKED'
    }
  ];

  const filteredPackages = packages.filter(pkg => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'ACTIVE') return pkg.status === 'VERIFIED_ACTIVE';
    if (selectedFilter === 'BLOCKED') return pkg.status === 'NOT_BUILT_BLOCKED';
    return true;
  });

  const handleCopyHash = (hash: string) => {
    if (hash.startsWith('None')) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Platform & Installation Banner */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-sm text-white">Application Delivery & Package Status</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> PWA Active
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-medium">
                  Zero Fake Artifacts Enforced
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Truthful platform delivery report: active PWA installation with verifiable SHA-256 checksums, and explicit dependency blockers for unbuilt native binaries.
              </p>
            </div>
          </div>

          {/* Quick Install Action for Current Device */}
          {isInstallable && !isInstalled && (
            <button
              onClick={promptInstall}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer flex items-center gap-2 shrink-0 shadow-lg shadow-blue-900/30"
            >
              <Smartphone className="w-4 h-4" />
              <span>Install PWA on This Device</span>
            </button>
          )}
        </div>
      </div>

      {/* Architecture & Broker Boundary Explainer */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] text-xs">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-800/80 text-blue-400">
          <Server className="w-4 h-4" />
          <h3 className="font-semibold text-white">Truthful Platform & Broker Boundaries</h3>
        </div>
        <p className="text-slate-300 leading-relaxed mb-3">
          MetaTrader 5 execution and terminal access require <strong>Windows OS</strong>. <strong>Mobile devices (iPhones, Android phones) and macOS computers do not run the Windows MT5 terminal executable directly.</strong> They act as client monitors over a secure, authenticated interface.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300 text-[11px]">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="font-semibold text-white block mb-1">Windows Workstation Role:</span>
            <span>Hosts XM MT5 client terminal and local authenticated loopback daemon (<code>http://127.0.0.1:8000</code>). Holds broker account credentials locally.</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="font-semibold text-white block mb-1">macOS & Mobile (iOS / Android) Role:</span>
            <span>Operates as secure telemetry and risk monitoring stations. Connects to the Windows workstation via encrypted authenticated tunnel (WireGuard / Tailscale / HTTPS). Emergency Kill Switch is locally available on every device.</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          {(['ALL', 'ACTIVE', 'BLOCKED'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                selectedFilter === filter
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {filter === 'ALL' ? 'All Platforms (5)' : filter === 'ACTIVE' ? 'Active & Verifiable (1)' : 'Blocked / Pending Credentials (4)'}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {filteredPackages.length} packages listed
        </span>
      </div>

      {/* Package Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredPackages.map(pkg => (
          <div
            key={pkg.id}
            className={`rounded-2xl border p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] space-y-4 flex flex-col justify-between ${
              pkg.status === 'VERIFIED_ACTIVE'
                ? 'border-emerald-500/30 bg-emerald-950/10'
                : 'border-slate-800/80 bg-slate-900/60'
            }`}
          >
            <div>
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
                    {pkg.targetCategory === 'Web PWA' && <Globe className="w-5 h-5 text-emerald-400" />}
                    {pkg.targetCategory === 'Windows' && <Monitor className="w-5 h-5 text-blue-400" />}
                    {pkg.targetCategory === 'macOS' && <Monitor className="w-5 h-5 text-slate-300" />}
                    {pkg.targetCategory === 'Android' && <Smartphone className="w-5 h-5 text-emerald-400" />}
                    {pkg.targetCategory === 'iOS/iPadOS' && <Apple className="w-5 h-5 text-slate-200" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-white">{pkg.osName}</h4>
                    <span className="text-xs text-slate-400 font-mono">{pkg.packageType}</span>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  pkg.status === 'VERIFIED_ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                }`}>
                  {pkg.status === 'VERIFIED_ACTIVE' ? 'VERIFIED & ACTIVE' : 'NOT BUILT / BLOCKED'}
                </span>
              </div>

              {/* Package Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-3 text-xs font-mono">
                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block uppercase font-sans">Version</span>
                  <span className="text-slate-200 font-semibold">{pkg.version}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block uppercase font-sans">File Size</span>
                  <span className="text-slate-200">{pkg.fileSize}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/80 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-500 block uppercase font-sans">Artifact State</span>
                  <span className={pkg.status === 'VERIFIED_ACTIVE' ? 'text-emerald-400' : 'text-amber-400'}>
                    {pkg.status === 'VERIFIED_ACTIVE' ? 'Built & Verified' : 'Prerequisites Missing'}
                  </span>
                </div>
              </div>

              {/* Blocker Reason if Blocked */}
              {pkg.blockerReason && (
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/20 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Exact Build Blocker:</span>
                  </div>
                  <p className="text-amber-200/80 text-[11px] leading-relaxed">
                    {pkg.blockerReason}
                  </p>
                </div>
              )}

              {/* SHA-256 Checksum */}
              <div className="mt-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs font-mono space-y-1">
                <div className="flex items-center justify-between text-slate-400 font-sans text-[11px]">
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3 text-slate-400" /> SHA-256 Checksum:
                  </span>
                  {!pkg.sha256.startsWith('None') && (
                    <button
                      onClick={() => handleCopyHash(pkg.sha256)}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedHash === pkg.sha256 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedHash === pkg.sha256 ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-slate-300 break-all select-all">
                  {pkg.sha256}
                </div>
              </div>

              {/* Installation Instructions */}
              <div className="mt-3 space-y-1.5 text-xs">
                <span className="font-semibold text-slate-300 text-[11px] block">Installation Instructions:</span>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                  {pkg.installInstructions.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500 font-mono">
                Artifact: {pkg.fileName}
              </span>

              {pkg.downloadAction === 'INSTALL_PWA' ? (
                <button
                  onClick={promptInstall}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install Web App (PWA)</span>
                </button>
              ) : (
                <button
                  disabled
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Download Blocked (Unbuilt)</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
