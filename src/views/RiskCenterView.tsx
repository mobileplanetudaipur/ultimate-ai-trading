import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Lock,
  Percent,
  Clock,
  Calculator,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { AccountState, MarketQuote, PositionRecord, RiskLimits, RiskStatus } from '../types/trading';
import { riskEngine, RiskValidationResult } from '../services/riskEngine';
import { formatPrice } from '../utils/indicators';

interface RiskCenterViewProps {
  limits: RiskLimits;
  status: RiskStatus;
  account: AccountState;
  quotes: MarketQuote[];
  positions: PositionRecord[];
  onSimulateLoss: () => void;
}

export const RiskCenterView: React.FC<RiskCenterViewProps> = ({
  limits,
  status,
  account,
  quotes,
  positions,
  onSimulateLoss
}) => {
  // Pre-trade Calculator state
  const [calcSymbol, setCalcSymbol] = useState<string>('EUR/USD');
  const [calcSide, setCalcSide] = useState<'BUY' | 'SELL'>('BUY');
  const selectedQuote = quotes.find(q => q.symbol === calcSymbol) || quotes[0];
  const [calcEntry, setCalcEntry] = useState<string>(selectedQuote.ask.toString());
  const [calcStop, setCalcStop] = useState<string>((selectedQuote.ask - 0.0020).toFixed(selectedQuote.digits));

  const entryNum = parseFloat(calcEntry) || selectedQuote.ask;
  const stopNum = parseFloat(calcStop) || selectedQuote.ask - 0.0020;

  const testValidation: RiskValidationResult = riskEngine.validateOrderProposal(
    selectedQuote,
    account,
    positions,
    [],
    calcSide,
    stopNum,
    entryNum
  );

  return (
    <div className="space-y-6">
      {/* Risk Engine Baseline Policy Overview */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">
            Deterministic Risk Limits — Central Safety Gate (Phase 3 Baseline)
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block mb-1">Max Risk / Trade</span>
            <span className="text-base font-bold text-emerald-400">0.20% Equity</span>
            <span className="text-[10px] text-slate-400 block mt-1">${(account.equity * 0.002).toFixed(2)} on $10k</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block mb-1">Daily Loss Limit</span>
            <span className={`text-base font-bold ${status.dailyLossLimitBreached ? 'text-rose-400' : 'text-slate-100'}`}>
              1.00% Equity
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">Today: {status.todayDrawdownPercent.toFixed(2)}%</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block mb-1">Max Overall DD</span>
            <span className="text-base font-bold text-slate-100">
              {limits.maxOverallDrawdownPercent.toFixed(2)}% Equity
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">Preservation ceiling</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block mb-1">Daily Trade Cap</span>
            <span className={`text-base font-bold ${status.todayTradesCount >= 8 ? 'text-rose-400' : 'text-slate-100'}`}>
              8 Trades / Day
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">Today: {status.todayTradesCount} Trades</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block mb-1">Max Positions</span>
            <span className="text-base font-bold text-slate-100">3 Simultaneous</span>
            <span className="text-[10px] text-slate-400 block mt-1">{positions.length} Active Currently</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block mb-1">Max Leverage</span>
            <span className="text-base font-bold text-slate-100">3.00x Portfolio</span>
            <span className="text-[10px] text-slate-400 block mt-1">Prevents over-gearing</span>
          </div>
        </div>
      </div>

      {/* Stage 9 Behavioral Safeguard Card */}
      <div className={`p-5 rounded-xl border ${
        status.isCooldownActive
          ? 'border-rose-500/50 bg-rose-950/20'
          : status.consecutiveLossCount >= 3
          ? 'border-amber-500/50 bg-amber-950/20'
          : 'border-slate-800 bg-slate-900/60'
      }`}>
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Stage 9 Behavioral Safeguard: 5-Loss 30-Minute Cooling-Off Lockout
            </h3>
          </div>

          <button
            onClick={onSimulateLoss}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700 cursor-pointer"
            title="Records a test simulated loss to verify the 5-loss lockout trigger"
          >
            + Test Simulated Loss ({status.consecutiveLossCount}/5)
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          To eliminate revenge trading and emotional over-leveraging, the engine automatically halts entries for 30 minutes after five consecutive net losing trades. In alignment with safety requirements, this lockout <strong>cannot be bypassed or cleared</strong> by synthetic operator actions.
        </p>

        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full transition-all rounded-full ${
              status.isCooldownActive ? 'bg-rose-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, (status.consecutiveLossCount / 5) * 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs font-mono text-slate-300">
          <span>Consecutive Loss Count: {status.consecutiveLossCount} / 5</span>
          {status.isCooldownActive ? (
            <span className="text-rose-400 font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              Mandatory 30-Minute Lockout Active
            </span>
          ) : (
            <span className="text-slate-400">{5 - status.consecutiveLossCount} losses until lockout</span>
          )}
        </div>
      </div>

      {/* Pre-Trade Sizing & Rejection Calculator */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-xs">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
          <Calculator className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Deterministic Pre-Trade Gate Inspector & Lot Sizing Simulator
          </h3>
        </div>

        <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
          Verify how candidate trade proposals are evaluated under XM contract specifications. Demonstrates the strict rule: if the minimum broker lot (0.01) would exceed the 0.20% risk budget, the trade is rejected rather than forcing an unsafe lot.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-[10px] text-slate-400 uppercase block mb-1">Instrument</label>
            <select
              value={calcSymbol}
              onChange={e => {
                setCalcSymbol(e.target.value);
                const q = quotes.find(quote => quote.symbol === e.target.value);
                if (q) {
                  setCalcEntry(q.ask.toString());
                  setCalcStop((q.ask - 0.0020).toFixed(q.digits));
                }
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
            >
              {quotes.map(q => (
                <option key={q.symbol} value={q.symbol}>{q.symbol}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase block mb-1">Side</label>
            <select
              value={calcSide}
              onChange={e => setCalcSide(e.target.value as 'BUY' | 'SELL')}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
            >
              <option value="BUY">BUY (Long)</option>
              <option value="SELL">SELL (Short)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase block mb-1">Entry Price</label>
            <input
              type="number"
              step="any"
              value={calcEntry}
              onChange={e => setCalcEntry(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase block mb-1">Stop Loss Price</label>
            <input
              type="number"
              step="any"
              value={calcStop}
              onChange={e => setCalcStop(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
            />
          </div>
        </div>

        {/* Validation Result Box */}
        <div className={`p-4 rounded-xl border ${
          testValidation.isApproved
            ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
            : 'border-rose-500/40 bg-rose-950/20 text-rose-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {testValidation.isApproved ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400" />
              )}
              <span className="font-bold text-sm">
                {testValidation.isApproved ? 'ORDER APPROVED BY RISK GATE' : `ORDER REJECTED [${testValidation.ruleBlocked}]`}
              </span>
            </div>

            {testValidation.isApproved && (
              <span className="text-xs font-mono font-bold text-emerald-300">
                Calculated Lot Size: {testValidation.calculatedLotSize} Lots
              </span>
            )}
          </div>

          {testValidation.isApproved ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono pt-2 border-t border-emerald-500/20">
              <div>Risk Allocated: ${testValidation.calculatedRiskAmount?.toFixed(2)} (0.20% max)</div>
              <div>Leverage Impact: {testValidation.effectiveLeverageRatio}x (3.0x max)</div>
              <div>Contract Math: Instrument-Aware XM Spec</div>
            </div>
          ) : (
            <p className="text-xs font-sans text-rose-300 leading-snug pt-1">
              {testValidation.rejectionMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
