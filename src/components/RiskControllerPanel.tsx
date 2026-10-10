import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Lock,
  Clock,
  RotateCcw,
  Percent,
  Sliders,
  Flame,
  CheckCircle2,
  AlertOctagon
} from 'lucide-react';
import { RiskLimits, RiskStatus } from '../types/trading';

interface RiskControllerPanelProps {
  limits: RiskLimits;
  status: RiskStatus;
  openPositionsCount: number;
  totalExposurePercent: number;
  onSimulateLoss: () => void;
  onResetCooldown: () => void;
}

export const RiskControllerPanel: React.FC<RiskControllerPanelProps> = ({
  limits,
  status,
  openPositionsCount,
  totalExposurePercent,
  onSimulateLoss,
  onResetCooldown
}) => {
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');

  useEffect(() => {
    if (!status.isCooldownActive || !status.cooldownEndsAt) {
      setTimeLeftStr('');
      return;
    }

    const interval = setInterval(() => {
      const remainingMs = status.cooldownEndsAt! - Date.now();
      if (remainingMs <= 0) {
        setTimeLeftStr('Cooldown Expired');
      } else {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        setTimeLeftStr(`${mins}m ${secs < 10 ? '0' : ''}${secs}s remaining`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status.isCooldownActive, status.cooldownEndsAt]);

  const consecutivePercent = Math.min(100, (status.consecutiveLossCount / limits.consecutiveLossLockoutThreshold) * 100);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Deterministic Risk Engine & Behavioral Safeguards (Stages 8 & 9)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSimulateLoss}
            className="text-[11px] font-mono px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Simulate a losing trade to test the 5-consecutive-loss behavioral lockout"
          >
            + Test Consecutive Loss ({status.consecutiveLossCount}/5)
          </button>
          {status.isCooldownActive && (
            <button
              onClick={onResetCooldown}
              className="text-[11px] font-mono px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer"
            >
              Reset Lockout
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Stage 9 Consecutive Loss Behavioral Lockout */}
        <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
          status.isCooldownActive
            ? 'bg-rose-950/20 border-rose-500/40 ring-1 ring-rose-500/30'
            : status.consecutiveLossCount >= 3
            ? 'bg-amber-950/20 border-amber-500/40'
            : 'bg-slate-950/50 border-slate-800'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Lock className={`w-3.5 h-3.5 ${status.isCooldownActive ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
                Stage 9 Behavioral Lockout
              </span>
              <span className={`text-[11px] font-mono font-bold ${status.isCooldownActive ? 'text-rose-400' : 'text-slate-300'}`}>
                {status.consecutiveLossCount} / {limits.consecutiveLossLockoutThreshold} Losses
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Mandatory 30-min block after 5 consecutive losses to prevent revenge trading.
            </p>
          </div>

          <div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-1.5">
              <div
                className={`h-full transition-all rounded-full ${
                  status.isCooldownActive
                    ? 'bg-rose-500'
                    : status.consecutiveLossCount >= 3
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${consecutivePercent}%` }}
              />
            </div>
            {status.isCooldownActive ? (
              <div className="flex items-center justify-between text-[11px] font-mono text-rose-400 font-bold">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 animate-spin" />
                  30m Lockout Active
                </span>
                <span>{timeLeftStr}</span>
              </div>
            ) : (
              <div className="text-[10px] text-slate-500 font-mono">
                {5 - status.consecutiveLossCount} losses remaining until mandatory lockout
              </div>
            )}
          </div>
        </div>

        {/* Metric 2: Daily Drawdown vs Daily Limit */}
        <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
          status.dailyLossLimitBreached
            ? 'bg-rose-950/20 border-rose-500/40 ring-1 ring-rose-500/30'
            : 'bg-slate-950/50 border-slate-800'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-blue-400" />
                Daily Drawdown Guard
              </span>
              <span className={`text-[11px] font-mono font-bold ${
                status.dailyLossLimitBreached ? 'text-rose-400' : 'text-slate-300'
              }`}>
                {status.todayDrawdownPercent.toFixed(2)}% / {limits.dailyLossLimitPercent.toFixed(1)}% Max
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Today's realized PnL: <span className={`font-mono font-bold ${status.todayRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {status.todayRealizedPnl >= 0 ? '+' : ''}${status.todayRealizedPnl.toFixed(2)}
              </span>
            </p>
          </div>

          <div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-1.5">
              <div
                className={`h-full transition-all rounded-full ${
                  status.dailyLossLimitBreached ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (status.todayDrawdownPercent / limits.dailyLossLimitPercent) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Limit: {limits.dailyLossLimitPercent}%</span>
              <span>{status.dailyLossLimitBreached ? 'BREACHED — BLOCKED' : 'Within Safety Band'}</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Portfolio Exposure & Concurrency */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                Exposure & Position Limits
              </span>
              <span className="text-[11px] font-mono text-slate-300">
                {openPositionsCount} / {limits.maxOpenPositions} Active
              </span>
            </div>
            <div className="space-y-1 text-[11px] font-mono text-slate-400 mb-2">
              <div className="flex justify-between">
                <span>Max Risk / Trade:</span>
                <span className="text-slate-200 font-semibold">{limits.maxRiskPerTradePercent}% Equity</span>
              </div>
              <div className="flex justify-between">
                <span>Max Total Exposure:</span>
                <span className="text-slate-200 font-semibold">{limits.maxTotalExposurePercent}% Equity</span>
              </div>
              <div className="flex justify-between">
                <span>Current Open Exposure:</span>
                <span className="text-sky-400 font-semibold">{totalExposurePercent.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
            <span>Weekend Lockout: Enabled</span>
            <span>News Blackout: Enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
};
