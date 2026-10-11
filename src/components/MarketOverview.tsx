import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  AlertTriangle,
  Radio,
  Sliders
} from 'lucide-react';
import { FeedFreshness, MarketQuote, MarketRegime } from '../types/trading';
import { formatPrice } from '../utils/indicators';

interface MarketOverviewProps {
  quotes: MarketQuote[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  regime: MarketRegime;
  feedFreshness: FeedFreshness;
  onToggleDataDegradation: () => void;
  isDegraded: boolean;
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({
  quotes,
  selectedSymbol,
  onSelectSymbol,
  regime,
  feedFreshness,
  onToggleDataDegradation,
  isDegraded
}) => {
  return (
    <div className="space-y-4">
      {/* Ticker Selector Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {quotes.map(q => {
          const isSelected = q.symbol === selectedSymbol;
          const isPositive = q.change24hPercent >= 0;

          return (
            <button
              key={q.symbol}
              onClick={() => onSelectSymbol(q.symbol)}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer backdrop-blur-xl ${
                isSelected
                  ? 'border-blue-500/50 bg-blue-950/25 ring-1 ring-blue-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-xs text-white tracking-tight">{q.symbol}</span>
                <span
                  className={`text-xs font-mono font-medium tabular-nums ${
                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isPositive ? '+' : ''}{q.change24hPercent.toFixed(2)}%
                </span>
              </div>
              <div className="text-base font-mono tabular-nums font-semibold text-slate-100">
                {formatPrice(q.last, q.digits)}
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px] font-mono text-slate-400">
                <span>Spread: {q.spreadPips.toFixed(1)}p</span>
                <span
                  className={`px-1.5 py-0.5 rounded ${
                    q.isStale ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400'
                  }`}
                >
                  {q.latencyMs}ms
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Market Regime & Telemetry Card */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-semibold text-white">
              Market Regime & Environmental Evidence — {selectedSymbol}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleDataDegradation}
              className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                isDegraded
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-200'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700/80'
              }`}
              title="Simulates abnormal spread blowout and latency delay to test risk rejection"
            >
              <Radio className="w-3.5 h-3.5 text-slate-400" />
              <span>{isDegraded ? 'Stale Feed Active (Test)' : 'Simulate Feed Degradation'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Trend Direction */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
              {regime.trendDirection === 'BULLISH' ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              ) : regime.trendDirection === 'BEARISH' ? (
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Activity className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>Trend direction</span>
            </div>
            <div
              className={`font-semibold font-mono ${
                regime.trendDirection === 'BULLISH'
                  ? 'text-emerald-400'
                  : regime.trendDirection === 'BEARISH'
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }`}
            >
              {regime.trendDirection}
            </div>
          </div>

          {/* ADX Strength */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-xs text-slate-400 mb-1">
              ADX strength
            </div>
            <div className="flex items-baseline justify-between font-mono">
              <span className="font-semibold text-slate-100 tabular-nums">{regime.trendStrengthAdx}</span>
              <span className="text-[11px] text-slate-400">
                {regime.trendStrengthAdx > 25 ? 'Trending' : 'Ranging'}
              </span>
            </div>
          </div>

          {/* Volatility ATR */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-xs text-slate-400 mb-1">
              ATR volatility
            </div>
            <div className="flex items-baseline justify-between font-mono">
              <span className="font-semibold text-slate-100 tabular-nums">{regime.volatilityAtr}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded ${
                  regime.volatilityRegime === 'EXTREME'
                    ? 'bg-rose-500/20 text-rose-300'
                    : regime.volatilityRegime === 'HIGH'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {regime.volatilityRegime}
              </span>
            </div>
          </div>

          {/* Session Name */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Active session</span>
            </div>
            <div
              className={`font-semibold font-mono ${
                regime.sessionName === 'WEEKEND_CLOSED' ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {regime.sessionName}
            </div>
          </div>

          {/* Spread Condition */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-xs text-slate-400 mb-1">
              Spread integrity
            </div>
            <div
              className={`font-semibold font-mono ${
                regime.spreadCondition === 'BLOWOUT'
                  ? 'text-rose-400'
                  : regime.spreadCondition === 'ELEVATED'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {regime.spreadCondition}
            </div>
          </div>

          {/* Macro Event Risk */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
              <span>Macro news risk</span>
            </div>
            <div
              className={`font-semibold font-mono text-[11px] ${
                regime.scheduledEventRisk === 'HIGH_IMPACT_APPROACHING'
                  ? 'text-rose-400'
                  : 'text-emerald-400'
              }`}
            >
              {regime.scheduledEventRisk === 'HIGH_IMPACT_APPROACHING'
                ? `Event in ~${regime.nextEventMinutesAway}m`
                : 'Clear'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
