import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Brain,
  Briefcase,
  ShieldCheck,
  FlaskConical,
  Eye,
  Calendar,
  FileText,
  Settings,
  Download,
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
  | 'settings'
  | 'releases';

interface NavigationSidebarProps {
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  operatingMode: OperatingMode;
  riskStatus: RiskStatus;
  openPositionsCount: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeTab,
  onSelectTab,
  operatingMode,
  riskStatus,
  openPositionsCount,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const navItems: {
    id: ActiveNavTab;
    label: string;
    section?: string;
    icon: React.FC<{ className?: string }>;
    badge?: string | number;
    badgeVariant?: 'neutral' | 'caution' | 'accent';
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'markets', label: 'Markets & Telemetry', icon: TrendingUp },
    { id: 'strategies', label: 'Strategies & Signals', icon: Brain },
    {
      id: 'portfolio',
      label: 'Portfolio & Ledger',
      icon: Briefcase,
      badge: openPositionsCount > 0 ? openPositionsCount : undefined,
      badgeVariant: 'accent'
    },
    {
      id: 'risk',
      label: 'Risk Center',
      icon: ShieldCheck,
      badge: riskStatus.isCooldownActive ? 'Lockout' : undefined,
      badgeVariant: 'caution'
    },
    { id: 'shadow', label: 'Shadow & MT5 Gateway', icon: Eye },
    { id: 'calendar', label: 'Macro Blackouts', icon: Calendar },
    { id: 'research', label: 'Research & Backtests', icon: FlaskConical },
    { id: 'audit', label: 'System & Health Audit', icon: FileText },
    { id: 'settings', label: 'Bridge Connections', icon: Settings },
    { id: 'releases', label: 'App Install & Packages', icon: Download }
  ];

  const handleSelect = (id: ActiveNavTab) => {
    onSelectTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const content = (
    <div className="h-full flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
              <span className="font-mono text-xs tracking-wider">UA</span>
            </div>
            <div>
              <div className="font-semibold text-sm tracking-tight text-white">Ultimate AI Trading</div>
              <div className="text-xs text-slate-400 font-mono">Disciplined Risk Engine</div>
            </div>
          </div>

          {/* Close button for mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <nav className="p-3 space-y-1">
          <div className="px-3 pt-2 pb-1.5 text-[11px] font-medium text-slate-400">
            Platform Navigation
          </div>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-300 font-semibold border border-blue-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-medium ${
                      item.badgeVariant === 'caution'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : item.badgeVariant === 'accent'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer Card */}
      <div className="p-4 m-3 rounded-xl border border-slate-800/80 bg-slate-950/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] text-xs font-mono space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Environment:</span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
            operatingMode === 'live'
              ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
              : operatingMode === 'demo'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
          }`}>
            {operatingMode === 'live' ? 'Live Execution' : operatingMode === 'demo' ? 'XM MT5 Demo' : 'Simulated Paper'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">MT5 Bridge:</span>
          <span className="text-amber-400 text-[11px]">
            Disconnected (Offline)
          </span>
        </div>

        <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 leading-snug">
          Rule 1 Enforced: Synthetic simulated feed. Real broker execution strictly blocked.
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900/60 border-r border-slate-800/80 flex-col shrink-0 backdrop-blur-2xl">
        {content}
      </aside>

      {/* Mobile Slide-over Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 w-72 bg-slate-900/95 border-r border-slate-800 shadow-2xl backdrop-blur-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200">
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
