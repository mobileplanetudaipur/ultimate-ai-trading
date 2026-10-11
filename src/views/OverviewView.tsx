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
  ArrowRight,
  Shield,
  Briefcase,
  Brain,
  Info
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
  operatingMode?: string;
  onNavigateTab: (tab: any) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  account,
  riskStatus,
  riskLimits,
  positions,
  strategyEvaluations,
  auditLogs,
  operatingMode = 'demo',
  onNavigateTab
}) => {
  const isDrawdownCritical = riskStatus.todayDrawdownPercent >= riskLimits.dailyLossLimitPercent;
  const isTradeCapReached = riskStatus.todayTradesCount >= riskLimits.maxDailyTrades;
  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const actionableStrategies = strategyEvaluations.filter(e => e.signal !== 'NO_TRADE');

  // Headroom calculations
  const remainingTrades = Math.max(0, riskLimits.maxDailyTrades - riskStatus.todayTradesCount);
  const drawdownHeadroom = Math.max(0, riskLimits.dailyLossLimitPercent - riskStatus.todayDrawdownPercent);
  const positionHeadroom = Math.max(0, riskLimits.maxOpenPositions - positions.length);
  const currentEffectiveLeverage = account.equity > 0
    ? positions.reduce((sum, p) => sum + p.sizeLots * 100000 * p.currentPrice, 0) / account.equity
    : 0;

  return (
    <div className="space-y-6">
      {/* 1. System Mode, Health, & Operational Governance Header */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              operatingMode === 'live' 
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
            }`}>
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm text-white">
                  Operating Mode: <span className="capitalize">{operatingMode.replace('_', ' ')}</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  operatingMode === 'live'
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                    : operatingMode === 'demo'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                }`}>
                  {operatingMode === 'live' ? 'Approved Live Execution' : operatingMode === 'demo' ? 'XM MT5 Demo Connected' : 'Simulated Paper Mode'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium">
                  Deterministic Risk Active (0.20% / Trade)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {operatingMode === 'live'
                  ? 'Live mode enabled under explicit operator signoff. Re-verification active on every tick. Any risk boundary excursion triggers immediate fail-closed shutdown.'
                  : operatingMode === 'demo'
                  ? 'Connected to XM Demo terminal via local Windows bridge. Orders placed on demo account only.'
                  : 'Operating in Local In-Memory Paper Simulation. Market feed is synthetic paper data; real broker bridge is offline. Strict 0.20% per-trade risk engine enforced.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigateTab('shadow')}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 transition-all cursor-pointer hover:text-white flex items-center gap-2"
            >
              <span>Inspect MT5 Gateway</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Critical Status Banners (Emergency Halt or 5-Loss Cooldown) */}
      {riskStatus.killSwitchTriggered && (
        <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-4 text-xs text-red-200 backdrop-blur-xl flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-sm text-white block">Emergency Halt Active</span>
            <p className="text-red-200/90 leading-relaxed">
              Automated and manual order entries are suspended. Open positions remain protected by local stop limits and will close when price triggers or upon explicit operator request.
            </p>
          </div>
        </div>
      )}

      {riskStatus.isCooldownActive && !riskStatus.killSwitchTriggered && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4 text-xs text-amber-200 backdrop-blur-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-sm text-white block">Cooling-Off Safeguard Active (5-Loss Lockout)</span>
            <p className="text-amber-200/90 leading-relaxed">
              Mandatory 30-minute safety lockout engaged after five consecutive net losses. Prevents emotional trading and protects capital.
            </p>
          </div>
        </div>
      )}

      {/* 2. Core Financial Figures & Provenance Card */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80">
          <div>
            <h2 className="text-sm font-semibold text-white">Account Telemetry & Ledger</h2>
            <p className="text-xs text-slate-400">
              Provenance: Local In-Memory Paper Ledger (Broker-Unconfirmed)
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Currency: {account.currency}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Equity */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Paper equity</span>
            <span className="text-lg font-semibold text-white font-mono tabular-nums">
              ${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 font-mono block mt-1">
              Balance: ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Today's Realized P&L */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Daily realized P&L</span>
            <span
              className={`text-lg font-semibold font-mono tabular-nums ${
                riskStatus.todayRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {riskStatus.todayRealizedPnl >= 0 ? '+' : ''}${riskStatus.todayRealizedPnl.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500 font-mono block mt-1">
              Net of paper fees
            </span>
          </div>

          {/* Daily Drawdown */}
          <div
            className={`p-3.5 rounded-xl border ${
              isDrawdownCritical ? 'border-rose-500/40 bg-rose-950/20' : 'bg-slate-950/60 border-slate-800/80'
            }`}
          >
            <span className="text-xs text-slate-400 block mb-1">Daily drawdown</span>
            <span
              className={`text-lg font-semibold font-mono tabular-nums ${
                isDrawdownCritical ? 'text-rose-400' : 'text-slate-100'
              }`}
            >
              {riskStatus.todayDrawdownPercent.toFixed(2)}%
            </span>
            <span className="text-xs text-slate-500 font-mono block mt-1">
              Limit: {riskLimits.dailyLossLimitPercent.toFixed(2)}% max
            </span>
          </div>

          {/* Free Margin */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Free margin</span>
            <span className="text-lg font-semibold text-emerald-400 font-mono tabular-nums">
              ${account.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 font-mono block mt-1">
              Used: ${account.marginUsed.toFixed(2)}
            </span>
          </div>

          {/* Effective Leverage */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Effective leverage</span>
            <span className="text-lg font-semibold text-slate-100 font-mono tabular-nums">
              {currentEffectiveLeverage.toFixed(2)}x
            </span>
            <span className="text-xs text-slate-500 font-mono block mt-1">
              Cap: {riskLimits.maxEffectiveLeverage.toFixed(2)}x max
            </span>
          </div>

          {/* Risk Headroom */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Risk headroom</span>
            <span className="text-lg font-semibold text-slate-100 font-mono tabular-nums">
              {drawdownHeadroom.toFixed(2)}% DD
            </span>
            <span className="text-xs text-slate-500 font-mono block mt-1">
              {remainingTrades} trade(s) left
            </span>
          </div>
        </div>
      </div>

      {/* 3. Operational Headroom & Risk Guards Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Drawdown Headroom Gauge */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300">Daily Drawdown Budget</span>
            <span className="text-xs font-mono font-medium text-slate-400">
              {riskStatus.todayDrawdownPercent.toFixed(2)}% / {riskLimits.dailyLossLimitPercent.toFixed(2)}%
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden mb-2 border border-slate-800/80">
            <div
              className={`h-full rounded-full transition-all ${
                isDrawdownCritical ? 'bg-rose-500' : 'bg-blue-500'
              }`}
              style={{
                width: `${Math.min(100, (riskStatus.todayDrawdownPercent / riskLimits.dailyLossLimitPercent) * 100)}%`
              }}
            />
          </div>
          <div className="text-xs text-slate-400 flex justify-between">
            <span>Remaining cushion:</span>
            <span className="font-mono text-slate-300 font-medium">
              ${((drawdownHeadroom / 100) * account.equity).toFixed(2)} ({drawdownHeadroom.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Daily Trades Cap */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300">Daily Trades Executed</span>
            <span className="text-xs font-mono font-medium text-slate-400">
              {riskStatus.todayTradesCount} / {riskLimits.maxDailyTrades}
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden mb-2 border border-slate-800/80">
            <div
              className={`h-full rounded-full transition-all ${
                isTradeCapReached ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{
                width: `${Math.min(100, (riskStatus.todayTradesCount / riskLimits.maxDailyTrades) * 100)}%`
              }}
            />
          </div>
          <div className="text-xs text-slate-400 flex justify-between">
            <span>Remaining submissions:</span>
            <span className="font-mono text-slate-300 font-medium">
              {remainingTrades} entries allowed
            </span>
          </div>
        </div>

        {/* Position Concurrency */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300">Concurrent Positions</span>
            <span className="text-xs font-mono font-medium text-slate-400">
              {positions.length} / {riskLimits.maxOpenPositions}
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden mb-2 border border-slate-800/80">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{
                width: `${(positions.length / riskLimits.maxOpenPositions) * 100}%`
              }}
            />
          </div>
          <div className="text-xs text-slate-400 flex justify-between">
            <span>Slots open:</span>
            <span className="font-mono text-slate-300 font-medium">
              {positionHeadroom} slot(s)
            </span>
          </div>
        </div>
      </div>

      {/* 4. Active Positions & Strategy Signals Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open Positions Card */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-semibold text-white">
                  Active Market Positions ({positions.length})
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('portfolio')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>View ledger</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {positions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-mono">
                No active market exposure. Risk footprint is currently 0.00%.
              </div>
            ) : (
              <div className="space-y-2">
                {positions.map(pos => {
                  const isPositive = pos.unrealizedPnl >= 0;
                  return (
                    <div
                      key={pos.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white font-sans">{pos.symbol}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                              pos.side === 'BUY'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {pos.side} {pos.sizeLots}L
                          </span>
                        </div>
                        <span className="text-slate-400 text-[11px]">
                          Entry: {pos.entryPrice} • Mark: {pos.currentPrice}
                        </span>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-semibold text-sm tabular-nums block ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          SL: {pos.stopLossPrice}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-slate-800/60 text-xs text-slate-400 flex items-center justify-between">
            <span>Floating net mark:</span>
            <span
              className={`font-mono font-semibold tabular-nums ${
                totalUnrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalUnrealized >= 0 ? '+' : ''}${totalUnrealized.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Strategy Signal Matrix Card */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-semibold text-white">
                  Strategy Signals & Regime Filter
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('strategies')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>All strategies</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {strategyEvaluations.slice(0, 3).map(ev => {
                const isTrade = ev.signal !== 'NO_TRADE';
                return (
                  <div
                    key={ev.strategyId}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{ev.strategyName}</span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-1">
                        {ev.noTradeReason || 'Conditions met within risk bounds.'}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold ${
                          ev.signal === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : ev.signal === 'SELL'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}
                      >
                        {ev.signal}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-800/60 text-xs text-slate-400 flex items-center justify-between">
            <span>Actionable signals:</span>
            <span className="font-mono text-slate-300 font-medium">
              {actionableStrategies.length} active of {strategyEvaluations.length} evaluated
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
