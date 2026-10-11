import React, { useState, useEffect } from 'react';
import {
  Eye,
  ShieldCheck,
  XCircle,
  CheckCircle2,
  Server,
  Terminal,
  Lock,
  RefreshCw,
  Code2,
  AlertTriangle,
  ArrowRight,
  Database,
  Layers,
  FileText,
  Clock,
  ExternalLink
} from 'lucide-react';
import { brokerGateway } from '../services/brokerGateway';
import { shadowValidationService } from '../services/shadowValidationService';
import { orderManager } from '../services/orderLifecycleManager';
import { Phase9ReadinessReport, ShadowValidationMetrics } from '../types/trading';

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
  const [selectedStateTab, setSelectedStateTab] = useState<'intents' | 'brokerOrders' | 'deals' | 'positions'>('intents');
  
  const [readinessReport, setReadinessReport] = useState<Phase9ReadinessReport>(
    shadowValidationService.evaluatePhase9Readiness()
  );
  const [shadowMetrics, setShadowMetrics] = useState<ShadowValidationMetrics>(
    shadowValidationService.getMetrics()
  );

  useEffect(() => {
    const updateMetrics = () => {
      setReadinessReport(shadowValidationService.evaluatePhase9Readiness());
      setShadowMetrics(shadowValidationService.getMetrics());
    };
    const interval = setInterval(updateMetrics, 4000);
    return () => clearInterval(interval);
  }, []);

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
      setReadinessReport(shadowValidationService.evaluatePhase9Readiness());
      setShadowMetrics(shadowValidationService.getMetrics());
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

  const intents = orderManager.getIntents();
  const brokerOrders = orderManager.getBrokerOrders();
  const deals = orderManager.getDeals();
  const positions = orderManager.getPositions();
  const observations = shadowValidationService.getObservations().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Gateway Status Header */}
      <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-sky-400" />
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-sans">
              Broker Integration, Shadow Mode & Phase 9 Readiness
            </h2>
          </div>
          <span className="px-2.5 py-0.5 rounded text-[11px] font-mono uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {readinessReport.overallReadiness === 'READY_FOR_LOCAL_DEMO' ? 'PHASE 9 READY' : 'PHASE 9 GATED (DEMO ONLY)'}
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Shadow Mode observes market tick data and reconciles state without submitting orders. All order intents, broker orders, deals/fills, and open positions are maintained in separate, distinct entity lifecycles. Real execution remains fail-closed and strictly disabled until a genuine local XM/MT5 desktop bridge is verified.
        </p>
      </div>

      {/* Gateway Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/60">
          <span className="text-[11px] text-slate-400 block mb-1">MT5 Adapter Target</span>
          <span className="font-mono font-medium text-white block truncate">{brokerStatus.hostTarget}</span>
          <span className="text-[11px] text-slate-400 block mt-1">Local Windows IPC Bridge</span>
        </div>

        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20">
          <span className="text-[11px] text-slate-400 block mb-1">Terminal Connection State</span>
          <span className="font-mono font-medium text-rose-400 block">DISCONNECTED / NOT DETECTED</span>
          <span className="text-[11px] text-rose-300 block mt-1">Real broker execution blocked</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/60">
          <span className="text-[11px] text-slate-400 block mb-1">Target Account Mode</span>
          <span className="font-mono font-medium text-emerald-400 block">DEMO ONLY</span>
          <span className="text-[11px] text-slate-400 block mt-1">Live trading forbidden</span>
        </div>
      </div>

      {/* Phase 9 Readiness Gates Audit Table */}
      <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50 text-xs">
        <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-800/80">
          <div>
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-sans flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              Phase 9 Readiness Gates ({readinessReport.passedTestsCount} / {readinessReport.totalTestsCount} Gates Passed)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Verified release gates required before automated demo execution is permitted.
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold ${
            readinessReport.overallReadiness === 'READY_FOR_LOCAL_DEMO'
              ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
          }`}>
            {readinessReport.overallReadiness === 'READY_FOR_LOCAL_DEMO' ? 'READY' : 'BLOCKED PENDING BRIDGE'}
          </span>
        </div>

        <div className="space-y-2">
          {readinessReport.gates.map((gate) => (
            <div
              key={gate.gateId}
              className={`p-3 rounded-lg border font-mono flex items-start justify-between gap-3 ${
                gate.isPassed
                  ? 'bg-slate-950/70 border-slate-800/80'
                  : 'bg-rose-950/20 border-rose-500/30'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {gate.isPassed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold text-white text-[12px] flex items-center gap-2">
                    <span>{gate.name}</span>
                    <span className="text-[10px] text-slate-400 uppercase">[{gate.category}]</span>
                  </div>
                  <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">{gate.evidence}</p>
                  {gate.blockerDescription && (
                    <p className="text-rose-300 text-[11px] mt-1 font-sans">
                      <span className="font-semibold text-rose-400">Blocker: </span>
                      {gate.blockerDescription}
                    </p>
                  )}
                </div>
              </div>

              <span className={`px-2 py-0.5 rounded text-[10px] shrink-0 font-bold uppercase ${
                gate.isPassed ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
              }`}>
                {gate.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Shadow Validation Metrics & Provenance */}
      <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50 text-xs">
        <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-800/80">
          <div>
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-sans flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-400" />
              Shadow Mode Observation Telemetry & Provenance
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tracks genuine broker quote observations with verified provenance digests. Synthetic data is strictly excluded.
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
            shadowMetrics.provenanceStatus === 'GENUINE_FEED_VERIFIED'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
              : 'bg-amber-950/40 text-amber-300 border border-amber-500/40'
          }`}>
            {shadowMetrics.provenanceStatus.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono mb-4">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block mb-0.5">Total Observations</span>
            <span className="text-sm font-bold text-white">{shadowMetrics.totalObservations}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block mb-0.5">Genuine Broker Ticks</span>
            <span className={`text-sm font-bold ${shadowMetrics.genuineObservationsCount >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {shadowMetrics.genuineObservationsCount} / {shadowMetrics.minSampleRequired}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block mb-0.5">Simulated (Excluded)</span>
            <span className="text-sm font-bold text-slate-400">{shadowMetrics.simulatedObservationsCount}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block mb-0.5">Signals Evaluated</span>
            <span className="text-sm font-bold text-sky-400">
              {shadowMetrics.signalDistribution.buyCount} B / {shadowMetrics.signalDistribution.sellCount} S / {shadowMetrics.signalDistribution.noTradeCount} NT
            </span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] text-slate-300 space-y-1">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Anti-Fabrication & Evidence Provenance Rule</span>
          </div>
          <p className="text-slate-400 leading-relaxed font-sans">
            In accordance with the Master Build Prompt, performance metrics and release readiness cannot be claimed from synthetic data. Shadow validation requires at least 100 timestamped observations streamed directly from the local MT5 terminal bridge. All observations in Shadow Mode submit ZERO orders.
          </p>
        </div>

        {observations.length > 0 && (
          <div className="mt-4">
            <h4 className="text-[11px] font-semibold text-slate-300 uppercase mb-2">Recent Timestamped Observations</h4>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-[11px] text-left">
                <thead className="text-[10px] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="pb-1.5">Time</th>
                    <th className="pb-1.5">Symbol</th>
                    <th className="pb-1.5">Bid / Ask</th>
                    <th className="pb-1.5">Spread</th>
                    <th className="pb-1.5">Provider</th>
                    <th className="pb-1.5">Signal</th>
                    <th className="pb-1.5">Provenance Digest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {observations.map(obs => (
                    <tr key={obs.observationId}>
                      <td className="py-1.5">{new Date(obs.timestamp).toLocaleTimeString()}</td>
                      <td className="py-1.5 font-bold text-white">{obs.symbol}</td>
                      <td className="py-1.5">{obs.bid} / {obs.ask}</td>
                      <td className="py-1.5">{obs.spreadPips} pips</td>
                      <td className="py-1.5 text-slate-400">{obs.sourceProvider}</td>
                      <td className="py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          obs.shadowSignal === 'BUY' ? 'bg-emerald-950 text-emerald-400' :
                          obs.shadowSignal === 'SELL' ? 'bg-rose-950 text-rose-400' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {obs.shadowSignal}
                        </span>
                      </td>
                      <td className="py-1.5 text-slate-500 truncate max-w-[150px]">{obs.provenanceDigest}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Multi-Record State Separation Inspector */}
      <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50 text-xs">
        <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-800/80">
          <div>
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-sans flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              Separated State Inspector (Stage 4 & 5)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Strict separation between Order Intents, Broker Orders, Execution Deals/Fills, and Open Positions.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800/80">
            {(['intents', 'brokerOrders', 'deals', 'positions'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSelectedStateTab(tab)}
                className={`px-2.5 py-1 rounded font-mono text-[11px] transition-colors cursor-pointer ${
                  selectedStateTab === tab
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'intents' ? `Intents (${intents.length})` :
                 tab === 'brokerOrders' ? `Broker Orders (${brokerOrders.length})` :
                 tab === 'deals' ? `Deals/Fills (${deals.length})` :
                 `Positions (${positions.length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="font-mono text-xs">
          {selectedStateTab === 'intents' && (
            intents.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-400 text-center">
                No OrderIntent records in current session. Intents are generated upon strategy risk-approval.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[10px] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="pb-1.5">Intent ID</th>
                      <th className="pb-1.5">Symbol</th>
                      <th className="pb-1.5">Side</th>
                      <th className="pb-1.5">Volume</th>
                      <th className="pb-1.5">Status</th>
                      <th className="pb-1.5">Blind Retry Forbidden</th>
                      <th className="pb-1.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {intents.map(i => (
                      <tr key={i.intentId}>
                        <td className="py-2 text-sky-400">{i.intentId}</td>
                        <td className="py-2 font-bold text-white">{i.symbol}</td>
                        <td className="py-2">{i.side}</td>
                        <td className="py-2">{i.requestedVolumeLots} lots</td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            i.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400' :
                            i.status === 'TIMEOUT_UNKNOWN' ? 'bg-rose-950 text-rose-400' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {i.status}
                          </span>
                        </td>
                        <td className="py-2 text-rose-400">{i.blindRetryForbidden ? 'YES (Strict)' : 'NO'}</td>
                        <td className="py-2 text-slate-400">{new Date(i.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {selectedStateTab === 'brokerOrders' && (
            brokerOrders.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-400 text-center">
                No BrokerOrder records in current session.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[10px] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="pb-1.5">Broker Ticket</th>
                      <th className="pb-1.5">Symbol</th>
                      <th className="pb-1.5">Requested</th>
                      <th className="pb-1.5">Filled</th>
                      <th className="pb-1.5">Remaining</th>
                      <th className="pb-1.5">Status</th>
                      <th className="pb-1.5">Avg Fill Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {brokerOrders.map(b => (
                      <tr key={b.brokerTicket}>
                        <td className="py-2 text-sky-400">{b.brokerTicket}</td>
                        <td className="py-2 font-bold text-white">{b.symbol}</td>
                        <td className="py-2">{b.requestedVolumeLots} lots</td>
                        <td className="py-2 text-emerald-400">{b.filledVolumeLots} lots</td>
                        <td className="py-2 text-slate-400">{b.remainingVolumeLots} lots</td>
                        <td className="py-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                            {b.status}
                          </span>
                        </td>
                        <td className="py-2">{b.averageFillPrice ?? 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {selectedStateTab === 'deals' && (
            deals.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-400 text-center">
                No DealExecution records in current session.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[10px] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="pb-1.5">Deal Ticket</th>
                      <th className="pb-1.5">Position Ticket</th>
                      <th className="pb-1.5">Deal Type</th>
                      <th className="pb-1.5">Volume</th>
                      <th className="pb-1.5">Fill Price</th>
                      <th className="pb-1.5">Commission</th>
                      <th className="pb-1.5">External/Manual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {deals.map(d => (
                      <tr key={d.dealTicket}>
                        <td className="py-2 text-sky-400">{d.dealTicket}</td>
                        <td className="py-2 text-slate-400">{d.positionTicket}</td>
                        <td className="py-2 font-bold">{d.dealType}</td>
                        <td className="py-2">{d.volumeLots} lots</td>
                        <td className="py-2 text-white">${d.executionPrice}</td>
                        <td className="py-2 text-slate-400">${d.commission}</td>
                        <td className="py-2">{d.isExternalOrManual ? 'YES (External)' : 'NO (Bot)'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {selectedStateTab === 'positions' && (
            positions.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-400 text-center">
                No active positions currently open.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[10px] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="pb-1.5">Position ID</th>
                      <th className="pb-1.5">Symbol</th>
                      <th className="pb-1.5">Size Lots</th>
                      <th className="pb-1.5">Entry</th>
                      <th className="pb-1.5">Current Mark</th>
                      <th className="pb-1.5">Stop Loss</th>
                      <th className="pb-1.5">SL Status</th>
                      <th className="pb-1.5">Unrealized P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {positions.map(p => (
                      <tr key={p.id}>
                        <td className="py-2 text-sky-400">{p.id}</td>
                        <td className="py-2 font-bold text-white">{p.symbol}</td>
                        <td className="py-2">{p.sizeLots} lots</td>
                        <td className="py-2">${p.entryPrice}</td>
                        <td className="py-2">${p.currentPrice}</td>
                        <td className="py-2">${p.stopLossPrice}</td>
                        <td className="py-2">
                          {p.stopLossFailed ? (
                            <span className="text-rose-400 font-bold">FAILED / REJECTED</span>
                          ) : (
                            <span className="text-emerald-400 font-bold">ACTIVE</span>
                          )}
                        </td>
                        <td className={`py-2 font-bold ${p.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ${p.unrealizedPnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
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

      {/* Exact Missing Configuration for User Setup */}
      <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50 text-xs">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2 pb-2 border-b border-slate-800/80 font-sans flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-amber-400" />
          Exact Missing Broker Configuration Required For Phase 9
        </h3>
        <p className="text-slate-300 mb-3">
          To transition from isolated simulation to real local MT5 demo execution, the user must supply the following exact settings on their local Windows host machine:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-amber-400 font-semibold block mb-1">1. XM MT5 Demo Account Login</span>
            <p className="text-slate-400 text-[11px]">Required demo login number provided by XM broker (e.g., <code>88392104</code>).</p>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-amber-400 font-semibold block mb-1">2. XM MT5 Server Name</span>
            <p className="text-slate-400 text-[11px]">Exact trade server hostname (e.g., <code>XMGlobal-Demo</code> or <code>XMGlobal-Demo 2</code>).</p>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-amber-400 font-semibold block mb-1">3. Windows Python Daemon Port</span>
            <p className="text-slate-400 text-[11px]">Local HTTP bridge listening on <code>127.0.0.1:8000</code> communicating via <code>MetaTrader5</code> Python package.</p>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-amber-400 font-semibold block mb-1">4. MT5 Terminal Permissions</span>
            <p className="text-slate-400 text-[11px]">Enable "Allow Algo Trading" and "Allow WebRequest" in MT5 Tools &gt; Options &gt; Expert Advisors.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
