import React, { useState } from 'react';
import { X, RotateCcw, CheckCircle2, AlertOctagon, ShieldCheck, Scale, ArrowRight } from 'lucide-react';
import { AccountState, PositionRecord } from '../types/trading';
import { reconciliationService, ReconciliationReport } from '../services/reconciliationService';

interface ReconciliationModalProps {
  isOpen: boolean;
  account: AccountState;
  positions: PositionRecord[];
  onClose: () => void;
  onApplyReconciliation: (updatedAccount: AccountState) => void;
  onLogAudit: (category: 'RECONCILIATION', level: 'INFO' | 'WARN' | 'ERROR', message: string, details?: any) => void;
}

export const ReconciliationModal: React.FC<ReconciliationModalProps> = ({
  isOpen,
  account,
  positions,
  onClose,
  onApplyReconciliation,
  onLogAudit
}) => {
  const [injectDiscrepancy, setInjectDiscrepancy] = useState(false);
  const [lastReport, setLastReport] = useState<ReconciliationReport | null>(null);

  if (!isOpen) return null;

  const handleRunReconciliation = () => {
    const { updatedAccount, report } = reconciliationService.performReconciliation(
      account,
      positions
    );

    setLastReport(report);
    onApplyReconciliation(updatedAccount);

    if (report.isInternalStateConsistent) {
      onLogAudit('RECONCILIATION', 'INFO', 'Local ledger math audit completed: Internal consistency verified.', {
        equity: report.calculatedEquity,
        positions: report.localPositionsCount
      });
    } else {
      onLogAudit('RECONCILIATION', 'WARN', 'Reconciliation audit note: Discrepancy or gateway disconnected.', {
        discrepancies: report.discrepancies
      });
    }
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
          <RotateCcw className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">State Reconciliation & Ledger Integrity (Phase 4)</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Verifies ledger math consistency between cash balance, open position margin, floating P&L, and reported equity.
        </p>

        {/* Current State Summary */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 mb-4">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-slate-400">Reconciliation Status:</span>
            <span className={`px-2 py-0.5 rounded font-bold ${
              account.reconciliationStatus === 'LOCAL_CONSISTENT'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {account.reconciliationStatus}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
            <div>
              <span className="text-[10px] text-slate-500 block">LOCAL RECORDED EQUITY</span>
              <span className="font-bold text-sm text-white">${account.equity.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">ACTIVE POSITIONS MONITORED</span>
              <span className="font-bold text-sm text-white">{positions.length} Positions</span>
            </div>
          </div>
        </div>

        {/* Discrepancies Box if any */}
        {account.discrepancies.length > 0 && (
          <div className="mb-4 p-3.5 rounded-lg border border-rose-500/40 bg-rose-950/20 text-xs">
            <div className="flex items-center gap-2 text-rose-400 font-bold mb-1.5">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>Safety Gate Triggered: Unresolved Discrepancies</span>
            </div>
            <ul className="space-y-1 text-[11px] text-rose-300 list-disc list-inside">
              {account.discrepancies.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
            <p className="text-[10px] text-rose-400/80 mt-2 italic">
              Note: Stage 8 risk gate automatically rejects all candidate orders while discrepancies are active.
            </p>
          </div>
        )}

        {/* Simulation testing tool */}
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 mb-4 flex items-center justify-between text-xs">
          <div>
            <span className="text-white font-medium block">Inject Test Discrepancy</span>
            <span className="text-[10px] text-slate-400">
              Simulate an external manual order or cash variance to verify Stage 4 safety barrier
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={injectDiscrepancy}
              onChange={e => setInjectDiscrepancy(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
          >
            Close
          </button>
          <button
            onClick={handleRunReconciliation}
            className="px-5 py-2 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Audit & Reconcile Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
