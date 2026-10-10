import React, { useState } from 'react';
import { FileText, Download, Upload, CheckCircle2, AlertOctagon, Filter, ShieldCheck } from 'lucide-react';
import { AuditLogEntry } from '../types/trading';
import { DurableCheckpoint } from '../services/storageCheckpoint';

interface AuditRecoveryViewProps {
  logs: AuditLogEntry[];
  checkpoint: DurableCheckpoint | null;
  onSaveCheckpoint: () => void;
  onRestoreCheckpoint: () => void;
}

export const AuditRecoveryView: React.FC<AuditRecoveryViewProps> = ({
  logs,
  checkpoint,
  onSaveCheckpoint,
  onRestoreCheckpoint
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const filteredLogs = filterCategory === 'ALL'
    ? logs
    : logs.filter(l => l.category === filterCategory);

  const getLevelBadge = (level: AuditLogEntry['level']) => {
    switch (level) {
      case 'ERROR':
      case 'SECURITY':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'WARN':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'INFO':
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Checkpoint Management Header */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Durable Checkpoint & Crash Recovery (Phase 4 / Stage 13)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSaveCheckpoint}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save Local Checkpoint</span>
            </button>

            {checkpoint && (
              <button
                onClick={onRestoreCheckpoint}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Restore Checkpoint</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-3">
          Rule 2 & 3: Resume, do not restart. State checkpoints persist open positions, order records, and risk state across browser refreshes using local storage.
        </p>

        {checkpoint ? (
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 font-mono text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-slate-400">LAST CHECKPOINT:</span>{' '}
              <strong className="text-white">{checkpoint.checkpointId}</strong>
            </div>
            <div>
              <span className="text-slate-400">TIMESTAMP:</span>{' '}
              <span>{new Date(checkpoint.timestamp).toLocaleTimeString()}</span>
            </div>
            <div>
              <span className="text-slate-400">STORAGE:</span>{' '}
              <span className="text-emerald-400">BROWSER LOCAL STORAGE</span>
            </div>
          </div>
        ) : (
          <div className="p-3 text-center text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded-lg">
            No local checkpoint saved in current browser storage.
          </div>
        )}
      </div>

      {/* Append-Only Chronological Audit Log */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-sans">
            <FileText className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Append-Only Operational Audit Trail ({logs.length} Recorded Events)
            </h3>
          </div>

          {/* Filter Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
            {['ALL', 'SYSTEM', 'STRATEGY', 'RISK', 'ORDER', 'RECONCILIATION', 'KILL_SWITCH'].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  filterCategory === cat
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Logs Stream */}
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-mono">
              No audit log entries matching selected category.
            </div>
          ) : (
            [...filteredLogs].reverse().map(log => (
              <div key={log.id} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${getLevelBadge(log.level)}`}>
                      {log.level}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{log.category}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString()} • {log.actor}
                  </div>
                </div>

                <p className="text-slate-200 text-xs leading-relaxed mb-1">
                  {log.message}
                </p>

                {log.details && (
                  <pre className="p-2 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
