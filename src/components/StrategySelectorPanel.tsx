import React, { useState } from 'react';
import {
  Brain,
  CheckCircle,
  Ban,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Scale,
  Zap,
  Info,
  Sliders,
  Check,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { StrategyDefinition, StrategyEvaluation } from '../types/trading';
import { DEFINED_STRATEGIES } from '../services/strategyEngine';

interface StrategySelectorPanelProps {
  evaluations: StrategyEvaluation[];
  onExecuteSignal: (evaluation: StrategyEvaluation) => void;
  isTradingPaused: boolean;
  isCooldownActive: boolean;
  killSwitchActive: boolean;
}

export const StrategySelectorPanel: React.FC<StrategySelectorPanelProps> = ({
  evaluations,
  onExecuteSignal,
  isTradingPaused,
  isCooldownActive,
  killSwitchActive
}) => {
  // Strategy active toggles state
  const [strategyEnabledMap, setStrategyEnabledMap] = useState<Record<string, boolean>>({
    'strat_btc_ema': true,
    'strat_donchian_breakout': true,
    'strat_gold_sweep': true,
    'strat_eur_mean_reversion': true
  });

  const toggleStrategy = (id: string) => {
    setStrategyEnabledMap(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const actionableEvaluations = evaluations.filter(
    e => e.signal !== 'NO_TRADE' && strategyEnabledMap[e.strategyId] !== false
  );

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-semibold text-white">
              Strategy Selector & Multi-Regime Evidence Gate
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            The platform is engineered to abstain and issue <span className="font-semibold text-amber-300 font-mono">NO TRADE</span> whenever conditions fail evidence criteria.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">Actionable signals:</span>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              actionableEvaluations.length > 0
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            }`}
          >
            {actionableEvaluations.length > 0 ? `${actionableEvaluations.length} Candidate Signal(s)` : '0 (All Abstaining)'}
          </span>
        </div>
      </div>

      {/* Strategies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {evaluations.map(evaluation => {
          const strategyDef = DEFINED_STRATEGIES.find(s => s.id === evaluation.strategyId);
          const isEnabled = strategyEnabledMap[evaluation.strategyId] !== false;
          const isActionable = isEnabled && evaluation.signal !== 'NO_TRADE';
          const isBelowThreshold = evaluation.suitabilityScore < evaluation.suitabilityThreshold;

          // Versions tag mock
          const versionTag = evaluation.strategyId.includes('btc')
            ? 'v1.4.2'
            : evaluation.strategyId.includes('gold')
            ? 'v2.1.0'
            : evaluation.strategyId.includes('donchian')
            ? 'v1.2.0'
            : 'v1.1.5';

          return (
            <div
              key={evaluation.strategyId}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between backdrop-blur-xl ${
                !isEnabled
                  ? 'border-slate-800/60 bg-slate-950/40 opacity-60'
                  : isActionable
                  ? 'border-emerald-500/40 bg-emerald-950/15 shadow-[inset_0_1px_0_rgba(16,185,129,0.1)]'
                  : 'border-slate-800/80 bg-slate-950/60'
              }`}
            >
              <div>
                {/* Header & Toggle */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">
                        {evaluation.strategyName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300">
                        {versionTag}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Category: {strategyDef?.category} • Target: {strategyDef?.targetSymbol}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleStrategy(evaluation.strategyId)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                      title={isEnabled ? 'Disable strategy' : 'Enable strategy'}
                    >
                      {isEnabled ? (
                        <ToggleRight className="w-5 h-5 text-blue-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-slate-600" />
                      )}
                    </button>

                    {/* Signal Badge */}
                    {isEnabled ? (
                      <>
                        {evaluation.signal === 'BUY' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-mono font-medium">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            BUY
                          </span>
                        )}
                        {evaluation.signal === 'SELL' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-mono font-medium">
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            SELL
                          </span>
                        )}
                        {evaluation.signal === 'NO_TRADE' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-medium">
                            <Ban className="w-3 h-3" />
                            NO TRADE
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[11px] font-mono">
                        DISABLED
                      </span>
                    )}
                  </div>
                </div>

                {/* Suitability Score Meter */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-400">Regime suitability score</span>
                    <span className={`font-semibold tabular-nums ${isBelowThreshold ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {evaluation.suitabilityScore} / 100 <span className="text-slate-500">(Req: {evaluation.suitabilityThreshold})</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800/80">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isBelowThreshold ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${evaluation.suitabilityScore}%` }}
                    />
                  </div>
                </div>

                {/* Signal or Invalidation Rationale */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 mb-3 text-xs">
                  {isActionable ? (
                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Estimated entry:</span>
                        <span className="font-semibold text-white tabular-nums">{evaluation.entryPriceEstimate}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Proposed stop loss:</span>
                        <span className="text-rose-400 tabular-nums">{evaluation.proposedStopLoss}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Proposed take profit:</span>
                        <span className="text-emerald-400 tabular-nums">{evaluation.proposedTakeProfit}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Risk : reward:</span>
                        <span className="text-sky-300 tabular-nums">1 : {evaluation.riskRewardRatio}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-300">
                      <div className="text-amber-300 font-medium mb-1 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span>Abstention / Invalidation Rationale:</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed">
                        {evaluation.noTradeReason || 'Current volatility regime or spread does not meet statistical edge requirements.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Evidence Note */}
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 font-mono mb-3">
                  <span className="text-slate-500 block">Empirical sample baseline:</span>
                  <span className="text-purple-300 leading-snug">{strategyDef?.baselineEvidenceNote}</span>
                </div>
              </div>

              {/* Action Button */}
              <div>
                {isActionable ? (
                  <button
                    onClick={() => onExecuteSignal(evaluation)}
                    disabled={isTradingPaused || isCooldownActive || killSwitchActive}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ${
                      isTradingPaused || isCooldownActive || killSwitchActive
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-98'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Route to Risk Gate (0.20% Max)</span>
                  </button>
                ) : (
                  <div className="py-2 text-center text-xs font-mono text-slate-400 border border-slate-800 rounded-xl bg-slate-950/40">
                    Abstaining • No Entry Permitted
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
