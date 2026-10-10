import React from 'react';
import { X, Calendar, AlertTriangle, Clock, ShieldAlert, CheckCircle } from 'lucide-react';
import { EconomicEvent } from '../types/trading';

interface EconomicCalendarModalProps {
  isOpen: boolean;
  events: EconomicEvent[];
  onClose: () => void;
}

export const EconomicCalendarModal: React.FC<EconomicCalendarModalProps> = ({
  isOpen,
  events,
  onClose
}) => {
  if (!isOpen) return null;

  const now = Date.now();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">Economic Calendar & Volatility Blackouts (Stage 11)</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          The system strictly enforces a 30-minute pre-release and 15-minute post-release blackout around Tier-1 macroeconomic events to prevent slippage and abnormal spread blowouts.
        </p>

        {/* Events Table */}
        <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1 mb-5">
          {events.map(event => {
            const minutesUntil = Math.round((event.scheduledTime - now) / 60000);
            const isBlackoutTriggered = event.impact === 'HIGH' && minutesUntil > 0 && minutesUntil <= 45;

            return (
              <div
                key={event.id}
                className={`p-3 rounded-lg border transition-all ${
                  isBlackoutTriggered
                    ? 'border-rose-500/50 bg-rose-950/20 ring-1 ring-rose-500/40'
                    : 'border-slate-800 bg-slate-950/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs font-bold">
                      {event.currency}
                    </span>
                    <span className="text-xs font-semibold text-white">{event.title}</span>
                  </div>

                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                    event.impact === 'HIGH'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : event.impact === 'MEDIUM'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {event.impact} IMPACT
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2">
                  <div className="flex items-center gap-3">
                    <span>Forecast: <span className="text-slate-200">{event.forecast || '—'}</span></span>
                    <span>Prior: <span className="text-slate-200">{event.previous || '—'}</span></span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className={isBlackoutTriggered ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                      {minutesUntil > 0 ? `In ~${minutesUntil} minutes` : 'Released'}
                    </span>
                  </div>
                </div>

                {isBlackoutTriggered && (
                  <div className="mt-2 text-[10px] text-rose-300 flex items-center gap-1 font-mono pt-1.5 border-t border-rose-500/20">
                    <ShieldAlert className="w-3 h-3 shrink-0" />
                    <span>Active Blackout: Automated strategy entries blocked for {event.currency} pairs.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-500"
          >
            Close Calendar
          </button>
        </div>
      </div>
    </div>
  );
};
