import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Brain,
  Briefcase,
  ShieldAlert,
  FlaskConical,
  Eye,
  Calendar,
  FileText,
  Settings,
  ShieldCheck,
  AlertTriangle,
  X
} from 'lucide-react';
import { OperatingMode, RiskStatus } from '../types/trading';

export type ActiveNavTab =
  | 'overview'
  | 'markets'
  | 'strategies'
  | 'portfolio'
  | 'risk'
  | 'research'
  | 'shadow'
  | 'calendar'
  | 'audit'
  | 'settings';

interface NavigationSidebarProps {
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  isOpen: boolean;
  onClose: () => void;
  operatingMode: OperatingMode;
  riskStatus: RiskStatus;
  openPositionsCount: number;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpen,
  onClose,
  operatingMode,
  riskStatus,
  openPositionsCount
}) => {
  const operatingState = {
    simulated: { label: 'SIMULATED', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', detail: 'Local paper simulation only. No broker data or orders are connected.' },
    read_only: { label: 'READ-ONLY', className: 'bg-sky-500/10 text-sky-400 border-sky-500/20', detail: 'Synthetic local data only. New order entries are blocked.' },
    demo_pending: { label: 'MANUAL DEMO TICKET · GATED', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20', detail: 'Windows manual order ticket only; strategies are not routed and live orders remain locked.' },
    disconnected: { label: 'DISCONNECTED', className: 'bg-slate-700/50 text-slate-300 border-slate-600/50', detail: 'Synthetic stream stopped. New order entries are blocked.' }
  }[operatingMode];

  const navItems: { id: ActiveNavTab; label: string; icon: React.FC<{ className?: string }>; badge?: string | number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'markets', label: 'Markets & Synthetic Data', icon: TrendingUp },
    { id: 'strategies', label: 'Strategies & Signals', icon: Brain },
    { id: 'portfolio', label: 'Portfolio & Orders', icon: Briefcase, badge: openPositionsCount > 0 ? openPositionsCount : undefined },
    { id: 'risk', label: 'Risk Center', icon: ShieldCheck, badge: riskStatus.isCooldownActive ? 'LOCK' : undefined },
    { id: 'research', label: 'Research & Hypotheses', icon: FlaskConical },
    { id: 'shadow', label: 'Broker Integration Status', icon: Eye },
    { id: 'calendar', label: 'Macro Blackout Calendar', icon: Calendar },
    { id: 'audit', label: 'Audit & Checkpoints', icon: FileText },
    { id: 'settings', label: 'Connections & Settings', icon: Settings }
  ];

  return (
    <>
      {isOpen && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden"
        />
      )}
      <aside
        id="primary-navigation"
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[calc(100vw-2rem)] shrink-0 select-none flex-col justify-between border-r border-slate-800/80 bg-slate-900 lg:sticky lg:top-0 lg:z-20 lg:w-64 lg:max-w-none lg:translate-x-0 lg:backdrop-blur-md transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      <div>
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
            <span className="font-mono text-sm tracking-wider">UA</span>
          </div>
          <div>
            <div className="whitespace-nowrap font-bold text-sm tracking-tight text-white leading-none">Ultimate AI Trading</div>
            <div className="hidden text-[11px] text-slate-400 font-mono mt-1 lg:block">Disciplined Risk Engine</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 lg:hidden"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Primary navigation" className="p-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-300 font-semibold border border-blue-500/30 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    item.badge === 'LOCK'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status Card in Sidebar Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-xs font-mono space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">OPERATING STATE:</span>
          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${operatingState.className}`}>
            {operatingState.label}
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">BROKER ADAPTER:</span>
          <span className="text-slate-400 text-[10px]">
            MANUAL DEMO · WINDOWS
          </span>
        </div>

        <div className="pt-1 border-t border-slate-800/60 text-[10px] text-slate-400 leading-tight">
          {operatingState.detail}
        </div>
      </div>
      </aside>
    </>
  );
};
