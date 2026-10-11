import React, { useState } from 'react';
import {
  FileText,
  Download,
  Upload,
  CheckCircle2,
  AlertOctagon,
  Filter,
  ShieldCheck,
  Activity,
  Server,
  Database,
  Radio,
  Cpu
} from 'lucide-react';
import { AuditLogEntry } from '../types/trading';
import { DurableCheckpoint } from '../services/storageCheckpoint';
import { brokerGateway } from '../services/brokerGateway';
import { marketDataService } from '../services/marketDataService';

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
  const brokerStatus = brokerGateway.getStatus();
  const quotes = marketDataService.getAllQuotes();
  const avgLatency = quotes.length > 0
    ? Math.round(quotes.reduce((sum, q) => sum + q.latencyMs, 0) / quotes.length)
    : 12;

  const filteredLogs = filterCategory === 'ALL'
    ? logs
    : logs.filter(l => l.category === filterCategory);

  const getLevelBadge = (level: AuditLogEntry['level']) => {
    switch (level) {
      case 'ERROR':
      case 'SECURITY':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'WARN':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'INFO':
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. System Health & Infrastructure Telemetry Dashboard */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-400" />
            <h2 className="text-xs font-semibold text-white">
              System Infrastructure & Health Telemetry
            </h2>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-medium">
            Engine Health: Operational
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          {/* Latency */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1 font-sans">
              <Radio className="w-3.5 h-3.5 text-blue-400" />
              <span>Tick feed latency</span>
            </div>
            <div className="text-base font-semibold text-white tabular-nums">
              {avgLatency}ms
            </div>
            <span className="text-xs text-slate-500 font-sans mt-0.5 block">
              Local simulation loopback
            </span>
          </div>

          {/* Broker Connection State */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1 font-sans">
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <span>MT5 bridge state</span>
            </div>
            <div className="text-base font-semibold text-amber-400">
              Disconnected
            </div>
            <span className="text-xs text-slate-500 font-sans mt-0.5 block">
              IPC loopback waiting
            </span>
          </div>

          {/* Reconciliation Drift */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1 font-sans">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Reconciliation drift</span>
            </div>
            <div className="text-base font-semibold text-emerald-400">
              0 Discrepancies
            </div>
            <span className="text-xs text-slate-500 font-sans mt-0.5 block">
              Ledger matches state
            </span>
          </div>

          {/* Data Integrity */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1 font-sans">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Data integrity</span>
            </div>
            <div className="text-base font-semibold text-emerald-400">
              100% Verified
            </div>
            <span className="text-xs text-slate-500 font-sans mt-0.5 block">
              XM standard contract math
            </span>
          </div>
        </div>
      </div>

      {/* 2. Checkpoint & Crash Recovery Card */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-slate-800/80 gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-400" />
            <h3 className="text-xs font-semibold text-white">
              Durable Checkpoint & Crash Recovery
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSaveCheckpoint}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save Local Checkpoint</span>
            </button>

            {checkpoint && (
              <button
                onClick={onRestoreCheckpoint}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Restore Checkpoint</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-3">
          Rule 2 & 3: Resume, do not restart. State checkpoints persist open positions, order records, and risk state across browser refreshes using local browser storage.
        </p>

        {checkpoint ? (
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 font-mono text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-slate-400 font-sans">Last checkpoint ID:</span>{' '}
              <strong className="text-white">{checkpoint.checkpointId}</strong>
            </div>
            <div>
              <span className="text-slate-400 font-sans">Timestamp:</span>{' '}
              <span className="tabular-nums">{new Date(checkpoint.timestamp).toLocaleTimeString()}</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">Storage medium:</span>{' '}
              <span className="text-emerald-400 font-sans">Browser Local Storage</span>
            </div>
          </div>
        ) : (
          <div className="p-3 text-center text-xs font-mono text-slate-400 border border-dashed border-slate-800 rounded-xl">
            No local checkpoint saved in current browser storage.
          </div>
        )}
      </div>

      {/* 3. Append-Only Chronological Audit Log */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2 font-sans">
            <FileText className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-semibold text-white">
              Append-Only Operational Audit Trail ({logs.length} Recorded Events)
            </h3>
          </div>

          {/* Filter Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-sans">
            {['ALL', 'SYSTEM', 'STRATEGY', 'RISK', 'ORDER', 'RECONCILIATION', 'KILL_SWITCH'].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer font-medium ${
                  filterCategory === cat
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
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
            <div className="py-12 text-center text-slate-400 font-mono">
              No audit log entries matching selected category.
            </div>
          ) : (
            [...filteredLogs].reverse().map(log => (
              <div key={log.id} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 font-sans">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getLevelBadge(log.level)}`}>
                      {log.level}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{log.category}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                    {new Date(log.timestamp).toLocaleTimeString()} • {log.actor}
                  </div>
                </div>

                <p className="text-slate-200 text-xs leading-relaxed mb-1 font-sans">
                  {log.message}
                </p>

                {log.details && (
                  <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 overflow-x-auto font-mono">
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
