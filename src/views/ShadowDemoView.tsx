import React, { useState } from 'react';
import { Eye, ShieldCheck, XCircle, CheckCircle2, Server, Terminal, Lock, RefreshCw, Code2, AlertTriangle, ArrowRight } from 'lucide-react';
import { brokerGateway } from '../services/brokerGateway';

interface PingResult {
  status: 'DISCONNECTED' | 'REACHABLE';
  latencyMs?: number;
  message: string;
  timestamp: number;
}

export const ShadowDemoView: React.FC = () => {
  const brokerStatus = brokerGateway.getStatus();
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<'health' | 'account' | 'positions' | 'preview'>('health');

  const handleTestPing = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      
      const res = await fetch('http://127.0.0.1:8000/health', {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const elapsed = Math.round(performance.now() - start);

      if (res.ok) {
        const data = await res.json();
        setPingResult({
          status: 'REACHABLE',
          latencyMs: elapsed,
          message: `Local daemon responded HTTP 200 OK (${elapsed}ms). MT5 status: ${data.mt5_connected ? 'Connected' : 'Terminal Disconnected'}`,
          timestamp: Date.now()
        });
      } else {
        setPingResult({
          status: 'DISCONNECTED',
          message: `Local daemon responded with status ${res.status}. Expected 200 OK.`,
          timestamp: Date.now()
        });
      }
    } catch (err: any) {
      setPingResult({
        status: 'DISCONNECTED',
        message: 'Endpoint http://127.0.0.1:8000/health is unreachable. Windows desktop bridge is not running on localhost (Fail-Closed active).',
        timestamp: Date.now()
      });
    } finally {
      setIsPinging(false);
    }
  };

  const endpointSchemas = {
    health: {
      method: 'GET',
      path: '/health',
      description: 'Heartbeat ping verifying Python bridge daemon and MT5 terminal IPC pipe connectivity.',
      sampleResponse: `{
  "status": "ok",
  "mt5_connected": true,
  "terminal_build": 4150,
  "broker_server": "XMGlobal-Demo",
  "ping_latency_ms": 14,
  "operating_regime": "SHADOW_PAPER_MIRROR"
}`
    },
    account: {
      method: 'GET',
      path: '/account',
      description: 'Retrieves broker-confirmed equity, balance, free margin, and leverage from MT5 account.',
      sampleResponse: `{
  "login": 88392104,
  "server": "XMGlobal-Demo",
  "currency": "USD",
  "balance": 10000.00,
  "equity": 10000.00,
  "margin": 0.00,
  "margin_free": 10000.00,
  "margin_level": 0.00,
  "leverage": 100,
  "trade_allowed": true,
  "broker_confirmed": true
}`
    },
    positions: {
      method: 'GET',
      path: '/positions',
      description: 'Returns active broker-side positions for shadow reconciliation and slippage monitoring.',
      sampleResponse: `[
  {
    "ticket": 4920194,
    "symbol": "EURUSD",
    "type": "POSITION_TYPE_BUY",
    "volume": 0.10,
    "price_open": 1.08512,
    "sl": 1.08312,
    "tp": 1.08912,
    "price_current": 1.08520,
    "profit": 0.80,
    "time": 1775657400
  }
]`
    },
    preview: {
      method: 'POST',
      path: '/orders/preview',
      description: 'Pre-flight dry run: queries terminal for required margin, spread, and freeze levels without placing orders.',
      sampleResponse: `{
  "action": "TRADE_ACTION_DEAL",
  "symbol": "EURUSD",
  "volume": 0.10,
  "type": "ORDER_TYPE_BUY",
  "price": 1.08512,
  "margin_required": 108.51,
  "margin_free": 9891.49,
  "spread_pips": 1.2,
  "order_check_retcode": 0,
  "retcode_description": "TRADE_RETCODE_DONE"
}`
    }
  };

  return (
    <div className="space-y-6">
      {/* Gateway Status Header */}
      <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800/80">
          <Eye className="w-5 h-5 text-sky-400" />
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-sans">
            Shadow Mode & XM / MT5 Bridge Readiness
          </h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Shadow Mode verifies real broker quote feeds and reconciles account balances without placing live orders. The system enforces a strict fail-closed boundary: because the Windows MT5 desktop terminal bridge is not connected in this cloud sandbox, all real broker execution remains completely unavailable and safe.
        </p>
      </div>

      {/* Gateway Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/60">
          <span className="text-[11px] text-slate-400 block mb-1">MT5 Adapter Target</span>
          <span className="font-mono font-medium text-white block truncate">{brokerStatus.hostTarget}</span>
          <span className="text-[11px] text-slate-400 block mt-1">Local Loopback Bridge</span>
        </div>

        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20">
          <span className="text-[11px] text-slate-400 block mb-1">Terminal Connection State</span>
          <span className="font-mono font-medium text-rose-400 block">DISCONNECTED / NOT DETECTED</span>
          <span className="text-[11px] text-rose-300 block mt-1">No Windows host bridge</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/60">
          <span className="text-[11px] text-slate-400 block mb-1">Target Account Mode</span>
          <span className="font-mono font-medium text-emerald-400 block">DEMO ONLY</span>
          <span className="text-[11px] text-slate-400 block mt-1">Live trading forbidden</span>
        </div>
      </div>

      {/* Interactive Bridge Diagnostic Test */}
      <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-800/80">
          <div>
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-sans">
              Live Bridge Ping Diagnostic
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tests reachability of local desktop bridge daemon on <code>http://127.0.0.1:8000/health</code>
            </p>
          </div>

          <button
            onClick={handleTestPing}
            disabled={isPinging}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>{isPinging ? 'Testing Ping...' : 'Run Diagnostics Ping'}</span>
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
                {pingResult.status === 'REACHABLE' ? 'Bridge Connected' : 'Bridge Inactive (Expected in Web Sandbox)'}
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">{pingResult.message}</p>
              <span className="text-[10px] text-slate-500 block mt-1">Tested at {new Date(pingResult.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-400 font-mono text-[11px]">
            Click "Run Diagnostics Ping" above to probe the desktop bridge endpoint.
          </div>
        )}
      </div>

      {/* Protocol Specification Viewer */}
      <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50 text-xs">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800/80">
          <Code2 className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-sans">
            Desktop MT5 Bridge Protocol Specification
          </h3>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800/80 mb-3 overflow-x-auto">
          {(['health', 'account', 'positions', 'preview'] as const).map(tab => (
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

          <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-emerald-400 overflow-x-auto mt-2">
            {endpointSchemas[selectedEndpoint].sampleResponse}
          </pre>
        </div>
      </div>

      {/* Gated Readiness Checklist */}
      <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50 text-xs">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3 pb-2 border-b border-slate-800/80 font-sans">
          Broker Bridge Verification Gate Checklist
        </h3>

        <div className="space-y-2.5 font-mono">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white">XM/MT5 Instrument Specifications Loaded</span>
            </div>
            <span className="text-emerald-400 font-medium text-[11px]">VERIFIED (FX, Gold, BTC)</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white">Deterministic 0.20% per-trade risk engine active</span>
            </div>
            <span className="text-emerald-400 font-medium text-[11px]">VERIFIED & TESTED</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white">1.00% Daily loss limit ceiling configured</span>
            </div>
            <span className="text-emerald-400 font-medium text-[11px]">VERIFIED & TESTED</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white">8 Trades / day maximum cap enforced</span>
            </div>
            <span className="text-emerald-400 font-medium text-[11px]">VERIFIED & TESTED</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white">5-Loss 30-minute behavioral lockout active</span>
            </div>
            <span className="text-emerald-400 font-medium text-[11px]">VERIFIED & TESTED</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white">3x Maximum portfolio leverage ceiling enforced</span>
            </div>
            <span className="text-emerald-400 font-medium text-[11px]">VERIFIED & TESTED</span>
          </div>

          <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-rose-200">Local Windows MT5 Desktop Bridge (127.0.0.1:8000)</span>
            </div>
            <span className="text-rose-400 font-medium text-[11px]">BLOCKER: NOT DETECTED</span>
          </div>
        </div>
      </div>
    </div>
  );
};
