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
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">
            Synthetic Economic-Event Scenarios
          </h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-3">
          The local risk gate blocks relevant high-impact event currencies for 30 minutes before and 15 minutes after the scheduled time. The event list below is synthetic and not a live economic calendar.
        </p>

        <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span>
            <strong>Data source:</strong> These are seeded test scenarios. No live economic-calendar provider is connected, so blackout checks only cover these synthetic events.
          </span>
        </div>
      </div>

      {/* Events List */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-xs">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 pb-2 border-b border-slate-800 font-sans">
          Scheduled Macroeconomic Scenarios & Blackout Triggers
        </h3>

        <div className="space-y-3">
          {events.map(event => {
            const minutesUntil = Math.round((event.scheduledTime - now) / 60000);
            const isBlackoutTriggered = event.impact === 'HIGH'
              && ((minutesUntil > 0 && minutesUntil <= 30) || (minutesUntil <= 0 && minutesUntil >= -15));

            return (
              <div
                key={event.id}
                className={`p-4 rounded-xl border transition-all ${
                  isBlackoutTriggered
                    ? 'border-rose-500/50 bg-rose-950/20 ring-1 ring-rose-500/40'
                    : 'border-slate-800 bg-slate-950/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-bold">
                      {event.currency}
                    </span>
                    <span className="font-semibold text-white text-xs">{event.title}</span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    event.impact === 'HIGH'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : event.impact === 'MEDIUM'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {event.impact} IMPACT
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-4">
                    <span>Forecast: <strong className="text-white">{event.forecast || '—'}</strong></span>
                    <span>Previous: <strong className="text-white">{event.previous || '—'}</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5 font-bold">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className={isBlackoutTriggered ? 'text-rose-400' : 'text-slate-300'}>
                      {minutesUntil > 0 ? `In ~${minutesUntil} minutes` : 'Released'}
                    </span>
                  </div>
                </div>

                {isBlackoutTriggered && (
                  <div className="mt-2 text-[10px] text-rose-300 flex items-center gap-1.5 font-sans pt-2 border-t border-rose-500/20">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Active blackout: proposals involving {event.currency} are blocked in paper mode.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
