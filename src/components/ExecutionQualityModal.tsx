import React from 'react';
import { X, BarChart3, AlertTriangle, CheckCircle2, TrendingUp, Zap, HelpCircle } from 'lucide-react';
import { ExecutionMetrics } from '../types/trading';

interface ExecutionQualityModalProps {
  isOpen: boolean;
  metrics: ExecutionMetrics;
  onClose: () => void;
}

export const ExecutionQualityModal: React.FC<ExecutionQualityModalProps> = ({
  isOpen,
  metrics,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">Execution Quality & Health Monitor (Stage 12)</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Continuous statistical auditing of slippage, fill rate, sample sizes, and drawdown limits. Never infers future performance from past results.
        </p>

        {/* Statistical Sample Size Caution Banner */}
        {!metrics.sampleConfidenceReliable && (
          <div className="mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-950/20 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300 block mb-0.5">Statistical Sample Warning (N = {metrics.totalTrades})</span>
              <p className="text-[11px] text-amber-400/90 leading-tight">
                Current sample size is below the minimum threshold of 30 completed trades. Early performance metrics carry wide confidence bands and cannot be treated as statistically stationary.
              </p>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5 font-mono">
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
            <span className="text-[10px] text-slate-500 uppercase block mb-1">Win Rate</span>
            <span className="text-base font-bold text-white">{metrics.winRatePercent}%</span>
            <span className="text-[10px] text-slate-500 block">({metrics.winningTrades}W / {metrics.losingTrades}L)</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
            <span className="text-[10px] text-slate-500 uppercase block mb-1">Profit Factor</span>
            <span className="text-base font-bold text-slate-200">
              {metrics.profitFactor > 0 ? metrics.profitFactor : '—'}
            </span>
            <span className="text-[10px] text-slate-500 block">Gross Gain / Loss</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
            <span className="text-[10px] text-slate-500 uppercase block mb-1">Net Realized P&L</span>
            <span className={`text-base font-bold ${metrics.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {metrics.netPnl >= 0 ? '+' : ''}${metrics.netPnl.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-500 block">Net of comm & fees</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
            <span className="text-[10px] text-slate-500 uppercase block mb-1">Avg Slippage</span>
            <span className="text-base font-bold text-slate-200">{metrics.avgSlippagePips} pips</span>
            <span className="text-[10px] text-slate-500 block">Per order execution</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
            <span className="text-[10px] text-slate-500 uppercase block mb-1">Fill Rate</span>
            <span className="text-base font-bold text-emerald-400">{metrics.orderFillRatePercent}%</span>
            <span className="text-[10px] text-slate-500 block">{metrics.rejectedOrdersCount} rejected</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
            <span className="text-[10px] text-slate-500 uppercase block mb-1">Est. Sharpe Ratio</span>
            <span className="text-base font-bold text-slate-200">{metrics.sharpeRatioEstimate || 'N/A'}</span>
            <span className="text-[10px] text-slate-500 block">Annualized</span>
          </div>
        </div>

        {/* Quality Controls Statement */}
        <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80 text-[11px] text-slate-400 space-y-1 mb-5">
          <div className="text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Strict Health Criteria:</span>
          </div>
          <p>• Slippage over 1.5 pips average automatically flags the instrument as degraded.</p>
          <p>• Rejection rate above 5% pauses automated submissions to protect from broker mismatch.</p>
          <p>• In alignment with Rule 7, returns are strictly historical and never promised for future periods.</p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-500"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
