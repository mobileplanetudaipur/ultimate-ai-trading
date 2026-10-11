import React, { useState } from 'react';
import {
  X,
  Check,
  Info,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Server,
  Key,
  ShieldAlert,
  ArrowRight,
  Layers
} from 'lucide-react';
import { OperatingMode } from '../types/trading';
import { liveReleaseGateService, LiveActivationRequest } from '../services/liveReleaseGateService';
import { brokerGateway, XM_MT5_INSTRUMENT_SPECS } from '../services/brokerGateway';

interface ModeSelectorModalProps {
  isOpen: boolean;
  currentMode: OperatingMode;
  onClose: () => void;
  onSelectMode: (mode: OperatingMode) => void;
}

export const ModeSelectorModal: React.FC<ModeSelectorModalProps> = ({
  isOpen,
  currentMode,
  onClose,
  onSelectMode
}) => {
  const [selected, setSelected] = useState<OperatingMode>(currentMode);
  const [showLiveActivationWizard, setShowLiveActivationWizard] = useState(false);

  // Live Activation Verification State
  const [approvalPhrase, setApprovalPhrase] = useState('');
  const [hasLocalCredentials, setHasLocalCredentials] = useState(false);
  const [brokerServer, setBrokerServer] = useState('XMGlobal-Real 14');
  const [accountLogin, setAccountLogin] = useState('');
  const [accountType, setAccountType] = useState<'REAL' | 'DEMO'>('REAL');
  const [ackPositionsPolicy, setAckPositionsPolicy] = useState(false);
  const [ackRiskLimits, setAckRiskLimits] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const gateStatus = liveReleaseGateService.evaluateGates();

  const modes: {
    id: OperatingMode;
    title: string;
    badge: string;
    badgeColor: string;
    description: string;
    features: string[];
    isGated?: boolean;
  }[] = [
    {
      id: 'simulated',
      title: 'Local Paper Simulation (Active Default)',
      badge: 'Isolated & Verifiable',
      badgeColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      description: 'Default operational environment when broker bridge is offline. Full automated execution against local simulated tick stream. Zero external broker dependency.',
      features: [
        'Local tick walk & candle stream (synthetic paper feed)',
        'Multi-entity order/deal/position lifecycle testing',
        'Stage 9 Behavioral safeguards (0.20% risk, 5-loss / 30m lock)'
      ]
    },
    {
      id: 'demo',
      title: 'XM / MT5 Demo Mode (Bridge Required)',
      badge: 'Requires Active Bridge',
      badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      description: 'Connects to local Windows XM/MT5 terminal bridge (127.0.0.1:8000). Requires MT5 terminal running on Windows workstation.',
      features: [
        'XM MT5 Demo terminal IPC reconciliation',
        'Deterministic 0.20% per-trade risk sizing',
        'Mandatory idempotency & duplicate checks',
        'Automatic fail-closed on disconnect or timeout'
      ]
    },
    {
      id: 'read_only',
      title: 'Read-Only Observation',
      badge: 'Monitoring Only',
      badgeColor: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      description: 'Stream quotes, inspect indicator alignments and regime detection. All order execution is disabled.',
      features: [
        'Live candlestick & indicator rendering',
        'Continuous regime & suitability evaluation',
        'Strictly zero order submissions permitted'
      ]
    },
    {
      id: 'disconnected',
      title: 'Disconnected / Standby',
      badge: 'Engines Suspended',
      badgeColor: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
      description: 'Completely suspend all tick streaming, signal generation, and local engines.',
      features: [
        'Tick streamer paused',
        'All automated entries stopped',
        'Safe maintenance state'
      ]
    },
    {
      id: 'live',
      title: 'Live Real-Money Execution',
      badge: gateStatus.activeLiveReleaseState ? 'Approved Release Active' : 'Permanently Gated by Default',
      badgeColor: gateStatus.activeLiveReleaseState
        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
        : 'bg-rose-950/40 text-rose-400 border-rose-800/40',
      description: 'Places real financial orders with real capital. Strictly gated behind 6 verification criteria and deliberate operator approval.',
      features: [
        'Requires deliberate release approval & phrase',
        'Point-of-activation broker & server re-verification',
        'Deterministic 0.20% trade risk & 1.00% daily loss locked',
        'Fails closed immediately upon any uncertainty or gate failure'
      ],
      isGated: true
    }
  ];

  const handleApply = () => {
    if (selected === 'live' && !gateStatus.activeLiveReleaseState) {
      setShowLiveActivationWizard(true);
      return;
    }

    onSelectMode(selected);
    onClose();
  };

  const handleExecuteLiveActivation = () => {
    setActivationError(null);
    const request: LiveActivationRequest = {
      operatorApprovalPhrase: approvalPhrase,
      localCredentialsPresent: hasLocalCredentials,
      brokerServerName: brokerServer,
      accountLoginNumber: accountLogin,
      accountType,
      acknowledgedExistingPositionsPolicy: ackPositionsPolicy,
      acknowledgedRiskLimits: ackRiskLimits,
      acknowledgedInstruments: Object.keys(XM_MT5_INSTRUMENT_SPECS)
    };

    const res = liveReleaseGateService.requestLiveActivation(request);
    if (!res.success) {
      setActivationError(res.rejectionDetails?.join(' • ') || res.message);
      return;
    }

    onSelectMode('live');
    setShowLiveActivationWizard(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative backdrop-blur-2xl max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <Info className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-semibold text-white">Select Operating Mode & Environment</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Demo is the default operating environment. Live mode remains locked by default until all historical, out-of-sample, security, risk, and deliberate operator approval gates pass.
        </p>

        {showLiveActivationWizard ? (
          /* Live Release Activation Gate Wizard */
          <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
            <div className="p-4 rounded-xl border border-rose-500/50 bg-rose-950/30 text-rose-200">
              <div className="flex items-center gap-2 mb-2 font-semibold text-white">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Deliberate Live-Release Approval Gate Required</span>
              </div>
              <p className="leading-relaxed text-rose-200/90 mb-3">
                Live execution places real orders with real money. The architecture forbids automatic activation. To enable live mode for this session, you must re-verify all configuration points below and provide explicit release authorization.
              </p>
              <div className="font-mono text-[11px] bg-black/40 p-2.5 rounded-lg border border-rose-500/30 text-rose-300">
                Rule: If broker account type is live while platform expects demo, execution is blocked immediately.
              </div>
            </div>

            {/* Checklist of Gates */}
            <div className="space-y-2 border border-slate-800 bg-slate-950/60 p-4 rounded-xl">
              <h4 className="font-semibold text-white text-xs uppercase tracking-wider mb-2 font-sans">
                Release Verification Requirements
              </h4>
              {gateStatus.gates.map(gate => (
                <div key={gate.id} className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-800/60 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-200 font-sans block font-medium">{gate.title}</span>
                    <span className="text-slate-400 text-[10px]">{gate.evidence}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${gate.passed ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950 text-rose-300 border border-rose-500/30'}`}>
                    {gate.passed ? 'PASSED' : 'GATED'}
                  </span>
                </div>
              ))}
            </div>

            {/* Re-verification Form */}
            <div className="space-y-3 border border-slate-800 bg-slate-950/60 p-4 rounded-xl">
              <h4 className="font-semibold text-white text-xs uppercase tracking-wider font-sans">
                Point-of-Activation Re-verification
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Target Broker Server</label>
                  <input
                    type="text"
                    value={brokerServer}
                    onChange={e => setBrokerServer(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                    placeholder="e.g. XMGlobal-Real 14"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Account Login #</label>
                  <input
                    type="text"
                    value={accountLogin}
                    onChange={e => setAccountLogin(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                    placeholder="e.g. 88392104"
                  />
                </div>
              </div>

              {/* Exact Instruments & Limits Specification */}
              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px]">
                <span className="text-slate-300 font-semibold block mb-1">Verified Instruments & Locked Limits:</span>
                <span className="text-slate-400 block mb-1">
                  Instruments: <strong>EUR/USD, GBP/USD, USD/JPY, XAU/USD, BTC/USD</strong>
                </span>
                <span className="text-slate-400 block">
                  Mandatory Budgets: <strong>0.20% per-trade risk</strong>, <strong>1.00% daily loss ceiling</strong>, <strong>3 position ceiling</strong>, <strong>3x leverage max</strong>.
                </span>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2 pt-1 text-slate-300">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasLocalCredentials}
                    onChange={e => setHasLocalCredentials(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-blue-600"
                  />
                  <span>
                    Local credentials configured exclusively in local desktop daemon. No passwords stored in web client.
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ackPositionsPolicy}
                    onChange={e => setAckPositionsPolicy(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-blue-600"
                  />
                  <span>
                    <strong>Existing Position Behavior:</strong> Open positions are actively guarded by stop-loss brackets. System will never blindly liquidate existing positions on transition.
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ackRiskLimits}
                    onChange={e => setAckRiskLimits(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-blue-600"
                  />
                  <span>
                    I confirm strict deterministic risk bounds: 0.20% per-trade risk, 1.00% daily loss, 5-loss lockout breaker.
                  </span>
                </label>
              </div>

              {/* Exact Approval Phrase */}
              <div className="pt-2">
                <label className="text-[11px] text-slate-400 block mb-1">
                  Type required phrase: <strong className="text-rose-300 font-mono select-all">APPROVE LIVE RELEASE WITH STRICT RISK CONTROLS</strong>
                </label>
                <input
                  type="text"
                  value={approvalPhrase}
                  onChange={e => setApprovalPhrase(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-rose-300 font-mono text-xs font-semibold"
                  placeholder="APPROVE LIVE RELEASE WITH STRICT RISK CONTROLS"
                />
              </div>

              {activationError && (
                <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs">
                  {activationError}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowLiveActivationWizard(false)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                Back to Mode List
              </button>

              <button
                onClick={handleExecuteLiveActivation}
                className="px-5 py-2 text-xs font-bold rounded-xl text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer shadow-lg"
              >
                Authorize Live Release
              </button>
            </div>
          </div>
        ) : (
          /* Mode Selector Main List */
          <>
            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {modes.map(mode => {
                const isSelected = selected === mode.id;
                return (
                  <div
                    key={mode.id}
                    onClick={() => setSelected(mode.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer backdrop-blur-xl ${
                      isSelected
                        ? 'border-blue-500/60 bg-blue-950/25 ring-1 ring-blue-500/40 shadow-xs'
                        : 'border-slate-800/80 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{mode.title}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${mode.badgeColor} font-mono font-medium`}>
                          {mode.badge}
                        </span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-blue-500 bg-blue-600' : 'border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mb-2 leading-relaxed">{mode.description}</p>
                    <ul className="text-xs text-slate-400 space-y-0.5 list-disc list-inside font-sans">
                      {mode.features.map((feat, i) => (
                        <li key={i}>{feat}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end gap-3 pt-4 border-t border-slate-800/80">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-5 py-2 text-xs font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
              >
                {selected === 'live' && !gateStatus.activeLiveReleaseState ? 'Inspect Live Gate' : 'Apply Mode'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
