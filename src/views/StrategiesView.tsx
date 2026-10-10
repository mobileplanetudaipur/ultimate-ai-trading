import React from 'react';
import { StrategyEvaluation } from '../types/trading';
import { StrategySelectorPanel } from '../components/StrategySelectorPanel';
import { DEFINED_STRATEGIES } from '../services/strategyEngine';
import { FlaskConical, AlertCircle, CheckCircle2, Info } from 'lucide-react';

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
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-start gap-3">
        <FlaskConical className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="font-bold text-white block mb-0.5">
            Quantitative Research Status: In-Sample Hypothesis Baseline
          </span>
          All candidate strategies operate under strict empirical suitability rules and out-of-sample forward paper testing. In alignment with non-negotiable rules, the engine is explicitly empowered to return <span className="font-mono font-bold text-amber-400">NO TRADE</span> whenever conditions, ADX strength, news proximity, or spread thresholds do not demonstrate edge.
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
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 pb-2 border-b border-slate-800">
          Evaluated Strategy Definitions & Invalidation Rules
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {DEFINED_STRATEGIES.map(def => (
            <div key={def.id} className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{def.name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                  {def.targetSymbol}
                </span>
              </div>

              <p className="text-slate-400 text-[11px] leading-snug">
                {def.description}
              </p>

              <div className="text-[11px] font-mono pt-2 border-t border-slate-800/80 text-rose-300/90">
                <span className="text-slate-400 block text-[10px] uppercase">Invalidation Rule:</span>
                {def.invalidationRules}
              </div>

              <div className="text-[10px] font-mono text-purple-300">
                Holding Time: {def.holdingTimeExpected} • Timeframes: {def.timeframes.join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
