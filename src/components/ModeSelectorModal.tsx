import React, { useState } from 'react';
import { X, ShieldAlert, Check, AlertCircle, Info, Lock } from 'lucide-react';
import { OperatingMode } from '../types/trading';

interface ModeSelectorModalProps {
  isOpen: boolean;
  currentMode: OperatingMode;
  onClose: () => void;
  onSelectMode: (mode: OperatingMode) => void;
}

export const ModeSelectorModal: React.FC<ModeSelectorModalProps> = ({
  isOpen,
  currentMode,
  onClose,
  onSelectMode
}) => {
  const [selected, setSelected] = useState<OperatingMode>(currentMode);
  const [liveConsentGiven, setLiveConsentGiven] = useState(false);

  if (!isOpen) return null;

  const modes: {
    id: OperatingMode;
    title: string;
    badge: string;
    badgeColor: string;
    description: string;
    isRestricted?: boolean;
    features: string[];
  }[] = [
    {
      id: 'simulated',
      title: 'Simulated / Paper Trading',
      badge: 'Default / Safe',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      description: 'Full automated execution pipeline against simulated live market feed. Zero capital at risk.',
      features: ['Real-time ticks & candle generation', 'Full order lifecycle & slippage modeling', 'Complete risk engine enforcement']
    },
    {
      id: 'demo',
      title: 'Broker Demo Account',
      badge: 'Testing Stage',
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      description: 'Connects to broker demo environment with simulated liquidity and realistic latency.',
      features: ['Broker gateway reconciliation', 'Delayed or simulated broker fills', 'Zero real capital risk']
    },
    {
      id: 'read_only',
      title: 'Read-Only Observation',
      badge: 'Monitoring',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      description: 'Stream live ticks and evaluate market regimes and strategies. All order execution is disabled.',
      features: ['Live chart & indicator updates', 'Continuous regime & suitability evaluation', 'Strictly zero order submissions']
    },
    {
      id: 'disconnected',
      title: 'Disconnected / Standby',
      badge: 'Inactive',
      badgeColor: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      description: 'Completely disconnect from feeds and engines. Ideal for offline inspection or maintenance.',
      features: ['Feeds stopped', 'No automated decisions', 'Safe maintenance state']
    },
    {
      id: 'live',
      title: 'Live Real-Money Brokerage',
      badge: 'High Risk / Gated',
      badgeColor: 'bg-red-500/20 text-red-400 border-red-500/30',
      description: 'Direct execution on live broker account with real capital. Disabled by default per Rule 5.',
      isRestricted: true,
      features: [
        'Requires verified Stage 1-14 sign-off',
        'Deterministic pre-trade risk stops mandatory',
        'Never enabled during development or testing'
      ]
    }
  ];

  const handleApply = () => {
    if (selected === 'live' && !liveConsentGiven) {
      return;
    }
    onSelectMode(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <Info className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">Select Operating Mode</h2>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          In strict accordance with the Master Build Prompt, operating mode must be deliberate, unmistakable, and evidence-gated.
        </p>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {modes.map(mode => {
            const isSelected = selected === mode.id;
            return (
              <div
                key={mode.id}
                onClick={() => setSelected(mode.id)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-500/50'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{mode.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${mode.badgeColor} font-mono font-medium`}>
                      {mode.badge}
                    </span>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-blue-500 bg-blue-600' : 'border-slate-600'
                  }`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-2">{mode.description}</p>
                <ul className="text-[11px] text-slate-500 space-y-0.5 list-disc list-inside">
                  {mode.features.map((feat, i) => (
                    <li key={i}>{feat}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Live confirmation gate if Live is picked */}
        {selected === 'live' && (
          <div className="mt-4 p-3.5 rounded-lg border border-red-500/40 bg-red-950/30 text-xs text-red-200">
            <div className="flex items-start gap-2 mb-2 font-semibold">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>Rule 5 Non-Negotiable Live Trading Restriction:</span>
            </div>
            <p className="text-[11px] text-red-300 mb-3 leading-relaxed">
              No trading bot can guarantee profits. Live mode involves capital risk. Live trading should only be enabled if all prior verification gates have passed and explicit credentials are provided.
            </p>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-xs select-none">
              <input
                type="checkbox"
                checked={liveConsentGiven}
                onChange={e => setLiveConsentGiven(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-red-600 focus:ring-red-500"
              />
              <span>I understand the risks and explicitly authorize Live Broker mode.</span>
            </label>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={selected === 'live' && !liveConsentGiven}
            className={`px-5 py-2 text-xs font-bold rounded-lg text-white transition-colors ${
              selected === 'live' && !liveConsentGiven
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            Apply Mode
          </button>
        </div>
      </div>
    </div>
  );
};
