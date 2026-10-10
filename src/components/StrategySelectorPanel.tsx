import React from 'react';
import {
  Brain,
  CheckCircle,
  Ban,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertOctagon,
  Scale,
  Zap,
  Info
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
  // Find if there's any active actionable candidate signal
  const actionableEvaluations = evaluations.filter(e => e.signal !== 'NO_TRADE');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Strategy Selector & Multi-Regime Evidence Gate (Stage 6)
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            The platform is engineered to abstain and issue <span className="font-semibold text-amber-400 font-mono">NO TRADE</span> whenever evidence is insufficient.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400 text-[11px]">Actionable Signals:</span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
            actionableEvaluations.length > 0
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
          }`}>
            {actionableEvaluations.length > 0 ? `${actionableEvaluations.length} CANDIDATE(S)` : '0 (NO TRADE)'}
          </span>
        </div>
      </div>

      {/* Strategies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {evaluations.map(evaluation => {
          const strategyDef = DEFINED_STRATEGIES.find(s => s.id === evaluation.strategyId);
          const isActionable = evaluation.signal !== 'NO_TRADE';
          const isBelowThreshold = evaluation.suitabilityScore < evaluation.suitabilityThreshold;

          return (
            <div
              key={evaluation.strategyId}
              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                isActionable
                  ? 'border-emerald-500/50 bg-emerald-950/20 shadow-sm'
                  : 'border-slate-800 bg-slate-950/50'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white tracking-wide">
                        {evaluation.strategyName}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Category: {strategyDef?.category} • Timeframe: {strategyDef?.timeframe}
                    </span>
                  </div>

                  {/* Signal Badge */}
                  <div>
                    {evaluation.signal === 'BUY' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold font-mono">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        BUY SIGNAL
                      </span>
                    )}
                    {evaluation.signal === 'SELL' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs font-bold font-mono">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        SELL SIGNAL
                      </span>
                    )}
                    {evaluation.signal === 'NO_TRADE' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] font-bold font-mono">
                        <Ban className="w-3 h-3" />
                        NO TRADE
                      </span>
                    )}
                  </div>
                </div>

                {/* Suitability Score Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-400">Regime Suitability Score</span>
                    <span className={`font-bold ${isBelowThreshold ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {evaluation.suitabilityScore} / 100 <span className="text-slate-500 text-[10px]">(Req: {evaluation.suitabilityThreshold})</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all rounded-full ${
                        isBelowThreshold ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${evaluation.suitabilityScore}%` }}
                    />
                  </div>
                </div>

                {/* Signal or Invalidation Rationale */}
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 mb-3 text-xs">
                  {isActionable ? (
                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Entry Estimate:</span>
                        <span className="font-semibold text-white">{evaluation.entryPriceEstimate}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Proposed Stop Loss:</span>
                        <span className="text-rose-400">{evaluation.proposedStopLoss}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Proposed Take Profit:</span>
                        <span className="text-emerald-400">{evaluation.proposedTakeProfit}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Risk:Reward:</span>
                        <span className="text-sky-400">1 : {evaluation.riskRewardRatio}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-300">
                      <div className="text-amber-400 font-semibold mb-0.5 flex items-center gap-1">
                        <Info className="w-3 h-3 shrink-0" />
                        <span>Abstention Rationale:</span>
                      </div>
                      <p className="text-slate-400 leading-snug">
                        {evaluation.noTradeReason || 'Environmental conditions did not exceed empirical edge criteria.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Out of sample metrics footer */}
                <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-400 mb-3">
                  <div>
                    <span className="text-slate-400">OOS Sharpe:</span>
                    <div className="text-slate-200 font-bold">{strategyDef?.outOfSampleSharpe}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Win Rate:</span>
                    <div className="text-slate-200 font-bold">{strategyDef?.winRate}%</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Max Hist DD:</span>
                    <div className="text-slate-200 font-bold">{strategyDef?.maxHistoricalDrawdown}%</div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div>
                {isActionable ? (
                  <button
                    onClick={() => onExecuteSignal(evaluation)}
                    disabled={isTradingPaused || isCooldownActive || killSwitchActive}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isTradingPaused || isCooldownActive || killSwitchActive
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/50'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Route to Deterministic Risk Gate</span>
                  </button>
                ) : (
                  <div className="py-1.5 text-center text-[10px] font-mono text-slate-400 border border-dashed border-slate-800 rounded-lg">
                    Abstaining • No trade permitted
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
