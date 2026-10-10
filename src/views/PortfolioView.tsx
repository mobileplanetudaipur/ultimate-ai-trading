import React from 'react';
import { PositionRecord, OrderRecord, ClosedTradeRecord } from '../types/trading';
import { PositionsOrdersTable } from '../components/PositionsOrdersTable';
import { Layers, Briefcase, DollarSign, Shield } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      {/* Portfolio Status Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
          <span className="text-[10px] text-slate-400 uppercase block mb-1">Open Positions Count</span>
          <span className="text-xl font-bold text-white">{positions.length} / 3 Max</span>
          <span className="text-[10px] text-slate-400 block mt-1">Single-account risk isolated</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
          <span className="text-[10px] text-slate-400 uppercase block mb-1">Floating Net P&L</span>
          <span className={`text-xl font-bold ${totalUnrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalUnrealized >= 0 ? '+' : ''}${totalUnrealized.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">Mark-to-market net of commission</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
          <span className="text-[10px] text-slate-400 uppercase block mb-1">Realized Net P&L</span>
          <span className={`text-xl font-bold ${totalRealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalRealized >= 0 ? '+' : ''}${totalRealized.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">All completed paper deals</span>
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
