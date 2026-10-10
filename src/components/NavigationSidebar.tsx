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
  AlertTriangle
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
  operatingMode: OperatingMode;
  riskStatus: RiskStatus;
  openPositionsCount: number;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeTab,
  onSelectTab,
  operatingMode,
  riskStatus,
  openPositionsCount
}) => {
  const navItems: { id: ActiveNavTab; label: string; icon: React.FC<{ className?: string }>; badge?: string | number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'markets', label: 'Markets & Telemetry', icon: TrendingUp },
    { id: 'strategies', label: 'Strategies & Signals', icon: Brain },
    { id: 'portfolio', label: 'Portfolio & Orders', icon: Briefcase, badge: openPositionsCount > 0 ? openPositionsCount : undefined },
    { id: 'risk', label: 'Risk Center', icon: ShieldCheck, badge: riskStatus.isCooldownActive ? 'LOCK' : undefined },
    { id: 'research', label: 'Research & Hypotheses', icon: FlaskConical },
    { id: 'shadow', label: 'Shadow & MT5 Gateway', icon: Eye },
    { id: 'calendar', label: 'Macro Blackout Calendar', icon: Calendar },
    { id: 'audit', label: 'Audit & Checkpoints', icon: FileText },
    { id: 'settings', label: 'Connections & Settings', icon: Settings }
  ];

  return (
    <aside className="w-64 bg-slate-900/90 border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none backdrop-blur-md">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
            <span className="font-mono text-sm tracking-wider">UA</span>
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-white leading-none">Ultimate AI Trading</div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">Disciplined Risk Engine</div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
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
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
            PAPER SIMULATION
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">MT5 BRIDGE:</span>
          <span className="text-slate-400 text-[10px]">
            DISCONNECTED
          </span>
        </div>

        <div className="pt-1 border-t border-slate-800/60 text-[10px] text-slate-400 leading-tight">
          Live execution disabled by design per Rule 1. Zero real capital at risk.
        </div>
      </div>
    </aside>
  );
};
