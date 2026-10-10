import React, { useState } from 'react';
import {
  Layers,
  ListOrdered,
  History,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Lock,
  Compass
} from 'lucide-react';
import { ClosedTradeRecord, OrderRecord, PositionRecord } from '../types/trading';
import { formatPrice } from '../utils/indicators';

interface PositionsOrdersTableProps {
  positions: PositionRecord[];
  orders: OrderRecord[];
  closedTrades: ClosedTradeRecord[];
  onClosePosition: (positionId: string) => void;
  onToggleTrailingStop: (positionId: string) => void;
}

export const PositionsOrdersTable: React.FC<PositionsOrdersTableProps> = ({
  positions,
  orders,
  closedTrades,
  onClosePosition,
  onToggleTrailingStop
}) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex items-center border-b border-slate-800 bg-slate-950/40 px-4 pt-2 gap-2">
        <button
          onClick={() => setActiveTab('positions')}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'positions'
              ? 'border-blue-500 text-blue-400 bg-slate-900/60 rounded-t-md'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Active Positions</span>
          <span className="text-[11px] font-mono text-slate-400">
            ({positions.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'border-blue-500 text-blue-400 bg-slate-900/60 rounded-t-md'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          <span>Order Lifecycle Tracker</span>
          <span className="text-[11px] font-mono text-slate-400">
            ({orders.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'border-blue-500 text-blue-400 bg-slate-900/60 rounded-t-md'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Closed Deals & Realized P&L</span>
          <span className="text-[11px] font-mono text-slate-400">
            ({closedTrades.length})
          </span>
        </button>
      </div>

      {/* Tab 1: Active Positions */}
      {activeTab === 'positions' && (
        <div className="overflow-x-auto">
          {positions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-mono">
              No open market positions. Risk exposure is currently 0.00%.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-mono text-[11px]">
                  <th className="p-3">Symbol / ID</th>
                  <th className="p-3">Side & Size</th>
                  <th className="p-3">Entry Price</th>
                  <th className="p-3">Current Mark</th>
                  <th className="p-3">Stop Loss</th>
                  <th className="p-3">Take Profit</th>
                  <th className="p-3">Protection Status (Stage 10)</th>
                  <th className="p-3 text-right">Unrealized Net P&L</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {positions.map(pos => {
                  const isPositive = pos.unrealizedPnl >= 0;

                  return (
                    <tr key={pos.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-white text-xs">{pos.symbol}</div>
                        <div className="text-[10px] text-slate-500">{pos.id}</div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mr-1.5 ${
                          pos.side === 'BUY'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {pos.side}
                        </span>
                        <span className="text-slate-200">{pos.sizeLots} Lots</span>
                      </td>
                      <td className="p-3 text-slate-300">{pos.entryPrice}</td>
                      <td className="p-3 font-semibold text-white">{pos.currentPrice}</td>
                      <td className="p-3 text-rose-400">{pos.stopLossPrice}</td>
                      <td className="p-3 text-emerald-400">{pos.takeProfitPrice || 'None'}</td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1 text-[10px]">
                          {pos.isBreakEvenLocked && (
                            <span className="text-sky-400 flex items-center gap-1">
                              <Lock className="w-3 h-3" /> BE Locked (+1p buffer)
                            </span>
                          )}
                          <button
                            onClick={() => onToggleTrailingStop(pos.id)}
                            className={`px-2 py-0.5 rounded text-[10px] border text-left cursor-pointer transition-colors ${
                              pos.isTrailingStopActive
                                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            {pos.isTrailingStopActive ? 'Trailing Stop: 20p Active' : '+ Enable Trailing Stop'}
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className={`font-bold text-sm ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Comm: -${pos.commission.toFixed(2)}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => onClosePosition(pos.id)}
                          className="px-2.5 py-1 text-[11px] rounded bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
                        >
                          Close Market
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 2: Order Lifecycle Tracker (Stage 5) */}
      {activeTab === 'orders' && (
        <div className="overflow-x-auto">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-mono">
              No orders submitted in current session.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-mono text-[11px]">
                  <th className="p-3">Order & Client ID</th>
                  <th className="p-3">Idempotency Key</th>
                  <th className="p-3">Symbol / Side</th>
                  <th className="p-3">Lifecycle State (Stage 5)</th>
                  <th className="p-3">Req vs Exec Price</th>
                  <th className="p-3">Slippage & Comm</th>
                  <th className="p-3">Broker Token</th>
                  <th className="p-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {orders.map(order => {
                  return (
                    <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-white text-xs">{order.id}</div>
                        <div className="text-[10px] text-slate-500">{order.clientOrderId}</div>
                      </td>
                      <td className="p-3 text-slate-400 text-[10px]">
                        <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          {order.idempotencyKey.substring(0, 16)}...
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mr-1.5 ${
                          order.side === 'BUY'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {order.side}
                        </span>
                        <span className="text-slate-300 font-semibold">{order.symbol}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {order.status === 'SIMULATED_FILL' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                              <CheckCircle className="w-3 h-3" />
                              SIMULATED FILL
                            </span>
                          )}
                          {order.status === 'REJECTED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                              <XCircle className="w-3 h-3" />
                              REJECTED
                            </span>
                          )}
                          {order.status !== 'SIMULATED_FILL' && order.status !== 'REJECTED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 text-[10px]">
                              <Clock className="w-3 h-3 animate-spin" />
                              {order.status}
                            </span>
                          )}
                        </div>
                        {order.rejectionReason && (
                          <div className="text-[10px] text-rose-400 mt-0.5 max-w-xs truncate">
                            {order.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-slate-300">
                        <div>Req: {order.requestedPrice}</div>
                        <div className="text-white font-semibold">Exec: {order.executedPrice || '—'}</div>
                      </td>
                      <td className="p-3 text-[11px]">
                        <div className="text-slate-300">
                          Slip: {order.slippagePips !== undefined ? `${order.slippagePips.toFixed(1)}p` : '0.0p'}
                        </div>
                        <div className="text-slate-500">Comm: ${order.commissionPaid.toFixed(2)}</div>
                      </td>
                      <td className="p-3 text-slate-400 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {order.isSimulatedOrder ? 'Local Paper' : 'Broker'}
                        </span>
                      </td>
                      <td className="p-3 text-right text-slate-500 text-[10px]">
                        {new Date(order.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 3: Closed Trades History */}
      {activeTab === 'history' && (
        <div className="overflow-x-auto">
          {closedTrades.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-mono">
              No realized deals recorded yet.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-mono text-[11px]">
                  <th className="p-3">Deal ID / Symbol</th>
                  <th className="p-3">Side & Lots</th>
                  <th className="p-3">Entry & Exit</th>
                  <th className="p-3">Exit Reason</th>
                  <th className="p-3">Gross P&L</th>
                  <th className="p-3">Commissions & Fees</th>
                  <th className="p-3 text-right">Net Realized P&L</th>
                  <th className="p-3 text-right">Closed Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {closedTrades.map(trade => {
                  const isNetPositive = trade.netPnl >= 0;

                  return (
                    <tr key={trade.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-white text-xs">{trade.symbol}</div>
                        <div className="text-[10px] text-slate-500">{trade.id}</div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mr-1.5 ${
                          trade.side === 'BUY'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {trade.side}
                        </span>
                        <span className="text-slate-300">{trade.sizeLots} Lots</span>
                      </td>
                      <td className="p-3 text-slate-300">
                        <div>In: {trade.entryPrice}</div>
                        <div className="text-white font-semibold">Out: {trade.exitPrice}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {trade.exitReason}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">
                        ${trade.grossPnl.toFixed(2)}
                      </td>
                      <td className="p-3 text-slate-400 text-[10px]">
                        -${(trade.commission + trade.swap).toFixed(2)}
                      </td>
                      <td className="p-3 text-right">
                        <div className={`font-bold text-sm ${isNetPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isNetPositive ? '+' : ''}${trade.netPnl.toFixed(2)}
                        </div>
                      </td>
                      <td className="p-3 text-right text-slate-500 text-[10px]">
                        {new Date(trade.closedAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
