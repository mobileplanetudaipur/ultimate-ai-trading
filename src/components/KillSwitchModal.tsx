import React, { useState } from 'react';
import { X, ShieldAlert, Check, ArrowRight, ShieldCheck } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="bg-slate-900/95 border border-red-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative backdrop-blur-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Emergency Execution Halt</h2>
            <p className="text-xs text-slate-400">Immediate deterministic halt of all automated order proposals</p>
          </div>
        </div>

        {isAlreadyActive ? (
          <div>
            <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-xs text-red-200 mb-5 leading-relaxed">
              <span className="font-semibold block mb-1">Status: Emergency Halt Currently Active</span>
              All strategy proposals and new order submissions are halted. Open positions remain protected by local stop limits. Resuming execution requires intentional operator confirmation.
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Close Dialog
              </button>
              <button
                onClick={() => {
                  onResetKillSwitch();
                  onClose();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
              >
                Resume Normal Execution
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs text-slate-300 mb-4 leading-relaxed space-y-2">
              <p>
                Triggering the Emergency Halt permanently suspends all automated strategy signal execution and cancels pending unexecuted orders.
              </p>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300">
                <span className="font-semibold text-white block mb-0.5">Existing Position Policy:</span>
                Existing open positions remain managed by their active stop-loss and take-profit brackets unless you explicitly choose to liquidate them immediately below.
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={closePositions}
                  onChange={e => setClosePositions(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded bg-slate-900 border-slate-700 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
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
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onConfirmKillSwitch(closePositions);
                  onClose();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-red-600 hover:bg-red-500 transition-colors cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
              >
                Confirm Emergency Halt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
