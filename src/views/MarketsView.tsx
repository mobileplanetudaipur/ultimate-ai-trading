import React from 'react';
import { MarketQuote, Candle, PositionRecord, MarketRegime, FeedFreshness } from '../types/trading';
import { MarketChart } from '../components/MarketChart';
import { MarketOverview } from '../components/MarketOverview';
import { brokerGateway } from '../services/brokerGateway';

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
      {/* Disclaimer on simulation feed */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">Market Telemetry Source:</span>
          <span className="text-slate-400 font-mono">
            {activeQuote.provider} (Ticks: Local Deterministic Random Walk)
          </span>
        </div>
        <span className="text-slate-400 font-mono text-[11px]">
          XM/MT5 Standard Contract Specs Enforced
        </span>
      </div>

      {/* Symbol Strip & Market Overview */}
      <MarketOverview
        quotes={quotes}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={onSelectSymbol}
        regime={regime}
        feedFreshness={feedFreshness}
        onToggleDataDegradation={onToggleDataDegradation}
        isDegraded={isDegraded}
      />

      {/* Chart View */}
      <MarketChart
        symbol={selectedSymbol}
        quote={activeQuote}
        candles={candles}
        positions={positions}
      />

      {/* Contract Specification Card */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-xs">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 pb-2 border-b border-slate-800">
          XM / MT5 Standard Contract Specification — {spec.displayName}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-slate-300">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Contract Size</span>
            <span className="font-bold text-white">{spec.contractSize.toLocaleString()} units</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Tick Size / Value</span>
            <span className="font-bold text-white">{spec.tickSize} / ${spec.tickValue}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Volume Min / Step</span>
            <span className="font-bold text-white">{spec.minVolumeLots}L / {spec.volumeStepLots}L</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Typical Spread</span>
            <span className="font-bold text-white">{spec.typicalSpreadPips} pips</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Margin Currency</span>
            <span className="font-bold text-white">{spec.marginCurrency}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Trading Session</span>
            <span className="font-bold text-slate-200">{spec.tradingHours}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
