import { ClosedTradeRecord, ExecutionMetrics, OrderRecord } from '../types/trading';

export function calculateExecutionMetrics(
  closedTrades: ClosedTradeRecord[],
  orders: OrderRecord[]
): ExecutionMetrics {
  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter(t => t.netPnl > 0).length;
  const losingTrades = closedTrades.filter(t => t.netPnl < 0).length;
  const winRatePercent = totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;

  const grossProfit = closedTrades.filter(t => t.netPnl > 0).reduce((sum, t) => sum + t.netPnl, 0);
  const grossLoss = Math.abs(closedTrades.filter(t => t.netPnl < 0).reduce((sum, t) => sum + t.netPnl, 0));
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : null;

  const netPnl = Number(closedTrades.reduce((sum, t) => sum + t.netPnl, 0).toFixed(2));

  const totalSlippage = closedTrades.reduce((sum, t) => sum + (t.slippagePips || 0), 0);
  const avgSlippagePips = totalTrades > 0 ? Number((totalSlippage / totalTrades).toFixed(2)) : 0;

  const filledOrders = orders.filter(o => o.status === 'SIMULATED_FILL').length;
  const rejectedOrders = orders.filter(o => o.status === 'REJECTED').length;
  const totalConsidered = orders.filter(o => o.status === 'SIMULATED_FILL' || o.status === 'REJECTED').length;
  const orderFillRatePercent = totalConsidered > 0 ? Number(((filledOrders / totalConsidered) * 100).toFixed(1)) : 100;

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    winRatePercent,
    profitFactor,
    netPnl,
    avgSlippagePips,
    orderFillRatePercent,
    rejectedOrdersCount: rejectedOrders,
    sharpeRatioEstimate: null,
    sampleConfidenceReliable: totalTrades >= 30
  };
}
