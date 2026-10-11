import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Globe,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Radio
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
      {/* Ticker Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {quotes.map(q => {
          const isSelected = q.symbol === selectedSymbol;
          const isPositive = q.change24hPercent >= 0;

          return (
            <button
              key={q.symbol}
              onClick={() => onSelectSymbol(q.symbol)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-blue-500 bg-blue-950/25 ring-1 ring-blue-500/40 shadow-sm'
                  : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-white tracking-wide">{q.symbol}</span>
                <span className={`text-[11px] font-mono font-medium flex items-center gap-0.5 ${
                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {isPositive ? '+' : ''}{q.change24hPercent}%
                </span>
              </div>
              <div className="text-sm font-mono font-bold text-slate-100">
                {formatPrice(q.last, q.digits)}
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px] font-mono">
                <span className="text-slate-400">Spr: {q.spreadPips.toFixed(1)}p</span>
                {q.isStale ? (
                  <span className="text-[9px] px-1 rounded bg-rose-950 text-rose-200">
                    {q.latencyMs}ms {q.freshness === 'broker' ? 'XM' : 'sim'}
                  </span>
                ) : (
                  <span className="text-[9px] px-1 rounded text-slate-400">
                    {q.latencyMs}ms {q.freshness === 'broker' ? 'XM' : 'sim'}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Market Regime & Environmental Condition Card (Stage 6 & 11) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Market Regime & Environmental Evidence — {selectedSymbol}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Simulation testing tool: degrade data to verify Stage 3 safety */}
            <button
              onClick={onToggleDataDegradation}
              className={`text-[10px] font-medium px-2 py-1 rounded border transition-colors cursor-pointer ${
                isDegraded
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Simulates abnormal spread blowout and latency delay to verify Stage 3 risk rejection"
            >
              <Radio className="w-3 h-3 inline mr-1" />
              {isDegraded ? 'Stale Feed Active (Test Mode)' : 'Simulate Feed Degradation'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          {/* Trend Direction */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              {regime.trendDirection === 'BULLISH' ? (
                <TrendingUp className="w-3 h-3 text-emerald-400" />
              ) : regime.trendDirection === 'BEARISH' ? (
                <TrendingDown className="w-3 h-3 text-rose-400" />
              ) : (
                <Activity className="w-3 h-3 text-amber-400" />
              )}
              <span>Trend Regime</span>
            </div>
            <div className={`font-bold font-mono ${
              regime.trendDirection === 'BULLISH'
                ? 'text-emerald-400'
                : regime.trendDirection === 'BEARISH'
                ? 'text-rose-400'
                : 'text-amber-400'
            }`}>
              {regime.trendDirection}
            </div>
          </div>

          {/* ADX Strength */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              ADX Strength
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-bold font-mono text-slate-200">{regime.trendStrengthAdx}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {regime.trendStrengthAdx > 25 ? 'Strong Trend' : 'Ranging'}
              </span>
            </div>
          </div>

          {/* Volatility ATR */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              ATR Volatility
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-bold font-mono text-slate-200">{regime.volatilityAtr}</span>
              <span className={`text-[10px] font-mono px-1 rounded ${
                regime.volatilityRegime === 'EXTREME'
                  ? 'bg-rose-500/20 text-rose-400'
                  : regime.volatilityRegime === 'HIGH'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {regime.volatilityRegime}
              </span>
            </div>
          </div>

          {/* Session Name */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Active Session</span>
            </div>
            <div className={`font-bold font-mono ${
              regime.sessionName === 'WEEKEND_CLOSED' ? 'text-rose-400' : 'text-slate-200'
            }`}>
              {regime.sessionName}
            </div>
          </div>

          {/* Spread Condition */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              Spread Integrity
            </div>
            <div className={`font-bold font-mono ${
              regime.spreadCondition === 'BLOWOUT'
                ? 'text-rose-400'
                : regime.spreadCondition === 'ELEVATED'
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}>
              {regime.spreadCondition}
            </div>
          </div>

          {/* Macro Event Risk */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-slate-400" />
              <span>Macro News Risk</span>
            </div>
            <div className={`font-bold font-mono ${
              regime.scheduledEventRisk === 'HIGH_IMPACT_APPROACHING'
                ? 'text-rose-400'
                : 'text-emerald-400'
            }`}>
              {regime.scheduledEventRisk === 'HIGH_IMPACT_APPROACHING'
                ? `EVENT IN ~${regime.nextEventMinutesAway}M`
                : 'CLEAR'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
