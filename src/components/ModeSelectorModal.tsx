import React, { useEffect, useState } from 'react';
import { X, Check, Info, Lock, ShieldCheck } from 'lucide-react';
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

  useEffect(() => {
    if (isOpen) setSelected(currentMode);
  }, [currentMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modes: {
    id: OperatingMode;
    title: string;
    badge: string;
    badgeColor: string;
    description: string;
    features: string[];
  }[] = [
    {
      id: 'simulated',
      title: 'Local Paper Trading Simulation',
      badge: 'Active / Recommended',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      description: 'Full automated execution pipeline against local simulated tick stream. Zero financial capital at risk.',
      features: [
        'Local tick walk & candle stream',
        'Instrument-aware contract sizing (0.20% max risk)',
        'Stage 9 Behavioral safeguards (5-loss / 30m lock)'
      ]
    },
    {
      id: 'read_only',
      title: 'Read-Only Observation',
      badge: 'Monitoring Only',
      badgeColor: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
      description: 'Inspect the same synthetic local quotes and indicators without enabling paper order submissions.',
      features: [
        'Synthetic candlestick & indicator rendering',
        'Local regime & suitability evaluation',
        'Strictly zero order submissions permitted'
      ]
    },
    {
      id: 'demo_pending',
      title: 'Broker Bridge Observation',
      badge: 'Blocked · Integration Incomplete',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      description: 'A guarded XM demo-order boundary exists, but broker-fed strategy, portfolio reconciliation, and trading controls are not integrated.',
      features: [
        'No broker quote feed',
        'No account or position query',
        'Automated demo entries remain blocked'
      ]
    },
    {
      id: 'disconnected',
      title: 'Disconnected / Standby',
      badge: 'Engines Suspended',
      badgeColor: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      description: 'Stop synthetic market updates and block all new entries. Existing local paper state remains a simulation.',
      features: [
        'Synthetic tick stream paused',
        'All new entries blocked',
        'Existing paper state remains local'
      ]
    }
  ];

  const handleApply = () => {
    onSelectMode(selected);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mode-selector-title"
      aria-describedby="mode-selector-description"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close operating mode selector"
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <Info className="w-5 h-5 text-blue-400" />
          <h2 id="mode-selector-title" className="text-base font-bold text-white">Select Operating Mode</h2>
        </div>
        <p id="mode-selector-description" className="text-xs text-slate-400 mb-4 leading-relaxed">
        This build supports local simulation and a separate, manually confirmed demo order ticket. Strategy automation is not connected to broker orders; live order activation is locked pending separate release approval.
        </p>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {modes.map(mode => {
            const isSelected = selected === mode.id;
            return (
              <button
                type="button"
                key={mode.id}
                onClick={() => setSelected(mode.id)}
                aria-pressed={isSelected}
                className={`w-full text-left p-3.5 rounded-lg border transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${
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
                <p className="text-xs text-slate-400 mb-2 leading-relaxed">{mode.description}</p>
                <ul className="text-[11px] text-slate-400 space-y-0.5 list-disc list-inside">
                  {mode.features.map((feat, i) => (
                    <li key={i}>{feat}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-500 transition-colors"
          >
            Apply Mode
          </button>
        </div>
      </div>
    </div>
  );
};
