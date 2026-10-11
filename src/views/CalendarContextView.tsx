import React from 'react';
import { Calendar, AlertTriangle, Clock, ShieldAlert, CheckCircle2, Info } from 'lucide-react';
import { EconomicEvent } from '../types/trading';

interface CalendarContextViewProps {
  events: EconomicEvent[];
}

export const CalendarContextView: React.FC<CalendarContextViewProps> = ({ events }) => {
  const now = Date.now();

  return (
    <div className="space-y-6">
      {/* Calendar Header & Truthful Disclaimer */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-800/80">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h2 className="text-xs font-semibold text-white">
            Macroeconomic Calendar & Volatility Blackout Engine
          </h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-3">
          The risk engine enforces an automated 30-minute pre-release and 15-minute post-release blackout around high-impact macroeconomic announcements to protect against abnormal spread widening, extreme slippage, and liquidity gaps.
        </p>

        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-400 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            <strong className="text-slate-300">Data Source Disclosure:</strong> Events below are seeded as synthetic test scenarios to verify automated pre-event blackouts. In a live deployment, this connects to an authenticated financial calendar API (e.g. ForexFactory, Econoday).
          </span>
        </div>
      </div>

      {/* Events List */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] font-mono text-xs">
        <h3 className="text-xs font-semibold text-white mb-4 pb-3 border-b border-slate-800/80 font-sans">
          Scheduled Macroeconomic Scenarios & Blackout Triggers
        </h3>

        <div className="space-y-3">
          {events.map(event => {
            const minutesUntil = Math.round((event.scheduledTime - now) / 60000);
            const isBlackoutTriggered = event.impact === 'HIGH' && minutesUntil > 0 && minutesUntil <= 45;

            return (
              <div
                key={event.id}
                className={`p-4 rounded-xl border transition-all backdrop-blur-xl ${
                  isBlackoutTriggered
                    ? 'border-rose-500/40 bg-rose-950/20 ring-1 ring-rose-500/30'
                    : 'border-slate-800/80 bg-slate-950/50'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-semibold font-mono text-xs">
                      {event.currency}
                    </span>
                    <span className="font-semibold text-white text-xs font-sans">{event.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium ${
                        event.impact === 'HIGH'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : event.impact === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {event.impact} Impact
                    </span>

                    {isBlackoutTriggered && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-sans font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Blackout Active
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-slate-400 text-xs">
                  <div className="flex items-center gap-4">
                    <span>Forecast: <strong className="text-white font-medium">{event.forecast || '—'}</strong></span>
                    <span>Previous: <strong className="text-white font-medium">{event.previous || '—'}</strong></span>
                    <span>Actual: <strong className="text-slate-300 font-medium">{event.actual || 'Awaiting'}</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {minutesUntil > 0 ? `Scheduled in ${minutesUntil}m` : `Released ${Math.abs(minutesUntil)}m ago`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
