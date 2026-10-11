import React from 'react';
import {
  ShieldAlert,
  Pause,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Lock,
  Menu
} from 'lucide-react';
import { AccountState, OperatingMode, RiskLimits, RiskStatus } from '../types/trading';

interface TopBarProps {
  activeViewTitle: string;
  operatingMode: OperatingMode;
  account: AccountState;
  riskStatus: RiskStatus;
  riskLimits: RiskLimits;
  isNavigationOpen: boolean;
  onToggleNavigation: () => void;
  feedLatencyMs: number;
  onTriggerKillSwitch: () => void;
  onOpenModeSelector: () => void;
  onTogglePause: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeViewTitle,
  operatingMode,
  account,
  riskStatus,
  riskLimits,
  isNavigationOpen,
  onToggleNavigation,
  feedLatencyMs,
  onTriggerKillSwitch,
  onOpenModeSelector,
  onTogglePause
}) => {
  const modePresentation = {
    simulated: { label: 'Paper simulation', detail: `Synthetic delay (${feedLatencyMs}ms)`, className: 'text-amber-400' },
    read_only: { label: 'Read-only', detail: 'Synthetic data · orders blocked', className: 'text-sky-400' },
    demo_pending: { label: 'Demo execution blocked', detail: 'Strategy and recovery integration incomplete', className: 'text-amber-400' },
    disconnected: { label: 'Disconnected', detail: 'Data stream stopped', className: 'text-slate-400' }
  }[operatingMode];

  return (
    <header className="min-h-16 h-auto px-3 sm:px-6 py-2 border-b border-slate-800/80 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
      {/* Zone 1: View Breadcrumb & Truthful Status */}
      <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:gap-3 xl:basis-auto">
        <button
          type="button"
          onClick={onToggleNavigation}
          aria-label={isNavigationOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isNavigationOpen}
          aria-controls="primary-navigation"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 lg:hidden"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
        <h1 className="truncate text-sm font-semibold text-white tracking-tight">{activeViewTitle}</h1>
        <span className="text-slate-600 text-xs" aria-hidden="true">/</span>
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 text-xs text-slate-400">
          <button
            type="button"
            onClick={onOpenModeSelector}
            aria-haspopup="dialog"
            className={`whitespace-nowrap font-semibold tracking-wide text-[11px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${modePresentation.className}`}
            title="Change operating mode"
          >
            {modePresentation.label}
          </button>
          <span className="hidden text-slate-600 sm:inline" aria-hidden="true">·</span>
          <span className="hidden whitespace-nowrap text-slate-400 text-xs font-mono sm:inline">{modePresentation.detail}</span>
        </div>
      </div>

      {/* Zone 2: Account Telemetry Quick Summary */}
      <div className="hidden 2xl:flex items-center gap-5 text-xs">
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
          <span className={`font-mono font-medium ${riskStatus.todayDrawdownPercent >= riskLimits.dailyLossLimitPercent ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
            {riskStatus.todayDrawdownPercent.toFixed(2)}% / {riskLimits.dailyLossLimitPercent.toFixed(2)}% Max
          </span>
        </div>
        <div className="w-px h-5 bg-slate-800" aria-hidden="true" />
        <div>
          <span className="text-[11px] text-slate-400 block font-normal">Today's Trades</span>
          <span className={`font-mono font-medium ${riskStatus.todayTradesCount >= riskLimits.maxDailyTrades ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
            {riskStatus.todayTradesCount} / {riskLimits.maxDailyTrades} Max
          </span>
        </div>
      </div>

      {/* Zone 3: Actions (Pause & Emergency Kill Switch) */}
      <div className="flex basis-full shrink-0 items-center justify-end gap-2 sm:gap-2.5 xl:basis-auto">
        <button
          onClick={onTogglePause}
          disabled={riskStatus.killSwitchTriggered}
          aria-label={riskStatus.isTradingPaused ? 'Resume entries' : 'Pause entries'}
          className={`flex min-h-10 items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${
            riskStatus.isTradingPaused
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
          }`}
          title="Pause or resume automated strategy signals"
        >
          {riskStatus.isTradingPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{riskStatus.isTradingPaused ? 'Resume Entries' : 'Pause Entries'}</span>
        </button>

        <button
          onClick={onTriggerKillSwitch}
          aria-label="Emergency halt"
          className={`flex min-h-10 items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-300 ${
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
