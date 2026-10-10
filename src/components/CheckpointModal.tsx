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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">Durable Checkpoint & Recovery State (Stage 13)</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Rule 2 & 3: Resume, do not restart. Durable checkpoints persist account state, active bracket stops, verified milestones, and audit history across crashes or reloads.
        </p>

        {checkpoint ? (
          <div className="space-y-3 mb-5 font-mono text-xs">
            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span>Checkpoint ID:</span>
                <span className="text-white font-bold">{checkpoint.checkpointId}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span>Saved Timestamp:</span>
                <span className="text-slate-200">{new Date(checkpoint.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span>Milestone Phase:</span>
                <span className="text-emerald-400 font-bold">{checkpoint.milestonePhase}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Operating Mode:</span>
                <span className="text-blue-400 uppercase">{checkpoint.operatingMode}</span>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
              <span className="text-slate-400 block mb-1 text-[11px] font-sans font-semibold">
                Verified Stages in Checkpoint ({checkpoint.verifiedCompletions.length}):
              </span>
              <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside max-h-36 overflow-y-auto">
                {checkpoint.verifiedCompletions.map((comp, idx) => (
                  <li key={idx} className="text-slate-300">{comp}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs font-mono border border-slate-800 rounded-lg mb-5">
            No saved durable checkpoint found in persistent storage.
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onRestoreCheckpoint}
            disabled={!checkpoint}
            className={`px-4 py-2 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
              checkpoint
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white'
                : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Restore From Checkpoint</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
            >
              Close
            </button>
            <button
              onClick={() => {
                onSaveCurrentCheckpoint();
              }}
              className="px-5 py-2 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save Durable Checkpoint Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
