import React from 'react';
import { Settings, Server, Lock, ShieldCheck, AlertCircle, Database, Check } from 'lucide-react';
import { brokerGateway, XM_MT5_INSTRUMENT_SPECS } from '../services/brokerGateway';

export const ConnectionsSettingsView: React.FC = () => {
  const brokerStatus = brokerGateway.getStatus();

  return (
    <div className="space-y-6">
      {/* Security Baseline Card */}
      <div className="p-5 rounded-xl border border-red-500/40 bg-red-950/20 text-xs">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-500/30 text-red-300">
          <Lock className="w-4 h-4 text-red-400" />
          <h2 className="font-bold uppercase tracking-wider">Non-Negotiable Rule 1: Live Trading Permanently Disabled</h2>
        </div>

        <p className="text-red-200/90 leading-relaxed">
          In strict compliance with project safety rules, <strong>live real-money execution is completely disabled in code, UI, API routes, and configuration</strong>. The platform operates exclusively in local paper simulation and demo observation modes. No broker API keys or account passwords should ever be entered into the browser.
        </p>
      </div>

      {/* Local MT5 Gateway Configuration */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-xs">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800 font-sans">
          <Server className="w-5 h-5 text-blue-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Local Desktop MetaTrader 5 Bridge Configuration (XM MT5)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block mb-1">Bridge Adapter URL</span>
            <input
              type="text"
              readOnly
              value="http://127.0.0.1:8000/api/v1/mt5"
              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-slate-300 font-mono text-xs"
            />
            <span className="text-[10px] text-slate-400 block mt-1">Loopback IPC only — never exposed to public internet</span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block mb-1">Target Account Mode</span>
            <input
              type="text"
              readOnly
              value="DEMO ACCOUNT ONLY"
              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-emerald-400 font-bold font-mono text-xs"
            />
            <span className="text-[10px] text-slate-400 block mt-1">Enforced by local gateway</span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-950/40 border border-slate-800 text-slate-400 text-[11px] font-sans">
          <strong>Connection Health:</strong> {brokerStatus.errorMessage}
        </div>
      </div>

      {/* Contract Specifications Reference Table */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-xs">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 pb-2 border-b border-slate-800 font-sans">
          Verified XM / MetaTrader 5 Contract Specifications Library
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 text-[11px]">
                <th className="p-2.5">Symbol</th>
                <th className="p-2.5">Asset Class</th>
                <th className="p-2.5">Contract Size</th>
                <th className="p-2.5">Tick Size / Value</th>
                <th className="p-2.5">Min / Step Lot</th>
                <th className="p-2.5">Typ. Spread</th>
                <th className="p-2.5">Margin Cur.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {Object.values(XM_MT5_INSTRUMENT_SPECS).map(spec => (
                <tr key={spec.symbol} className="hover:bg-slate-800/30">
                  <td className="p-2.5 font-bold text-white">{spec.symbol}</td>
                  <td className="p-2.5 text-slate-400">{spec.assetClass}</td>
                  <td className="p-2.5">{spec.contractSize.toLocaleString()} units</td>
                  <td className="p-2.5">{spec.tickSize} / ${spec.tickValue}</td>
                  <td className="p-2.5">{spec.minVolumeLots}L / {spec.volumeStepLots}L</td>
                  <td className="p-2.5">{spec.typicalSpreadPips} pips</td>
                  <td className="p-2.5 text-slate-400">{spec.marginCurrency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
