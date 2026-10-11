import React from 'react';
import { X, CheckCircle2, ShieldCheck, Download, Upload, AlertCircle } from 'lucide-react';
import { DurableCheckpoint } from '../services/storageCheckpoint';

interface CheckpointModalProps {
  isOpen: boolean;
  checkpoint: DurableCheckpoint | null;
  onClose: () => void;
  onSaveCurrentCheckpoint: () => void;
  onRestoreCheckpoint: () => void;
}

export const CheckpointModal: React.FC<CheckpointModalProps> = ({
  isOpen,
  checkpoint,
  onClose,
  onSaveCurrentCheckpoint,
  onRestoreCheckpoint
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative backdrop-blur-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <CheckCircle2 className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-semibold text-white">Durable Checkpoint & Recovery State</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Rule 2 & 3: Resume, do not restart. Durable checkpoints persist account state, active bracket stops, verified milestones, and audit history across reloads.
        </p>

        {checkpoint ? (
          <div className="space-y-3 mb-5 font-mono text-xs">
            <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="font-sans">Checkpoint ID:</span>
                <span className="text-white font-semibold">{checkpoint.checkpointId}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="font-sans">Saved timestamp:</span>
                <span className="text-slate-200 tabular-nums">{new Date(checkpoint.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="font-sans">Storage medium:</span>
                <span className="text-emerald-400 font-sans">{checkpoint.storageType}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-sans">Operating mode:</span>
                <span className="text-blue-300 font-sans">{checkpoint.operatingMode}</span>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
              <span className="text-slate-400 block mb-1 text-xs font-sans font-semibold">
                Status disclosure:
              </span>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {checkpoint.verifiedStatusNote}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs font-mono border border-slate-800/80 rounded-xl bg-slate-950/40 mb-5">
            No saved durable checkpoint found in persistent storage.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          <button
            onClick={onRestoreCheckpoint}
            disabled={!checkpoint}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
              checkpoint
                ? 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-700/80 hover:text-white'
                : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Restore From Checkpoint</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onSaveCurrentCheckpoint();
              }}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save New Checkpoint</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
