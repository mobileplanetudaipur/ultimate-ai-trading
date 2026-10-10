import React, { useState } from 'react';
import { X, ShieldAlert, AlertOctagon, Check, ArrowRight } from 'lucide-react';

interface KillSwitchModalProps {
  isOpen: boolean;
  openPositionsCount: number;
  isAlreadyActive: boolean;
  onClose: () => void;
  onConfirmKillSwitch: (closePositionsImmediately: boolean) => void;
  onResetKillSwitch: () => void;
}

export const KillSwitchModal: React.FC<KillSwitchModalProps> = ({
  isOpen,
  openPositionsCount,
  isAlreadyActive,
  onClose,
  onConfirmKillSwitch,
  onResetKillSwitch
}) => {
  const [closePositions, setClosePositions] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-red-500/50 rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-500">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Emergency Kill Switch (Stage 13)</h2>
            <p className="text-xs text-slate-400">Immediate deterministic halt of all automated execution</p>
          </div>
        </div>

        {isAlreadyActive ? (
          <div>
            <div className="p-3.5 rounded-lg bg-red-950/30 border border-red-500/40 text-xs text-red-200 mb-4 leading-relaxed">
              <span className="font-bold block mb-1">Status: KILL SWITCH IS CURRENTLY ACTIVE</span>
              All new strategy proposals and order submissions are strictly blocked. To resume normal operations, deliberate operator authorization is required.
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700"
              >
                Close Dialog
              </button>
              <button
                onClick={() => {
                  onResetKillSwitch();
                  onClose();
                }}
                className="px-5 py-2 text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
              >
                Authorize Normal Operations (Resume)
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Triggering the Kill Switch permanently blocks all automated entries and cancels pending orders. Per Stage 13 guidelines, existing open positions remain managed by their active stop-loss bracket unless explicitly requested below:
            </p>

            <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 mb-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={closePositions}
                  onChange={e => setClosePositions(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded bg-slate-900 border-slate-700 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="text-xs font-bold text-white block">
                    Also close all {openPositionsCount} open market position(s) immediately
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Submits market close orders for all currently active positions across all instruments.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onConfirmKillSwitch(closePositions);
                  onClose();
                }}
                className="px-5 py-2 text-xs font-bold rounded-lg text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-950/60 transition-colors flex items-center gap-1.5"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>CONFIRM EMERGENCY KILL SWITCH</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
