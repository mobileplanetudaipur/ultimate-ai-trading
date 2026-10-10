import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Layers,
  Clock,
  Lock,
  ArrowRight
} from 'lucide-react';
import {
  AccountState,
  AuditLogEntry,
  PositionRecord,
  RiskLimits,
  RiskStatus,
  StrategyEvaluation
} from '../types/trading';

interface OverviewViewProps {
  account: AccountState;
  riskStatus: RiskStatus;
  riskLimits: RiskLimits;
  positions: PositionRecord[];
  strategyEvaluations: StrategyEvaluation[];
  auditLogs: AuditLogEntry[];
  onNavigateTab: (tab: any) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  account,
  riskStatus,
  riskLimits,
  positions,
  strategyEvaluations,
  auditLogs,
  onNavigateTab
}) => {
  const isDrawdownCritical = riskStatus.todayDrawdownPercent >= riskLimits.dailyLossLimitPercent;
  const isTradeCapReached = riskStatus.todayTradesCount >= riskLimits.maxDailyTrades;

  return (
    <div className="space-y-6">
      {/* System Integrity & Safety Banner */}
      <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/15 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">System Operating in Paper Simulation</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-emerald-400 font-medium text-xs">
                Zero Capital at Risk
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live broker trading is permanently disabled. All orders, ticks, and fills are executed locally inside the deterministic paper engine.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('shadow')}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 transition-colors cursor-pointer"
          >
            Inspect MT5 Bridge State
          </button>
        </div>
      </div>

      {/* Critical Status Alerts if active */}
      {riskStatus.killSwitchTriggered && (
        <div className="p-4 rounded-xl border border-red-500/50 bg-red-950/30 text-xs text-red-200 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <span className="font-bold block text-sm">EMERGENCY KILL SWITCH ACTIVE</span>
            <span>All new automated and manual entries are strictly halted. Open positions remain protected by local stop limits.</span>
          </div>
        </div>
      )}

      {riskStatus.isCooldownActive && !riskStatus.killSwitchTriggered && (
        <div className="p-4 rounded-xl border border-amber-500/50 bg-amber-950/30 text-xs text-amber-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <span className="font-bold block text-sm">BEHAVIORAL SAFEGUARD ACTIVE: 5-LOSS 30-MIN LOCKOUT</span>
            <span>Five consecutive net losses triggered mandatory cooling-off window. Prevents emotional revenge trading.</span>
          </div>
        </div>
      )}

      {/* Core Key Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        {/* Paper Equity */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
          <span className="text-[10px] text-slate-400 uppercase block mb-1">Paper Equity</span>
          <span className="text-lg font-bold text-white">${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span className="text-[10px] text-slate-400 block mt-1">Bal: ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Daily PnL */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
          <span className="text-[10px] text-slate-400 uppercase block mb-1">Today's Realized PnL</span>
          <span className={`text-lg font-bold ${riskStatus.todayRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {riskStatus.todayRealizedPnl >= 0 ? '+' : ''}${riskStatus.todayRealizedPnl.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">Closed deals today</span>
        </div>

        {/* Daily Drawdown */}
        <div className={`p-3.5 rounded-xl border ${isDrawdownCritical ? 'border-rose-500/50 bg-rose-950/20' : 'border-slate-800 bg-slate-900/50'}`}>
          <span className="text-[10px] text-slate-400 uppercase block mb-1">Daily Drawdown</span>
          <span className={`text-lg font-bold ${isDrawdownCritical ? 'text-rose-400' : 'text-slate-100'}`}>
            {riskStatus.todayDrawdownPercent.toFixed(2)}%
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">Limit: {riskLimits.dailyLossLimitPercent.toFixed(2)}% Max</span>
        </div>

        {/* Daily Trades Count */}
        <div className={`p-3.5 rounded-xl border ${isTradeCapReached ? 'border-rose-500/50 bg-rose-950/20' : 'border-slate-800 bg-slate-900/50'}`}>
          <span className="text-[10px] text-slate-400 uppercase block mb-1">Daily Trades Cap</span>
          <span className={`text-lg font-bold ${isTradeCapReached ? 'text-rose-400' : 'text-slate-100'}`}>
            {riskStatus.todayTradesCount} / {riskLimits.maxDailyTrades}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">{8 - riskStatus.todayTradesCount} trades headroom</span>
        </div>

        {/* Free Margin */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
          <span className="text-[10px] text-slate-400 uppercase block mb-1">Free Margin</span>
          <span className="text-lg font-bold text-emerald-400">${account.freeMargin.toFixed(2)}</span>
          <span className="text-[10px] text-slate-400 block mt-1">Used: ${account.marginUsed.toFixed(2)}</span>
        </div>

        {/* Effective Leverage */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
          <span className="text-[10px] text-slate-400 uppercase block mb-1">Effective Leverage</span>
          <span className="text-lg font-bold text-slate-100">
            {((account.marginUsed * account.leverage) / (account.equity || 1)).toFixed(2)}x
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">Max Cap: 3.00x</span>
        </div>
      </div>

      {/* Two Column Grid: Open Positions & Strategy Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Active Positions Card */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">Active Paper Positions</h2>
              </div>
              <span className="text-xs font-mono text-slate-400">{positions.length} of {riskLimits.maxOpenPositions} Max</span>
            </div>

            {positions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-mono">
                No active positions. Zero capital currently committed to market risk.
              </div>
            ) : (
              <div className="space-y-2.5 font-mono text-xs">
                {positions.map(p => (
                  <div key={p.id} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs font-bold ${p.side === 'BUY' ? 'text-blue-400' : 'text-rose-400'}`}>
                          {p.side}
                        </span>
                        <span className="font-semibold text-white text-xs">{p.symbol}</span>
                        <span className="text-slate-400 text-xs font-mono">{p.sizeLots} lots</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-2">
                        <span>Entry {p.entryPrice}</span>
                        <span className="text-slate-600" aria-hidden="true">·</span>
                        <span>SL {p.stopLossPrice}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`font-mono font-bold text-sm ${p.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {p.unrealizedPnl >= 0 ? '+' : ''}${p.unrealizedPnl.toFixed(2)}
                      </span>
                      <div className="text-[10px] text-slate-400 font-mono">Mark {p.currentPrice}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800/80 mt-4 flex justify-end">
            <button
              onClick={() => onNavigateTab('portfolio')}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
            >
              <span>View Full Portfolio & Order History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Strategy Signal & Regime Status Card */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">Candidate Strategies</h2>
              </div>
              <span className="text-xs font-mono text-slate-400">{strategyEvaluations.length} Active Candidates</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {strategyEvaluations.map(s => (
                <div key={s.strategyId} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white block">{s.strategyName}</span>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                      <span>{s.symbol}</span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span>Score {s.suitabilityScore}/100</span>
                    </div>
                  </div>

                  <div>
                    {s.signal === 'NO_TRADE' ? (
                      <span className="text-amber-400 font-mono text-xs font-medium">
                        NO TRADE
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-mono text-xs font-semibold">
                        {s.signal} PROPOSAL
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 mt-4 flex justify-end">
            <button
              onClick={() => onNavigateTab('strategies')}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Explore Strategy Rules & Abstention Reasons</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Audit Trail Preview */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Recent Operational Audit Log</span>
          <button
            onClick={() => onNavigateTab('audit')}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
          >
            <span>Full Audit History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2 font-mono text-xs">
          {auditLogs.slice(-4).reverse().map(log => (
            <div key={log.id} className="flex items-start justify-between gap-3 text-slate-300">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-slate-300">{log.category}</span>
                <span className="text-slate-200">{log.message}</span>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">{log.actor}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
