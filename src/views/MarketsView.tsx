import React from 'react';
import { MarketQuote, Candle, PositionRecord, MarketRegime, FeedFreshness } from '../types/trading';
import { MarketChart } from '../components/MarketChart';
import { MarketOverview } from '../components/MarketOverview';
import { brokerGateway } from '../services/brokerGateway';
import { ShieldCheck, Info } from 'lucide-react';

interface MarketsViewProps {
  quotes: MarketQuote[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  candles: Candle[];
  positions: PositionRecord[];
  regime: MarketRegime;
  feedFreshness: FeedFreshness;
  onToggleDataDegradation: () => void;
  isDegraded: boolean;
}

export const MarketsView: React.FC<MarketsViewProps> = ({
  quotes,
  selectedSymbol,
  onSelectSymbol,
  candles,
  positions,
  regime,
  feedFreshness,
  onToggleDataDegradation,
  isDegraded
}) => {
  const activeQuote = quotes.find(q => q.symbol === selectedSymbol) || quotes[0];
  const spec = brokerGateway.getInstrumentSpec(selectedSymbol);

  return (
    <div className="space-y-6">
      {/* Telemetry Provenance Banner */}
      <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">Market Telemetry Source:</span>
            <span className="text-slate-300 font-mono">
              {activeQuote.provider} (Local deterministic ticks)
            </span>
          </div>
        </div>
        <span className="text-slate-400 font-mono text-[11px]">
          Local Reference Specifications (Unconfirmed until MT5 Bridge Active)
        </span>
      </div>

      {/* Symbol Strip & Regime Breakdown */}
      <MarketOverview
        quotes={quotes}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={onSelectSymbol}
        regime={regime}
        feedFreshness={feedFreshness}
        onToggleDataDegradation={onToggleDataDegradation}
        isDegraded={isDegraded}
      />

      {/* Candlestick & Indicator Chart */}
      <MarketChart
        symbol={selectedSymbol}
        quote={activeQuote}
        candles={candles}
        positions={positions}
      />

      {/* Contract Specification Card */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] text-xs">
        <h3 className="font-semibold text-white mb-3 pb-2 border-b border-slate-800/80">
          XM / MT5 Standard Contract Specification — {spec.displayName}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Contract size</span>
            <span className="font-semibold text-white">{spec.contractSize.toLocaleString()} units</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Tick size / value</span>
            <span className="font-semibold text-white">{spec.tickSize} / ${spec.tickValue}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Volume min / step</span>
            <span className="font-semibold text-white">{spec.minVolumeLots}L / {spec.volumeStepLots}L</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Typical spread</span>
            <span className="font-semibold text-white">{spec.typicalSpreadPips} pips</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Margin currency</span>
            <span className="font-semibold text-white">{spec.marginCurrency}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Trading session</span>
            <span className="font-semibold text-slate-200">{spec.tradingHours}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
