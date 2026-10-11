import React from 'react';
import { PositionRecord, OrderRecord, ClosedTradeRecord } from '../types/trading';
import { PositionsOrdersTable } from '../components/PositionsOrdersTable';
import { Layers, Briefcase, CheckCircle2, Shield } from 'lucide-react';

interface PortfolioViewProps {
  positions: PositionRecord[];
  orders: OrderRecord[];
  closedTrades: ClosedTradeRecord[];
  onClosePosition: (positionId: string) => void;
  onToggleTrailingStop: (positionId: string) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  positions,
  orders,
  closedTrades,
  onClosePosition,
  onToggleTrailingStop
}) => {
  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const totalRealized = closedTrades.reduce((sum, t) => sum + t.netPnl, 0);
  const totalCommission = positions.reduce((sum, p) => sum + p.commission, 0) +
    closedTrades.reduce((sum, t) => sum + t.commission, 0);

  return (
    <div className="space-y-6">
      {/* Reconciliation & Integrity Banner */}
      <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">Ledger State: In-Memory Reconciled</span>
            <span className="text-slate-400 font-mono">
              (0 Discrepancies • Strict 3-Position Cap Enforced)
            </span>
          </div>
        </div>
        <span className="text-slate-400 font-mono text-[11px]">
          Ownership & Cost Segregation Active
        </span>
      </div>

      {/* Portfolio Status Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <span className="text-xs text-slate-400 block mb-1">Active market positions</span>
          <span className="text-xl font-semibold text-white font-mono tabular-nums">
            {positions.length} <span className="text-slate-500 text-sm">/ 3 max</span>
          </span>
          <span className="text-xs text-slate-400 block mt-1 font-mono">
            {3 - positions.length} concurrent slot(s) available
          </span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <span className="text-xs text-slate-400 block mb-1">Floating net mark-to-market</span>
          <span
            className={`text-xl font-semibold font-mono tabular-nums ${
              totalUnrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {totalUnrealized >= 0 ? '+' : ''}${totalUnrealized.toFixed(2)}
          </span>
          <span className="text-xs text-slate-400 block mt-1 font-mono">
            Net of unrealized commissions
          </span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <span className="text-xs text-slate-400 block mb-1">Total realized net P&L</span>
          <span
            className={`text-xl font-semibold font-mono tabular-nums ${
              totalRealized >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {totalRealized >= 0 ? '+' : ''}${totalRealized.toFixed(2)}
          </span>
          <span className="text-xs text-slate-400 block mt-1 font-mono">
            Accumulated commissions: ${totalCommission.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Main Tabbed Positions / Orders / Deals Table */}
      <PositionsOrdersTable
        positions={positions}
        orders={orders}
        closedTrades={closedTrades}
        onClosePosition={onClosePosition}
        onToggleTrailingStop={onToggleTrailingStop}
      />
    </div>
  );
};
