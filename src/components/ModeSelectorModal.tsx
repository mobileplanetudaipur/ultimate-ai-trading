import React, { useState } from 'react';
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
      description: 'Stream quotes, inspect indicator alignments and regime detection. All order execution is disabled.',
      features: [
        'Live candlestick & indicator rendering',
        'Continuous regime & suitability evaluation',
        'Strictly zero order submissions permitted'
      ]
    },
    {
      id: 'demo_pending',
      title: 'XM / MT5 Bridge Observation (Demo)',
      badge: 'Bridge Disconnected',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      description: 'Connects to local Windows MT5 demo terminal bridge on 127.0.0.1:8000 when active.',
      features: [
        'Requires local Windows MT5 terminal',
        'Demo account reconciliation',
        'Fail-closed if bridge is disconnected'
      ]
    },
    {
      id: 'disconnected',
      title: 'Disconnected / Standby',
      badge: 'Engines Suspended',
      badgeColor: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      description: 'Completely suspend all tick streaming, signal generation, and local engines.',
      features: [
        'Tick streamer paused',
        'All automated entries stopped',
        'Safe maintenance state'
      ]
    }
  ];

  const handleApply = () => {
    onSelectMode(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <Info className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-bold text-white">Select Operating Mode</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Rule 1: Live real-money trading is permanently disabled. Only simulated paper execution and demo observation modes are permitted.
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
                <p className="text-xs text-slate-400 mb-2 leading-relaxed">{mode.description}</p>
                <ul className="text-[11px] text-slate-400 space-y-0.5 list-disc list-inside">
                  {mode.features.map((feat, i) => (
                    <li key={i}>{feat}</li>
                  ))}
                </ul>
              </div>
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
