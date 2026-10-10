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
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
          <FlaskConical className="w-5 h-5 text-purple-400" />
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">
            Quantitative Research & In-Sample Hypothesis Governance (Phase 5)
          </h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          In strict accordance with the Master Build Prompt, <strong>no bot or algorithm can guarantee profitability or zero losses</strong>. Backtests and historical simulations carry survivorship bias, curve-fitting risks, and idealized fill assumptions. Strategies must undergo walk-forward out-of-sample testing before any demo evaluation.
        </p>
      </div>

      {/* Statistical Sample Size Caution Banner */}
      {!metrics.sampleConfidenceReliable && (
        <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 text-xs text-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm mb-1">
              Statistical Significance Warning (Completed Trades N = {metrics.totalTrades})
            </span>
            <p className="leading-snug text-[11px] text-amber-300">
              A minimum sample of 30 completed out-of-sample trades across varying market regimes is mandatory before metrics can be considered statistically meaningful. Current win rate ({metrics.winRatePercent}%) is preliminary.
            </p>
          </div>
        </div>
      )}

      {/* Execution Friction & Cost Modeling */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-xs">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 pb-2 border-b border-slate-800 font-sans">
          Friction & Cost Models Applied in Local Simulation
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-slate-300">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block mb-1">Spread Modeling</span>
            <span className="font-bold text-white">Dynamic Bid/Ask Spread</span>
            <span className="text-[10px] text-slate-400 block mt-1">Simulates real-world widening</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block mb-1">Round-Turn Commission</span>
            <span className="font-bold text-white">$7.00 per Standard Lot</span>
            <span className="text-[10px] text-slate-400 block mt-1">Deducted immediately at open</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block mb-1">Execution Slippage</span>
            <span className="font-bold text-white">0.1 - 0.4 Pips Jitter</span>
            <span className="text-[10px] text-slate-400 block mt-1">Applied to market order fills</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block mb-1">Overnight Financing</span>
            <span className="font-bold text-white">Broker Swap Schedule</span>
            <span className="text-[10px] text-slate-400 block mt-1">Triple swap on Wednesdays</span>
          </div>
        </div>
      </div>

      {/* Walk-Forward Protocol Disclosure */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 text-xs">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 pb-2 border-b border-slate-800">
          Walk-Forward Validation Progression
        </h3>

        <ol className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-slate-800 text-blue-400 font-mono font-bold flex items-center justify-center shrink-0">1</span>
            <div>
              <strong className="text-white block">Historical In-Sample Parameter Calibration</strong>
              <span className="text-slate-400">Identify parameter stability zones on historical tick and candle archives.</span>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-slate-800 text-blue-400 font-mono font-bold flex items-center justify-center shrink-0">2</span>
            <div>
              <strong className="text-white block">Anchored Out-of-Sample Window Testing</strong>
              <span className="text-slate-400">Evaluate rules on untouched out-of-sample data across high, low, and extreme volatility regimes.</span>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-slate-800 text-blue-400 font-mono font-bold flex items-center justify-center shrink-0">3</span>
            <div>
              <strong className="text-white block">Forward Paper Simulation (Current Operating Mode)</strong>
              <span className="text-slate-400">Simulate order lifecycle, bracket stop tracking, and spread slippage in local runtime with zero real capital.</span>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-slate-800 text-blue-400 font-mono font-bold flex items-center justify-center shrink-0">4</span>
            <div>
              <strong className="text-white block">Broker Demo Gateway Shadowing</strong>
              <span className="text-slate-400">Connect to local Windows MT5 demo terminal to observe real broker quote feeds without submitting live orders.</span>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
};
