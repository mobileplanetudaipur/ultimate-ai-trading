import React, { useState } from 'react';
import { Eye, ShieldCheck, XCircle, CheckCircle2, RefreshCw, Code2, AlertTriangle } from 'lucide-react';

interface PingResult {
  status: 'DISCONNECTED' | 'REACHABLE';
  latencyMs?: number;
  message: string;
  timestamp: number;
}

export const ShadowDemoView: React.FC = () => {
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<'status' | 'account' | 'symbols'>('status');

  const handleTestPing = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      
      const res = await fetch('http://127.0.0.1:8000/v1/status', {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const elapsed = Math.round(performance.now() - start);

      if (res.ok || res.status === 401 || res.status === 429) {
        setPingResult({
          status: 'REACHABLE',
          latencyMs: elapsed,
          message: `The optional local read-only endpoint responded with HTTP ${res.status} (${elapsed}ms). Authentication is required; this check did not read MT5 or verify an account.`,
          timestamp: Date.now()
        });
      } else {
        setPingResult({
          status: 'DISCONNECTED',
          message: `The local endpoint responded with status ${res.status}. No MT5 account state was verified.`,
          timestamp: Date.now()
        });
      }
    } catch (err: any) {
      setPingResult({
        status: 'DISCONNECTED',
        message: 'The local endpoint could not be reached. No broker or MT5 state was verified.',
        timestamp: Date.now()
      });
    } finally {
      setIsPinging(false);
    }
  };

  const endpointSchemas = {
    status: {
      method: 'GET',
      path: '/v1/status',
      description: 'Optional browser-only read-only adapter route. Requires its in-memory bearer token; a route response does not enable order submission.',
      sampleResponse: 'Authorized response contains terminal and verified account-mode status.'
    },
    account: {
      method: 'GET',
      path: '/v1/account',
      description: 'Optional browser-only read-only account snapshot. Requires the local bearer token and a verified signed-in XM MT5 terminal.',
      sampleResponse: 'Authorized response contains the terminal-reported account snapshot.'
    },
    symbols: {
      method: 'GET',
      path: '/v1/symbols',
      description: 'Optional browser-only read-only visible-symbol list. Requires the local bearer token; it does not expose order submission.',
      sampleResponse: 'Authorized response contains exact visible terminal symbol names and metadata.'
    }
  };

  return (
    <div className="space-y-6">
      {/* Gateway Status Header */}
      <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800/80">
          <Eye className="w-5 h-5 text-sky-400" />
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-sans">
            XM Integration Boundaries
          </h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          The Windows app supervises a bundled XM MT5 connector. Open Connections & Settings for its live connection state and gated manual demo ticket. This page does not read broker state; strategy proposals never submit orders, and live trading remains locked.
        </p>
      </div>

      {/* Gateway Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/60">
          <span className="text-[11px] text-slate-400 block mb-1">Windows Native Connector</span>
          <span className="font-mono font-medium text-white block truncate">Managed by the app</span>
          <span className="text-[11px] text-slate-400 block mt-1">Connection state is shown in Connections & Settings</span>
        </div>

        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20">
          <span className="text-[11px] text-slate-400 block mb-1">Optional Browser Adapter</span>
          <span className="font-mono font-medium text-slate-200 block">READ-ONLY · TOKEN REQUIRED</span>
          <span className="text-[11px] text-slate-400 block mt-1">Separate from the Windows native connector</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/60">
          <span className="text-[11px] text-slate-400 block mb-1">Current Execution</span>
          <span className="font-mono font-medium text-amber-300 block">MANUAL DEMO ONLY</span>
          <span className="text-[11px] text-slate-400 block mt-1">Per-order review; live and strategy orders locked</span>
        </div>
      </div>

      {/* Interactive Bridge Diagnostic Test */}
      <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-800/80">
          <div>
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-sans">
              Optional Browser Adapter Reachability
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Checks only whether the separate local read-only HTTP endpoint responds. The Windows app does not need this service.
            </p>
          </div>

          <button
            onClick={handleTestPing}
            disabled={isPinging}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>{isPinging ? 'Checking…' : 'Check local endpoint'}</span>
          </button>
        </div>

        {pingResult ? (
          <div className={`p-3.5 rounded-lg border font-mono text-xs flex items-start gap-2.5 ${
            pingResult.status === 'REACHABLE'
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
              : 'bg-slate-950 border-slate-800 text-slate-300'
          }`}>
            {pingResult.status === 'REACHABLE' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold text-white mb-0.5">
                {pingResult.status === 'REACHABLE' ? 'HTTP Endpoint Responded' : 'Endpoint Not Reachable'}
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">{pingResult.message}</p>
              <span className="text-[10px] text-slate-500 block mt-1">Tested at {new Date(pingResult.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-400 font-mono text-[11px]">
            This optional browser adapter requires a separately configured local token. Use Connections & Settings for the Windows connector.
          </div>
        )}
      </div>

      {/* Protocol Specification Viewer */}
      <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50 text-xs">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800/80">
          <Code2 className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-sans">
            Optional Browser Adapter Routes — Read-Only
          </h3>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800/80 mb-3 overflow-x-auto">
          {(['status', 'account', 'symbols'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedEndpoint(tab)}
              className={`px-3 py-1.5 rounded-md font-mono text-xs transition-colors cursor-pointer ${
                selectedEndpoint === tab
                  ? 'bg-slate-800 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 font-bold text-[11px]">
              {endpointSchemas[selectedEndpoint].method}
            </span>
            <span className="text-slate-200">{endpointSchemas[selectedEndpoint].path}</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            {endpointSchemas[selectedEndpoint].description}
          </p>

          <p className="text-amber-300 text-[11px]">These read-only routes are separate from the native app connector. They never submit or preview orders.</p>
          <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-emerald-400 overflow-x-auto mt-2">
            {endpointSchemas[selectedEndpoint].sampleResponse}
          </pre>
        </div>
      </div>

      {/* Gated Readiness Checklist */}
      <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50 text-xs">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3 pb-2 border-b border-slate-800/80 font-sans">
          Current Paper Implementation Status
        </h3>

        <div className="space-y-2.5 font-mono">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white">Local contract assumptions loaded</span>
            </div>
            <span className="text-amber-300 font-medium text-[11px]">BROKER TERMS UNVERIFIED</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white">Deterministic 0.20% per-trade risk engine active</span>
            </div>
            <span className="text-slate-300 font-medium text-[11px]">LOCAL UNIT TESTS</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white">Daily loss limit configured</span>
            </div>
            <span className="text-slate-300 font-medium text-[11px]">LOCAL UNIT TESTS</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white">Daily entry cap enforced in paper mode</span>
            </div>
            <span className="text-slate-300 font-medium text-[11px]">LOCAL UNIT TESTS</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white">5-Loss 30-minute behavioral lockout active</span>
            </div>
            <span className="text-slate-300 font-medium text-[11px]">LOCAL UNIT TESTS</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white">3x Maximum portfolio leverage ceiling enforced</span>
            </div>
            <span className="text-slate-300 font-medium text-[11px]">LOCAL UNIT TESTS</span>
          </div>

          <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-rose-200">Strategy-to-broker automation</span>
            </div>
            <span className="text-rose-400 font-medium text-[11px]">NOT CONNECTED</span>
          </div>
        </div>
      </div>
    </div>
  );
};
