import React, { useState } from 'react';
import { X, FileText, Filter, ShieldCheck, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { AuditLogEntry } from '../types/trading';

interface AuditLogDrawerProps {
  isOpen: boolean;
  logs: AuditLogEntry[];
  onClose: () => void;
}

export const AuditLogDrawer: React.FC<AuditLogDrawerProps> = ({
  isOpen,
  logs,
  onClose
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  if (!isOpen) return null;

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
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          <div>
            <h2 className="text-sm font-bold text-white">System & Risk Audit Trail (Stage 14)</h2>
            <span className="text-[11px] text-slate-400">Chronological, tamper-evident action logs</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono">
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

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-800/50">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs font-mono">
            No audit log entries matching selected category.
          </div>
        ) : (
          [...filteredLogs].reverse().map(log => (
            <div key={log.id} className="pt-2.5 text-xs font-mono">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getLevelBadge(log.level)}`}>
                    {log.level}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">{log.category}</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {new Date(log.timestamp).toLocaleTimeString()} ({log.actor})
                </div>
              </div>

              <p className="text-slate-200 text-xs leading-relaxed mb-1">
                {log.message}
              </p>

              {log.details && (
                <pre className="p-2 rounded bg-slate-950 border border-slate-800/70 text-[10px] text-slate-400 overflow-x-auto font-mono">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80 text-[10px] font-mono text-slate-500 text-center">
        Total Recorded Events: {logs.length} • Storage: Durable Local & Checkpoint Memory
      </div>
    </div>
  );
};
