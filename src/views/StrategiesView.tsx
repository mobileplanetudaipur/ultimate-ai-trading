import React from 'react';
import { StrategyEvaluation } from '../types/trading';
import { StrategySelectorPanel } from '../components/StrategySelectorPanel';
import { DEFINED_STRATEGIES } from '../services/strategyEngine';
import { FlaskConical, Info, BookOpen } from 'lucide-react';

interface StrategiesViewProps {
  strategyEvaluations: StrategyEvaluation[];
  onExecuteSignal: (evaluation: StrategyEvaluation) => void;
  isTradingPaused: boolean;
  isCooldownActive: boolean;
  killSwitchActive: boolean;
}

export const StrategiesView: React.FC<StrategiesViewProps> = ({
  strategyEvaluations,
  onExecuteSignal,
  isTradingPaused,
  isCooldownActive,
  killSwitchActive
}) => {
  return (
    <div className="space-y-6">
      {/* Research Status Disclaimer */}
      <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] flex items-start gap-3">
        <FlaskConical className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="font-semibold text-white block mb-0.5">
            Quantitative Research Status: In-Sample Hypothesis Baseline
          </span>
          All candidate strategies operate under strict empirical suitability rules and out-of-sample forward paper testing. In alignment with non-negotiable rules, the engine is explicitly empowered to return <span className="font-mono font-semibold text-amber-300">NO TRADE</span> whenever conditions, ADX strength, news proximity, or spread thresholds do not demonstrate edge.
        </div>
      </div>

      {/* Main Strategy Selector Panel */}
      <StrategySelectorPanel
        evaluations={strategyEvaluations}
        onExecuteSignal={onExecuteSignal}
        isTradingPaused={isTradingPaused}
        isCooldownActive={isCooldownActive}
        killSwitchActive={killSwitchActive}
      />

      {/* Strategy Methodologies Deep-Dive */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800/80">
          <BookOpen className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-semibold text-white">
            Evaluated Strategy Definitions & Invalidation Rules
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {DEFINED_STRATEGIES.map(def => (
            <div
              key={def.id}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{def.name}</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300">
                  {def.targetSymbol}
                </span>
              </div>

              <p className="text-slate-400 text-xs leading-relaxed">
                {def.description}
              </p>

              <div className="text-xs font-mono pt-2 border-t border-slate-800/80 text-rose-300/90">
                <span className="text-slate-400 block text-[11px]">Invalidation rule:</span>
                {def.invalidationRules}
              </div>

              <div className="text-[11px] font-mono text-purple-300">
                Holding time: {def.holdingTimeExpected} • Timeframes: {def.timeframes.join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
