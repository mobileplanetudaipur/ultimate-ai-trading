import React from 'react';
import { FlaskConical, AlertTriangle, Scale, ShieldCheck, HelpCircle } from 'lucide-react';
import { ExecutionMetrics } from '../types/trading';

interface ResearchBacktestsViewProps {
  metrics: ExecutionMetrics;
}

export const ResearchBacktestsView: React.FC<ResearchBacktestsViewProps> = ({ metrics }) => {
  return (
    <div className="space-y-6">
      {/* Research Methodology Header */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-800/80">
          <FlaskConical className="w-5 h-5 text-purple-400" />
          <h2 className="text-xs font-semibold text-white">
            Quantitative Research & In-Sample Hypothesis Governance
          </h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          In strict accordance with the Master Build Prompt, <strong>no bot or algorithm can guarantee profitability or zero losses</strong>. Backtests and historical simulations carry survivorship bias, curve-fitting risks, and idealized fill assumptions. Strategies must undergo walk-forward out-of-sample testing before any demo evaluation.
        </p>
      </div>

      {/* Statistical Sample Size Caution Banner */}
      {!metrics.sampleConfidenceReliable && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4 text-xs text-amber-200 backdrop-blur-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block text-sm mb-1 text-white">
              Statistical Significance Warning (Completed Trades N = {metrics.totalTrades})
            </span>
            <p className="leading-relaxed text-xs text-amber-200/90">
              A minimum sample of 30 completed out-of-sample trades across varying market regimes is mandatory before metrics can be considered statistically meaningful. Current win rate ({metrics.winRatePercent}%) is preliminary.
            </p>
          </div>
        </div>
      )}

      {/* Execution Friction & Cost Modeling */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] font-mono text-xs">
        <h3 className="text-xs font-semibold text-white mb-3 pb-3 border-b border-slate-800/80 font-sans">
          Friction & Cost Models Applied in Local Simulation
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-slate-300">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1 font-sans">Spread modeling</span>
            <span className="font-semibold text-white">Dynamic Bid/Ask Spread</span>
            <span className="text-xs text-slate-500 block mt-1 font-sans">Simulates real-world widening</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1 font-sans">Round-turn commission</span>
            <span className="font-semibold text-white">$7.00 per Standard Lot</span>
            <span className="text-xs text-slate-500 block mt-1 font-sans">Deducted immediately at open</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1 font-sans">Execution slippage</span>
            <span className="font-semibold text-white">0.1 - 0.4 Pips Jitter</span>
            <span className="text-xs text-slate-500 block mt-1 font-sans">Applied to market order fills</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1 font-sans">Overnight financing</span>
            <span className="font-semibold text-white">Broker Swap Schedule</span>
            <span className="text-xs text-slate-500 block mt-1 font-sans">Triple swap on Wednesdays</span>
          </div>
        </div>
      </div>

      {/* Walk-Forward Protocol Progression */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] text-xs">
        <h3 className="text-xs font-semibold text-white mb-3 pb-3 border-b border-slate-800/80">
          Walk-Forward Validation Progression
        </h3>

        <ol className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-slate-800 text-blue-400 font-mono font-semibold flex items-center justify-center shrink-0 text-xs">1</span>
            <div>
              <strong className="text-white block font-medium">Historical In-Sample Parameter Calibration</strong>
              <span className="text-slate-400 leading-relaxed">Identify parameter stability zones on historical tick and candle archives.</span>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-slate-800 text-blue-400 font-mono font-semibold flex items-center justify-center shrink-0 text-xs">2</span>
            <div>
              <strong className="text-white block font-medium">Anchored Out-of-Sample Window Testing</strong>
              <span className="text-slate-400 leading-relaxed">Evaluate rules on untouched out-of-sample data across high, low, and extreme volatility regimes.</span>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-slate-800 text-blue-400 font-mono font-semibold flex items-center justify-center shrink-0 text-xs">3</span>
            <div>
              <strong className="text-white block font-medium">Forward Paper Simulation (Current Operating Mode)</strong>
              <span className="text-slate-400 leading-relaxed">Simulate order lifecycle, bracket stop tracking, and spread slippage in local runtime with zero real capital.</span>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-slate-800 text-blue-400 font-mono font-semibold flex items-center justify-center shrink-0 text-xs">4</span>
            <div>
              <strong className="text-white block font-medium">Broker Demo Gateway Shadowing</strong>
              <span className="text-slate-400 leading-relaxed">Connect to local Windows MT5 demo terminal to observe real broker quote feeds without submitting live orders.</span>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
};
