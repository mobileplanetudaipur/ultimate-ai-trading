import React from 'react';
import { Settings, Server, Lock, ShieldCheck, AlertCircle, Database, Check } from 'lucide-react';
import { brokerGateway, XM_MT5_INSTRUMENT_SPECS } from '../services/brokerGateway';

export const ConnectionsSettingsView: React.FC = () => {
  const brokerStatus = brokerGateway.getStatus();

  return (
    <div className="space-y-6">
      {/* Security & Live-Release Architecture Card */}
      <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] text-xs">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-blue-500/30 text-blue-300">
          <Lock className="w-4 h-4 text-blue-400" />
          <h2 className="font-semibold text-white">Operating Modes & Live-Release Gate Architecture</h2>
        </div>

        <p className="text-slate-300 leading-relaxed mb-3">
          <strong>Default Environment:</strong> Defaults to simulation or verified read-only operation. Demo execution remains strictly gated by deterministic risk and broker connectivity checks. Live real-money orders are locked and disabled until every release gate passes and explicit authorization is given.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300 text-[11px] pt-1">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="font-semibold text-white block mb-1">Deliberate Live-Release Gate:</span>
            <span>Live mode remains locked by default until all historical, out-of-sample, demo, security, risk, recovery, and explicit operator release approval gates pass. Never switches to live automatically.</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="font-semibold text-white block mb-1">Account Mode Mismatch Guard:</span>
            <span>If the broker account is detected as REAL when the system expects demo, order execution is immediately blocked unless the approved live-release state is explicitly active.</span>
          </div>
        </div>
      </div>

      {/* Local MT5 Gateway Configuration */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] font-mono text-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800/80 font-sans">
          <Server className="w-5 h-5 text-blue-400" />
          <h3 className="text-xs font-semibold text-white">
            Local Desktop MetaTrader 5 Bridge Configuration (XM MT5)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1 font-sans">Bridge adapter URL</span>
            <input
              type="text"
              readOnly
              value="http://127.0.0.1:8000/api/v1/mt5"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-300 font-mono text-xs"
            />
            <span className="text-xs text-slate-500 block mt-1 font-sans">Loopback IPC only — never exposed to public internet</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1 font-sans">Target account mode</span>
            <input
              type="text"
              readOnly
              value="DEMO ACCOUNT ONLY"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-emerald-400 font-semibold font-mono text-xs"
            />
            <span className="text-xs text-slate-500 block mt-1 font-sans">Enforced by local gateway</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-slate-400 text-xs font-sans">
          <strong className="text-slate-300">Connection Health:</strong> {brokerStatus.errorMessage}
        </div>
      </div>

      {/* Contract Specifications Reference Table */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] font-mono text-xs">
        <h3 className="text-xs font-semibold text-white mb-4 pb-3 border-b border-slate-800/80 font-sans">
          Verified XM / MetaTrader 5 Contract Specifications Library
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 font-medium font-sans">
                <th className="p-3">Symbol</th>
                <th className="p-3">Asset Class</th>
                <th className="p-3">Contract Size</th>
                <th className="p-3">Tick Size / Value</th>
                <th className="p-3">Min / Step Lot</th>
                <th className="p-3">Typical Spread</th>
                <th className="p-3">Margin Currency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {Object.values(XM_MT5_INSTRUMENT_SPECS).map(spec => (
                <tr key={spec.symbol} className="hover:bg-slate-800/20">
                  <td className="p-3 font-semibold text-white">{spec.symbol}</td>
                  <td className="p-3 text-slate-400 font-sans">{spec.assetClass}</td>
                  <td className="p-3 tabular-nums">{spec.contractSize.toLocaleString()} units</td>
                  <td className="p-3 tabular-nums">{spec.tickSize} / ${spec.tickValue}</td>
                  <td className="p-3 tabular-nums">{spec.minVolumeLots}L / {spec.volumeStepLots}L</td>
                  <td className="p-3 tabular-nums">{spec.typicalSpreadPips} pips</td>
                  <td className="p-3 text-slate-400">{spec.marginCurrency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
