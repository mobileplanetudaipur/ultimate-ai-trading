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
  Lock,
  Bot,
  User,
  CheckCircle2
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
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex items-center border-b border-slate-800/80 bg-slate-950/40 px-5 pt-3 gap-2">
        <button
          onClick={() => setActiveTab('positions')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'positions'
              ? 'border-blue-500 text-blue-400 bg-slate-900/60 rounded-t-xl shadow-xs'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Active Positions</span>
          <span className="text-xs font-mono text-slate-400">
            ({positions.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'border-blue-500 text-blue-400 bg-slate-900/60 rounded-t-xl shadow-xs'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          <span>Order Lifecycle Tracker</span>
          <span className="text-xs font-mono text-slate-400">
            ({orders.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'border-blue-500 text-blue-400 bg-slate-900/60 rounded-t-xl shadow-xs'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Closed Deals & Realized P&L</span>
          <span className="text-xs font-mono text-slate-400">
            ({closedTrades.length})
          </span>
        </button>
      </div>

      {/* Tab 1: Active Positions */}
      {activeTab === 'positions' && (
        <div className="overflow-x-auto">
          {positions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-mono">
              No open market positions. Portfolio exposure is currently 0.00%.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 font-medium">
                  <th className="p-3.5">Symbol / ID</th>
                  <th className="p-3.5">Ownership</th>
                  <th className="p-3.5">Side & Size</th>
                  <th className="p-3.5">Entry / Mark</th>
                  <th className="p-3.5">Stop Loss / TP</th>
                  <th className="p-3.5">Protection Controls</th>
                  <th className="p-3.5 text-right">Unrealized Net P&L</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {positions.map(pos => {
                  const isPositive = pos.unrealizedPnl >= 0;
                  const isManual = !!pos.isExternalOrManual;

                  return (
                    <tr key={pos.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="p-3.5">
                        <div className="font-semibold text-white text-xs font-sans">{pos.symbol}</div>
                        <div className="text-[11px] text-slate-400">{pos.id}</div>
                      </td>

                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-sans bg-slate-800/80 text-slate-300 border border-slate-700/80">
                          {isManual ? <User className="w-3 h-3 text-blue-400" /> : <Bot className="w-3 h-3 text-purple-400" />}
                          <span>{isManual ? 'Manual Operator' : 'Bot (Algorithmic)'}</span>
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold mr-1.5 ${
                            pos.side === 'BUY'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {pos.side}
                        </span>
                        <span className="text-slate-200 tabular-nums">{pos.sizeLots} Lots</span>
                      </td>

                      <td className="p-3.5">
                        <div className="text-slate-400 tabular-nums">In: {pos.entryPrice}</div>
                        <div className="font-semibold text-white tabular-nums">Now: {pos.currentPrice}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="text-rose-400 tabular-nums">SL: {pos.stopLossPrice}</div>
                        <div className="text-emerald-400 tabular-nums">TP: {pos.takeProfitPrice || 'None'}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="flex flex-col gap-1 text-[11px]">
                          {pos.isBreakEvenLocked && (
                            <span className="text-sky-300 flex items-center gap-1 font-sans">
                              <Lock className="w-3 h-3" /> Break-even locked (+1p)
                            </span>
                          )}
                          <button
                            onClick={() => onToggleTrailingStop(pos.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] border text-left cursor-pointer transition-all ${
                              pos.isTrailingStopActive
                                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 font-semibold'
                                : 'bg-slate-800/70 border-slate-700/80 text-slate-400 hover:text-white'
                            }`}
                          >
                            {pos.isTrailingStopActive ? 'Trailing Stop: 20p active' : '+ Enable Trailing Stop'}
                          </button>
                        </div>
                      </td>

                      <td className="p-3.5 text-right">
                        <div className={`font-semibold text-sm tabular-nums ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-400 tabular-nums">
                          Comm: -${pos.commission.toFixed(2)}
                        </div>
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => onClosePosition(pos.id)}
                          className="px-3 py-1.5 text-xs rounded-xl bg-slate-800/80 hover:bg-rose-950/60 border border-slate-700/80 hover:border-rose-500/40 text-slate-300 hover:text-rose-200 transition-all cursor-pointer font-sans font-medium"
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

      {/* Tab 2: Order Lifecycle Tracker */}
      {activeTab === 'orders' && (
        <div className="overflow-x-auto">
          {orders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-mono">
              No orders submitted in current session.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 font-medium">
                  <th className="p-3.5">Order / Client ID</th>
                  <th className="p-3.5">Idempotency Key</th>
                  <th className="p-3.5">Symbol / Side</th>
                  <th className="p-3.5">Lifecycle State</th>
                  <th className="p-3.5">Requested vs Executed</th>
                  <th className="p-3.5">Slippage & Costs</th>
                  <th className="p-3.5">Provenance</th>
                  <th className="p-3.5 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {orders.map(order => {
                  return (
                    <tr key={order.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="p-3.5">
                        <div className="font-semibold text-white text-xs">{order.id}</div>
                        <div className="text-[11px] text-slate-400">{order.clientOrderId}</div>
                      </td>

                      <td className="p-3.5 text-slate-400 text-[11px]">
                        <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono">
                          {order.idempotencyKey.substring(0, 14)}...
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold mr-1.5 ${
                            order.side === 'BUY'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {order.side}
                        </span>
                        <span className="text-slate-200 font-semibold">{order.symbol}</span>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          {order.status === 'SIMULATED_FILL' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold font-sans">
                              <CheckCircle className="w-3 h-3" />
                              Simulated Fill
                            </span>
                          )}
                          {order.status === 'REJECTED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold font-sans">
                              <XCircle className="w-3 h-3" />
                              Rejected
                            </span>
                          )}
                          {order.status !== 'SIMULATED_FILL' && order.status !== 'REJECTED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[11px] font-sans">
                              <Clock className="w-3 h-3 animate-spin" />
                              {order.status}
                            </span>
                          )}
                        </div>
                        {order.rejectionReason && (
                          <div className="text-[11px] text-rose-300 mt-1 max-w-xs truncate">
                            {order.rejectionReason}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-slate-300">
                        <div className="tabular-nums">Req: {order.requestedPrice}</div>
                        <div className="text-white font-semibold tabular-nums">Exec: {order.executedPrice || '—'}</div>
                      </td>

                      <td className="p-3.5 text-[11px]">
                        <div className="text-slate-300 tabular-nums">
                          Slip: {order.slippagePips !== undefined ? `${order.slippagePips.toFixed(1)}p` : '0.0p'}
                        </div>
                        <div className="text-slate-400 tabular-nums">
                          Fee: ${order.commissionPaid.toFixed(2)}
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-400 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {order.isSimulatedOrder ? 'Local Paper' : 'Broker Deal'}
                        </span>
                      </td>

                      <td className="p-3.5 text-right text-slate-400 text-[11px]">
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
            <div className="py-12 text-center text-slate-400 text-xs font-mono">
              No realized deals recorded yet in session.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 font-medium">
                  <th className="p-3.5">Deal ID / Symbol</th>
                  <th className="p-3.5">Side & Lots</th>
                  <th className="p-3.5">Entry & Exit</th>
                  <th className="p-3.5">Exit Reason</th>
                  <th className="p-3.5">Gross P&L</th>
                  <th className="p-3.5">Costs (Comm & Swap)</th>
                  <th className="p-3.5 text-right">Net Realized P&L</th>
                  <th className="p-3.5 text-right">Closed Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {closedTrades.map(trade => {
                  const isNetPositive = trade.netPnl >= 0;

                  return (
                    <tr key={trade.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="p-3.5">
                        <div className="font-semibold text-white text-xs">{trade.symbol}</div>
                        <div className="text-[11px] text-slate-400">{trade.id}</div>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold mr-1.5 ${
                            trade.side === 'BUY'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {trade.side}
                        </span>
                        <span className="text-slate-300 tabular-nums">{trade.sizeLots} Lots</span>
                      </td>

                      <td className="p-3.5 text-slate-300">
                        <div className="tabular-nums">In: {trade.entryPrice}</div>
                        <div className="text-white font-semibold tabular-nums">Out: {trade.exitPrice}</div>
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700/80 font-sans">
                          {trade.exitReason}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-300 tabular-nums">
                        ${trade.grossPnl.toFixed(2)}
                      </td>

                      <td className="p-3.5 text-slate-400 text-[11px] tabular-nums">
                        -${(trade.commission + trade.swap).toFixed(2)}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className={`font-semibold text-sm tabular-nums ${isNetPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isNetPositive ? '+' : ''}${trade.netPnl.toFixed(2)}
                        </div>
                      </td>

                      <td className="p-3.5 text-right text-slate-400 text-[11px]">
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
