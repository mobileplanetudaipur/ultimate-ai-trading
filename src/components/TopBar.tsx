import React from 'react';
import {
  ShieldAlert,
  Pause,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Lock
} from 'lucide-react';
import { AccountState, RiskStatus } from '../types/trading';

interface TopBarProps {
  activeViewTitle: string;
  account: AccountState;
  riskStatus: RiskStatus;
  feedLatencyMs: number;
  onTriggerKillSwitch: () => void;
  onTogglePause: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeViewTitle,
  account,
  riskStatus,
  feedLatencyMs,
  onTriggerKillSwitch,
  onTogglePause
}) => {
  return (
    <header className="h-16 px-6 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Zone 1: View Breadcrumb & Truthful Status */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-white tracking-tight">{activeViewTitle}</h1>
        <span className="text-slate-600 text-xs" aria-hidden="true">/</span>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-semibold text-amber-400 tracking-wide text-[11px]">Paper Simulation</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="text-slate-400 text-xs font-mono">Local Engine ({feedLatencyMs}ms)</span>
        </div>
      </div>

      {/* Zone 2: Account Telemetry Quick Summary */}
      <div className="hidden lg:flex items-center gap-5 text-xs">
        <div>
          <span className="text-[11px] text-slate-400 block font-normal">Paper Equity</span>
          <span className="font-mono font-medium text-slate-100">${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="w-px h-5 bg-slate-800" aria-hidden="true" />
        <div>
          <span className="text-[11px] text-slate-400 block font-normal">Free Margin</span>
          <span className="font-mono font-medium text-emerald-400">${account.freeMargin.toFixed(2)}</span>
        </div>
        <div className="w-px h-5 bg-slate-800" aria-hidden="true" />
        <div>
          <span className="text-[11px] text-slate-400 block font-normal">Daily Drawdown</span>
          <span className={`font-mono font-medium ${riskStatus.todayDrawdownPercent >= 1.0 ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
            {riskStatus.todayDrawdownPercent.toFixed(2)}% / 1.00% Max
          </span>
        </div>
        <div className="w-px h-5 bg-slate-800" aria-hidden="true" />
        <div>
          <span className="text-[11px] text-slate-400 block font-normal">Today's Trades</span>
          <span className={`font-mono font-medium ${riskStatus.todayTradesCount >= 8 ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
            {riskStatus.todayTradesCount} / 8 Max
          </span>
        </div>
      </div>

      {/* Zone 3: Actions (Pause & Emergency Kill Switch) */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onTogglePause}
          disabled={riskStatus.killSwitchTriggered}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
            riskStatus.isTradingPaused
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
          }`}
          title="Pause or resume automated strategy signals"
        >
          {riskStatus.isTradingPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          <span>{riskStatus.isTradingPaused ? 'Resume Entries' : 'Pause Entries'}</span>
        </button>

        <button
          onClick={onTriggerKillSwitch}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            riskStatus.killSwitchTriggered
              ? 'bg-red-700 text-white ring-2 ring-red-400'
              : 'bg-red-600 hover:bg-red-500 text-white shadow-xs'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Emergency Halt</span>
        </button>
      </div>
    </header>
  );
};
