import React from 'react';
import {
  ShieldAlert,
  Pause,
  Play,
  Menu,
  Activity,
  Layers
} from 'lucide-react';
import { AccountState, RiskStatus } from '../types/trading';

interface TopBarProps {
  activeViewTitle: string;
  account: AccountState;
  riskStatus: RiskStatus;
  feedLatencyMs: number;
  onTriggerKillSwitch: () => void;
  onTogglePause: () => void;
  onOpenMobileNav?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeViewTitle,
  account,
  riskStatus,
  feedLatencyMs,
  onTriggerKillSwitch,
  onTogglePause,
  onOpenMobileNav
}) => {
  return (
    <header className="h-16 px-4 sm:px-6 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-2xl flex items-center justify-between gap-4 sticky top-0 z-30 shadow-[inset_0_-1px_0_rgba(255,255,255,0.03)]">
      {/* Zone 1: Mobile Hamburger + Breadcrumb & Truthful Status */}
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMobileNav && (
          <button
            onClick={onOpenMobileNav}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800 cursor-pointer"
            aria-label="Open navigation sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2.5 truncate">
          <h1 className="text-sm font-semibold text-white tracking-tight truncate">
            {activeViewTitle}
          </h1>
          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">/</span>
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium text-[11px]">
              Simulated Paper Mode
            </span>
            <span className="text-slate-500 font-mono text-[11px]">
              {feedLatencyMs}ms (Local Sim)
            </span>
          </div>
        </div>
      </div>

      {/* Zone 2: Account Telemetry (Tabular Numerals, Human-Readable Labels) */}
      <div className="hidden xl:flex items-center gap-6 text-xs">
        <div>
          <span className="text-xs text-slate-400 block font-normal">Paper Equity</span>
          <span className="font-mono tabular-nums font-semibold text-slate-100">
            ${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="w-px h-6 bg-slate-800/80" aria-hidden="true" />

        <div>
          <span className="text-xs text-slate-400 block font-normal">Free Margin</span>
          <span className="font-mono tabular-nums font-semibold text-emerald-400">
            ${account.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="w-px h-6 bg-slate-800/80" aria-hidden="true" />

        <div>
          <span className="text-xs text-slate-400 block font-normal">Daily Drawdown</span>
          <span
            className={`font-mono tabular-nums font-semibold ${
              riskStatus.todayDrawdownPercent >= 1.0 ? 'text-rose-400 font-bold' : 'text-slate-200'
            }`}
          >
            {riskStatus.todayDrawdownPercent.toFixed(2)}% <span className="text-slate-500 text-[11px]">/ 1.00% max</span>
          </span>
        </div>

        <div className="w-px h-6 bg-slate-800/80" aria-hidden="true" />

        <div>
          <span className="text-xs text-slate-400 block font-normal">Trades Today</span>
          <span
            className={`font-mono tabular-nums font-semibold ${
              riskStatus.todayTradesCount >= 8 ? 'text-rose-400 font-bold' : 'text-slate-200'
            }`}
          >
            {riskStatus.todayTradesCount} <span className="text-slate-500 text-[11px]">/ 8 cap</span>
          </span>
        </div>
      </div>

      {/* Zone 3: Execution Actions (Entry Pause & Emergency Halt) */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={onTogglePause}
          disabled={riskStatus.killSwitchTriggered}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
            riskStatus.isTradingPaused
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
              : 'bg-slate-800/70 text-slate-300 border-slate-700/80 hover:bg-slate-700/70 hover:text-white'
          }`}
          title="Pause or resume automated strategy signals"
        >
          {riskStatus.isTradingPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">
            {riskStatus.isTradingPaused ? 'Resume Entries' : 'Pause Entries'}
          </span>
        </button>

        <button
          onClick={onTriggerKillSwitch}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ${
            riskStatus.killSwitchTriggered
              ? 'bg-red-700 text-white ring-2 ring-red-400/80'
              : 'bg-red-600 hover:bg-red-500 text-white active:scale-95'
          }`}
          title="Immediately halt all automated trading"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Emergency Halt</span>
        </button>
      </div>
    </header>
  );
};
