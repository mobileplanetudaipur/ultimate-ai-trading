import React from 'react';
import {
  ShieldAlert,
  Pause,
  Play,
  RotateCcw,
  Activity,
  AlertTriangle,
  Radio,
  FileText,
  Calendar,
  BarChart3,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { AccountState, FeedFreshness, OperatingMode, RiskStatus } from '../types/trading';

interface HeaderProps {
  operatingMode: OperatingMode;
  account: AccountState;
  riskStatus: RiskStatus;
  feedFreshness: FeedFreshness;
  feedLatencyMs: number;
  onOpenModeSelector: () => void;
  onOpenReconciliation: () => void;
  onOpenMetrics: () => void;
  onOpenCalendar: () => void;
  onOpenAuditLogs: () => void;
  onTriggerKillSwitch: () => void;
  onTogglePause: () => void;
  onSaveCheckpoint: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  operatingMode,
  account,
  riskStatus,
  feedFreshness,
  feedLatencyMs,
  onOpenModeSelector,
  onOpenReconciliation,
  onOpenMetrics,
  onOpenCalendar,
  onOpenAuditLogs,
  onTriggerKillSwitch,
  onTogglePause,
  onSaveCheckpoint
}) => {
  const getModeBadge = () => {
    switch (operatingMode) {
      case 'demo_pending':
        return { label: 'MANUAL DEMO TICKET · LOCKED BY DEFAULT', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40', dot: 'bg-amber-500' };
      case 'simulated':
        return { label: 'LOCAL PAPER ENGINE', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', dot: 'bg-emerald-500' };
      case 'read_only':
        return { label: 'READ ONLY', bg: 'bg-sky-500/20 text-sky-400 border-sky-500/40', dot: 'bg-sky-500' };
      case 'disconnected':
      default:
        return { label: 'DISCONNECTED', bg: 'bg-slate-500/20 text-slate-400 border-slate-500/40', dot: 'bg-slate-500' };
    }
  };

  const getFeedBadge = () => {
    switch (feedFreshness) {
      case 'stale':
        return { label: 'STALE DATA', color: 'text-rose-400' };
      case 'unavailable':
        return { label: 'FEED OFFLINE', color: 'text-red-500' };
      case 'simulated':
      default:
        return { label: 'SYNTHETIC FEED (SIM)', color: 'text-amber-400' };
    }
  };

  const modeBadge = getModeBadge();
  const feedBadge = getFeedBadge();

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 sticky top-0 z-40 backdrop-blur-md">
      {/* Top Banner Warning if Kill Switch or Cooldown is active */}
      {riskStatus.killSwitchTriggered && (
        <div className="bg-red-600 px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-white flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          EMERGENCY KILL SWITCH TRIGGERED — ALL AUTOMATED ENTRIES ARE STRICTLY HALTED
        </div>
      )}
      {riskStatus.isCooldownActive && !riskStatus.killSwitchTriggered && (
        <div className="bg-amber-600 px-4 py-1.5 text-center text-xs font-semibold tracking-wide text-white flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          STAGE 9 SAFEGUARD: 5 Consecutive Losses Reached — 30-Minute Lockout Window Active
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Mode Tag */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">Ultimate AI Trading</span>
              <button
                onClick={onOpenModeSelector}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${modeBadge.bg} transition-all hover:brightness-125 cursor-pointer`}
                title="Click to change operating mode"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${modeBadge.dot}`} />
                {modeBadge.label}
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-slate-500" />
                <span className={feedBadge.color}>{feedBadge.label}</span>
                <span className="text-slate-500 font-mono">(simulated {feedLatencyMs}ms)</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 text-[11px]">Strict Risk Engine Active</span>
            </div>
          </div>
        </div>

        {/* Account Summary Metrics */}
        <div className="hidden lg:flex items-center gap-4 border border-slate-800 rounded-lg px-3 py-1.5 bg-slate-950/60 font-mono text-xs">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Equity</div>
            <div className="text-sm font-semibold text-slate-100">${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="w-px h-6 bg-slate-800" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Balance</div>
            <div className="text-xs text-slate-300">${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="w-px h-6 bg-slate-800" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Margin Used</div>
            <div className="text-xs text-slate-300">${account.marginUsed.toFixed(2)}</div>
          </div>
          <div className="w-px h-6 bg-slate-800" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Free Margin</div>
            <div className="text-xs text-emerald-400 font-semibold">${account.freeMargin.toFixed(2)}</div>
          </div>
          <div className="w-px h-6 bg-slate-800" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Margin Level</div>
            <div className="text-xs text-slate-300">{account.marginLevelPercent > 5000 ? '>5000%' : `${account.marginLevelPercent}%`}</div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Pause / Resume Button */}
          <button
            onClick={onTogglePause}
            disabled={riskStatus.killSwitchTriggered}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
              riskStatus.isTradingPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Pause or resume automated strategy signals"
          >
            {riskStatus.isTradingPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{riskStatus.isTradingPaused ? 'Resume' : 'Pause Entries'}</span>
          </button>

          {/* Quick Tools */}
          <button
            onClick={onOpenReconciliation}
            className={`p-1.5 rounded-md border text-xs transition-colors cursor-pointer ${
              account.reconciliationStatus === 'DISCREPANCY_DETECTED'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Broker State Reconciliation (Stage 4)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenMetrics}
            className="p-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
            title="Execution Quality & Health Metrics (Stage 12)"
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenCalendar}
            className="p-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
            title="Economic Calendar Blackout Watcher (Stage 11)"
          >
            <Calendar className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenAuditLogs}
            className="p-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
            title="Tamper-evident Audit Trail (Stage 14)"
          >
            <FileText className="w-4 h-4" />
          </button>

          {/* Save Checkpoint */}
          <button
            onClick={onSaveCheckpoint}
            className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs font-medium cursor-pointer"
            title="Durable Checkpoint Save (Stage 13)"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Checkpoint</span>
          </button>

          {/* Emergency Kill Switch Button */}
          <button
            onClick={onTriggerKillSwitch}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              riskStatus.killSwitchTriggered
                ? 'bg-red-700 text-white ring-2 ring-red-400'
                : 'bg-red-600/90 hover:bg-red-600 text-white hover:shadow-lg hover:shadow-red-950/50'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Kill Switch</span>
          </button>
        </div>
      </div>
    </header>
  );
};
