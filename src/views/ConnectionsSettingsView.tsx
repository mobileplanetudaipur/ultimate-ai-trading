import React, { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { Play, RefreshCw, Server, ShieldCheck, Square } from 'lucide-react';
import { brokerGateway, SIMULATED_INSTRUMENT_SPECS } from '../services/brokerGateway';
import { loadXMReconciliation, XMReconciliation } from '../services/xmMarketData';
import { PersistentRunState } from '../services/persistentRunControl';
import { XMOrderTicket } from '../components/XMOrderTicket';

interface MT5Status {
  state: 'CONNECTED_READ_ONLY';
  broker_company: string;
  server: string;
  account_mode: 'DEMO' | 'LIVE';
  currency: string;
  terminal_connected: boolean;
  terminal_trade_allowed: boolean;
  terminal_trade_api_disabled: boolean;
  account_trade_allowed: boolean;
  account_expert_allowed: boolean;
  observed_at_utc: string;
}

interface MT5Account {
  currency: string;
  balance: number | null;
  equity: number | null;
  profit: number | null;
  margin_used: number | null;
  free_margin: number | null;
  margin_level_percent: number | null;
  leverage: number;
  account_mode: 'DEMO' | 'LIVE';
  server: string;
  observed_at_utc: string;
}

interface MT5Symbol {
  symbol: string;
  description: string;
  visible: boolean;
  trade_mode: string;
  digits: number;
  point: number | null;
  currency_base: string;
  currency_profit: string;
  currency_margin: string;
  contract_size: number | null;
  tick_size: number | null;
  tick_value_profit: number | null;
  tick_value_loss: number | null;
  volume_min: number | null;
  volume_max: number | null;
  volume_step: number | null;
  stops_level_points: number;
  freeze_level_points: number;
  margin_initial: number | null;
  margin_maintenance: number | null;
  execution_mode: number;
  filling_mode: number;
  bid: number | null;
  ask: number | null;
  tick_age_ms: number | null;
  tick_timestamp_utc: string | null;
  received_at_utc: string;
  freshness: 'FRESH' | 'STALE' | 'FUTURE_TIMESTAMP' | 'UNAVAILABLE' | 'INVALID';
}

interface MT5Snapshot {
  status: MT5Status;
  account: MT5Account;
  symbols: MT5Symbol[];
}

type NativeConnectorState =
  | 'WAITING_FOR_TERMINAL'
  | 'WAITING_FOR_LOGIN'
  | 'CONNECTING'
  | 'CONNECTED_READ_ONLY'
  | 'ACCOUNT_NOT_SUPPORTED'
  | 'AMBIGUOUS_TERMINAL'
  | 'CONNECTOR_UNAVAILABLE'
  | 'UNSUPPORTED_PLATFORM'
  | 'ERROR';

interface NativeConnectorResponse {
  state: NativeConnectorState;
  message: string;
  order_submission: false;
  order_submission_enabled?: boolean;
  order_submission_mode?: 'DEMO' | 'LIVE' | null;
  order_recovery_required?: boolean;
  unresolved_orders?: Array<{ client_order_id: string; state: string; created_at_utc: string }>;
  status?: MT5Status;
  account?: MT5Account;
  symbols?: MT5Symbol[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNullableFiniteNumber = (value: unknown): value is number | null =>
  value === null || isFiniteNumber(value);

const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const isSupportedAccountMode = (value: unknown): value is 'DEMO' | 'LIVE' =>
  value === 'DEMO' || value === 'LIVE';

const parseStatus = (value: unknown): MT5Status | null => {
  if (!isRecord(value)) return null;
  if (
    value.state !== 'CONNECTED_READ_ONLY'
    || !isSupportedAccountMode(value.account_mode)
    || value.order_submission !== false
    || typeof value.broker_company !== 'string'
    || typeof value.server !== 'string'
    || typeof value.currency !== 'string'
    || !isTimestamp(value.observed_at_utc)
    || typeof value.terminal_connected !== 'boolean'
    || typeof value.terminal_trade_allowed !== 'boolean'
    || typeof value.terminal_trade_api_disabled !== 'boolean'
    || typeof value.account_trade_allowed !== 'boolean'
    || typeof value.account_expert_allowed !== 'boolean'
  ) return null;
  return {
    state: value.state,
    broker_company: value.broker_company,
    server: value.server,
    account_mode: value.account_mode,
    currency: value.currency,
    terminal_connected: value.terminal_connected,
    terminal_trade_allowed: value.terminal_trade_allowed,
    terminal_trade_api_disabled: value.terminal_trade_api_disabled,
    account_trade_allowed: value.account_trade_allowed,
    account_expert_allowed: value.account_expert_allowed,
    observed_at_utc: value.observed_at_utc
  };
};

const parseAccount = (value: unknown): MT5Account | null => {
  if (!isRecord(value)) return null;
  if (
    !isSupportedAccountMode(value.account_mode)
    || typeof value.currency !== 'string'
    || typeof value.server !== 'string'
    || !isTimestamp(value.observed_at_utc)
    || !isNullableFiniteNumber(value.balance)
    || !isNullableFiniteNumber(value.equity)
    || !isNullableFiniteNumber(value.profit)
    || !isNullableFiniteNumber(value.margin_used)
    || !isNullableFiniteNumber(value.free_margin)
    || !isNullableFiniteNumber(value.margin_level_percent)
    || typeof value.leverage !== 'number'
    || !Number.isInteger(value.leverage)
  ) return null;
  return {
    currency: value.currency,
    balance: value.balance,
    equity: value.equity,
    profit: value.profit,
    margin_used: value.margin_used,
    free_margin: value.free_margin,
    margin_level_percent: value.margin_level_percent,
    leverage: value.leverage,
    account_mode: value.account_mode,
    server: value.server,
    observed_at_utc: value.observed_at_utc
  };
};

const isMT5Symbol = (value: unknown): value is MT5Symbol => {
  if (!isRecord(value)) return false;
  return typeof value.symbol === 'string'
    && typeof value.description === 'string'
    && typeof value.visible === 'boolean'
    && typeof value.trade_mode === 'string'
    && ['FRESH', 'STALE', 'FUTURE_TIMESTAMP', 'UNAVAILABLE', 'INVALID'].includes(String(value.freshness))
    && ['currency_base', 'currency_profit', 'currency_margin'].every(key => typeof value[key] === 'string')
    && isTimestamp(value.received_at_utc)
    && (value.tick_timestamp_utc === null || isTimestamp(value.tick_timestamp_utc))
    && ['digits', 'stops_level_points', 'freeze_level_points', 'execution_mode', 'filling_mode']
      .every(key => Number.isInteger(value[key]))
    && ['point', 'contract_size', 'tick_size', 'tick_value_profit', 'tick_value_loss', 'volume_min', 'volume_max', 'volume_step', 'margin_initial', 'margin_maintenance', 'bid', 'ask', 'tick_age_ms']
      .every(key => isNullableFiniteNumber(value[key]));
};

const parseSymbols = (value: unknown): MT5Symbol[] | null => {
  if (!isRecord(value) || !Array.isArray(value.symbols)) return null;
  const symbols: MT5Symbol[] = [];
  for (const item of value.symbols) {
    if (!isMT5Symbol(item)) return null;
    symbols.push(item);
  }
  return symbols;
};

const bridgeErrorMessage = (status: number): string => ({
  401: 'Bridge token was rejected.',
  403: 'The terminal is not verified as an XM demo or live account.',
  429: 'Local bridge request limit reached; wait briefly before retrying.',
  503: 'The terminal, account, or requested market data is unavailable.'
}[status] || `Local bridge returned HTTP ${status}.`);

const parseNativeConnectorResponse = (value: unknown): NativeConnectorResponse | null => {
  if (!isRecord(value) || value.order_submission !== false || typeof value.message !== 'string') return null;
  const states: NativeConnectorState[] = [
    'WAITING_FOR_TERMINAL',
    'WAITING_FOR_LOGIN',
    'CONNECTING',
    'CONNECTED_READ_ONLY',
    'ACCOUNT_NOT_SUPPORTED',
    'AMBIGUOUS_TERMINAL',
    'CONNECTOR_UNAVAILABLE',
    'UNSUPPORTED_PLATFORM',
    'ERROR'
  ];
  if (!states.includes(value.state as NativeConnectorState)) return null;
  if (value.state !== 'CONNECTED_READ_ONLY') {
    return { state: value.state as NativeConnectorState, message: value.message, order_submission: false };
  }
  const status = parseStatus(value.status);
  const account = parseAccount(value.account);
  const symbols = parseSymbols({ symbols: value.symbols });
  if (!status || !account || !symbols) return null;
  return {
    state: 'CONNECTED_READ_ONLY',
    message: value.message,
    order_submission: false,
    order_submission_enabled: value.order_submission_enabled === true,
    order_submission_mode: isSupportedAccountMode(value.order_submission_mode) ? value.order_submission_mode : null,
    order_recovery_required: value.order_recovery_required === true,
    unresolved_orders: Array.isArray(value.unresolved_orders)
      ? value.unresolved_orders.filter((item): item is { client_order_id: string; state: string; created_at_utc: string } =>
        isRecord(item)
        && typeof item.client_order_id === 'string'
        && typeof item.state === 'string'
        && typeof item.created_at_utc === 'string')
      : [],
    status,
    account,
    symbols
  };
};

interface ConnectionsSettingsViewProps {
  botRunState: PersistentRunState;
  onToggleBotRunState: () => void;
}

export const ConnectionsSettingsView: React.FC<ConnectionsSettingsViewProps> = ({
  botRunState,
  onToggleBotRunState
}) => {
  const brokerStatus = brokerGateway.getStatus();
  const isNativeApp = isTauri();
  const isWindowsNativeApp = isNativeApp && /Windows/i.test(navigator.userAgent);
  const [bridgeToken, setBridgeToken] = useState('');
  const [bridgeSnapshot, setBridgeSnapshot] = useState<MT5Snapshot | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [isCheckingBridge, setIsCheckingBridge] = useState(false);
  const [nativeConnection, setNativeConnection] = useState<NativeConnectorResponse | null>(null);
  const [nativeConnectionError, setNativeConnectionError] = useState<string | null>(null);
  const [isCheckingNativeConnection, setIsCheckingNativeConnection] = useState(false);
  const [reconciliation, setReconciliation] = useState<XMReconciliation | null>(null);
  const [reconciliationError, setReconciliationError] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const nativeRequestInProgress = useRef(false);

  const checkNativeConnection = useCallback(async () => {
    if (!isWindowsNativeApp || nativeRequestInProgress.current) return;
    nativeRequestInProgress.current = true;
    setIsCheckingNativeConnection(true);
    setNativeConnectionError(null);
    try {
      const response = parseNativeConnectorResponse(await invoke<unknown>('mt5_connector_snapshot'));
      if (!response) throw new Error('The local connector returned incomplete or invalid terminal status.');
      setNativeConnection(response);
    } catch (error) {
      setNativeConnectionError(error instanceof Error ? error.message : 'The local XM connector could not be reached.');
      setNativeConnection(null);
    } finally {
      nativeRequestInProgress.current = false;
      setIsCheckingNativeConnection(false);
    }
  }, [isWindowsNativeApp]);

  const reconcileXM = async () => {
    setIsReconciling(true);
    setReconciliationError(null);
    try {
      setReconciliation(await loadXMReconciliation());
    } catch (error) {
      setReconciliation(null);
      setReconciliationError(error instanceof Error ? error.message : 'XM reconciliation failed.');
    } finally {
      setIsReconciling(false);
    }
  };

  useEffect(() => {
    if (!isWindowsNativeApp) return;
    void checkNativeConnection();
    const intervalId = window.setInterval(() => void checkNativeConnection(), 5000);
    return () => window.clearInterval(intervalId);
  }, [checkNativeConnection, isWindowsNativeApp]);

  const verifyBridge = async () => {
    if (isNativeApp) {
      setBridgeError('Broker transport is not configured in the installed app.');
      return;
    }
    if (bridgeToken.trim().length < 32) {
      setBridgeError('Enter the local bridge token; it must be at least 32 characters.');
      return;
    }

    setIsCheckingBridge(true);
    setBridgeError(null);
    setBridgeSnapshot(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);
    try {
      const read = async (path: string): Promise<unknown> => {
        const response = await fetch(`http://127.0.0.1:8000${path}`, {
          headers: { Authorization: `Bearer ${bridgeToken}` },
          cache: 'no-store',
          signal: controller.signal
        });
        if (!response.ok) throw new Error(bridgeErrorMessage(response.status));
        return response.json();
      };
      const [statusValue, accountValue, symbolsValue] = await Promise.all([
        read('/v1/status'),
        read('/v1/account'),
        read('/v1/symbols')
      ]);
      const status = parseStatus(statusValue);
      const account = parseAccount(accountValue);
      const symbols = parseSymbols(symbolsValue);
      if (!status || !account || !symbols) {
        throw new Error('Local bridge returned incomplete or invalid verification data.');
      }
      setBridgeSnapshot({ status, account, symbols });
    } catch (error) {
      setBridgeError(error instanceof Error && error.name === 'AbortError'
        ? 'Local bridge request timed out. No terminal state was verified.'
        : error instanceof Error
        ? error.message
        : 'Local bridge request failed. No terminal state was verified.');
    } finally {
      window.clearTimeout(timeoutId);
      setIsCheckingBridge(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Baseline Card */}
      <div className="p-5 rounded-xl border border-amber-500/35 bg-amber-950/20 text-xs">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-500/25 text-amber-200">
          <ShieldCheck className="w-4 h-4 text-amber-300" />
          <h2 className="font-bold uppercase tracking-wider">XM order submission is gated</h2>
        </div>

        <p className="text-amber-100/90 leading-relaxed">
          Connect and sign in through the official XM MT5 terminal. Demo orders require a separate session unlock and confirmation of every order. Live order activation remains locked pending release approval and safety/recovery gates. Strategy proposals are not sent to XM; no broker password is collected.
        </p>
      </div>

      {/* Local MT5 Gateway Configuration */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-xs">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800 font-sans">
          <Server className="w-5 h-5 text-blue-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Broker connection
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block mb-1">
              {isNativeApp ? 'MT5 adapter access' : 'Local read-only bridge'}
            </span>
            <input
              type="text"
              readOnly
              value={isNativeApp
                ? isWindowsNativeApp ? 'Bundled connector · order submission gated' : 'Unavailable on this platform'
                : 'http://127.0.0.1:8000'}
              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-slate-300 font-mono text-xs"
            />
            <span className="text-[10px] text-slate-400 block mt-1">
              {isNativeApp
                ? isWindowsNativeApp
                  ? 'Runs locally over private app pipes; no user-managed Python, script, or bridge process.'
                  : 'Automatic MT5 connection is supported only by the Windows app.'
                : 'Loopback only · GET endpoints · no broker order access'}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block mb-1">Target Account Mode</span>
            <input
              type="text"
              readOnly
              value={isNativeApp ? 'XM demo/live connector · read-only' : 'XM demo/live read-only access'}
              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-amber-300 font-bold font-mono text-xs"
            />
            <span className="text-[10px] text-slate-400 block mt-1">Verified broker state is read-only until the separately gated demo order ticket is explicitly enabled.</span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-950/40 border border-slate-800 text-slate-400 text-[11px] font-sans">
          <strong>Broker permissions:</strong> {brokerStatus.errorMessage}
        </div>
      </div>

      <section className="p-5 rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              {isWindowsNativeApp ? 'XM terminal connection' : isNativeApp ? 'XM connection unavailable' : 'XM MT5 read-only verification'}
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
              {isWindowsNativeApp
                ? 'Sign in through the official MT5 terminal. Account and market data are verified locally; this app never handles your broker password.'
                : isNativeApp
                ? 'Automatic MT5 connection is supported only on Windows. No broker service is configured for this platform.'
                : "Queries the signed-in XM demo or live terminal directly. The access token stays in this page's memory and is not saved."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
            <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[10px] font-mono text-amber-200">DEMO MANUAL · LIVE LOCKED</span>
            {isWindowsNativeApp && (
              <button
                type="button"
                onClick={() => void checkNativeConnection()}
                disabled={isCheckingNativeConnection}
                className="rounded-lg border border-blue-500/40 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300 disabled:cursor-wait disabled:opacity-60"
              >
                {isCheckingNativeConnection ? 'Checking…' : 'Check connection'}
              </button>
            )}
          </div>
        </div>
        {isNativeApp ? isWindowsNativeApp ? (
          <div className="space-y-4">
                          <div role="list" aria-label="XM connection steps" className="grid gap-3 text-xs text-slate-300 md:grid-cols-3">
                <div role="listitem" className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <span className="mb-2 block text-[10px] font-mono uppercase tracking-wider text-blue-300">Step 1</span>
                  <strong className="block text-slate-100">Open XM MT5</strong>
                  Keep the official desktop terminal open on this PC.
                </div>
                <div role="listitem" className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <span className="mb-2 block text-[10px] font-mono uppercase tracking-wider text-blue-300">Step 2</span>
                  <strong className="block text-slate-100">Sign in securely</strong>
                  Complete login in MT5. Never enter your password in this app.
                </div>
                <div role="listitem" className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <span className="mb-2 block text-[10px] font-mono uppercase tracking-wider text-blue-300">Step 3</span>
                  <strong className="block text-slate-100">Keep MT5 connected</strong>
                  Verified terminal and account data appear here in read-only mode.
                </div>
              </div>

            <div
              role={nativeConnectionError ? 'alert' : 'status'}
              aria-live="polite"
              className={`rounded-lg border p-3 text-xs ${
                nativeConnection?.state === 'CONNECTED_READ_ONLY'
                  ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'
                  : nativeConnection?.state === 'ACCOUNT_NOT_SUPPORTED' || nativeConnectionError
                  ? 'border-rose-500/30 bg-rose-950/20 text-rose-200'
                  : 'border-amber-500/30 bg-amber-950/20 text-amber-200'
              }`}
            >
              <strong className="block">
                {nativeConnectionError
                  ? 'Connector status unavailable'
                  : nativeConnection?.state === 'CONNECTED_READ_ONLY'
                  ? `Connected · XM ${nativeConnection.account?.account_mode === 'LIVE' ? 'live' : 'demo'} · verified terminal`
                  : nativeConnection?.state === 'WAITING_FOR_LOGIN'
                  ? 'XM MT5 is open · waiting for account sign-in'
                  : nativeConnection?.state === 'AMBIGUOUS_TERMINAL'
                  ? 'Multiple MT5 terminals detected'
                  : nativeConnection?.state === 'ACCOUNT_NOT_SUPPORTED'
                  ? 'Account not verified'
                  : nativeConnection?.state === 'CONNECTOR_UNAVAILABLE'
                  ? 'Bundled connector unavailable'
                  : nativeConnection?.state === 'UNSUPPORTED_PLATFORM'
                  ? 'XM MT5 is unavailable on this platform'
                  : nativeConnection?.state === 'CONNECTING'
                  ? 'Connecting to XM MT5'
                  : 'Waiting for XM MT5'}
              </strong>
              <span className="mt-1 block">
                {nativeConnectionError || nativeConnection?.message
                  || 'The app is checking for an already-open XM MT5 terminal. No account or broker data is shown until verified.'}
              </span>
            </div>

            {nativeConnection?.state === 'CONNECTED_READ_ONLY' && nativeConnection.status && nativeConnection.account && (
              <>
                <div className="rounded-lg border border-emerald-500/20 bg-slate-950/50 p-3 text-xs">
                  <strong className="text-emerald-200">
                    {nativeConnection.status.broker_company} · {nativeConnection.status.server}
                  </strong>
                  <p className="mt-1 text-slate-300">
                    {nativeConnection.account.account_mode === 'LIVE' ? 'Live account' : 'Demo account'} · {nativeConnection.account.currency} · observed {new Date(nativeConnection.status.observed_at_utc).toLocaleString()}
                  </p>
                  {nativeConnection.account.account_mode === 'LIVE' && (
                    <p className="mt-1 font-semibold text-amber-300">
                      Live order activation remains locked pending separate release approval and completed safety/recovery gates.
                    </p>
                  )}
                  <p className="mt-1 text-slate-300">
                    Balance {nativeConnection.account.balance === null ? 'unavailable' : `${nativeConnection.account.currency} ${nativeConnection.account.balance.toLocaleString()}`}
                    {' · '}Equity {nativeConnection.account.equity === null ? 'unavailable' : `${nativeConnection.account.currency} ${nativeConnection.account.equity.toLocaleString()}`}
                  </p>
                </div>
                <XMOrderTicket
                  accountMode={nativeConnection.account.account_mode}
                  symbols={nativeConnection.symbols ?? []}
                  terminalTradeAllowed={nativeConnection.status.terminal_trade_allowed}
                  terminalTradeApiDisabled={nativeConnection.status.terminal_trade_api_disabled}
                  accountTradeAllowed={nativeConnection.status.account_trade_allowed}
                  expertAllowed={nativeConnection.status.account_expert_allowed}
                  orderSessionEnabled={nativeConnection.order_submission_enabled === true}
                  recoveryRequired={nativeConnection.order_recovery_required === true}
                  unresolvedOrders={nativeConnection.unresolved_orders ?? []}
                  onRefresh={checkNativeConnection}
                />
                <div>
                  <h4 className="text-xs font-semibold text-slate-100">Visible XM symbols</h4>
                  <p className="mb-2 mt-1 text-[11px] text-slate-400">
                    Exact symbols, broker terms, and quote freshness are reported by the signed-in MT5 terminal.
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full min-w-[520px] text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          <th className="p-2">Exact terminal symbol</th>
                          <th className="p-2">Bid</th>
                          <th className="p-2">Ask</th>
                          <th className="p-2">Quote status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {nativeConnection.symbols?.map(symbol => (
                          <tr key={symbol.symbol}>
                            <td className="p-2 font-mono">{symbol.symbol}</td>
                            <td className="p-2 font-mono">{symbol.bid ?? 'Unavailable'}</td>
                            <td className="p-2 font-mono">{symbol.ask ?? 'Unavailable'}</td>
                            <td className={`p-2 ${symbol.freshness === 'FRESH' ? 'text-emerald-300' : 'text-amber-300'}`}>
                              {symbol.freshness}
                            </td>
                          </tr>
                        ))}
                        {nativeConnection.symbols?.length === 0 && (
                          <tr><td colSpan={4} className="p-3 text-slate-400">No visible symbols are available in the terminal's Market Watch.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                {nativeConnection.account.account_mode === 'DEMO' && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-100">Persistent strategy run control</h4>
                        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">Saved on this device. This controls paper proposals only; it does not enable broker orders.</p>
                      </div>
                      <button type="button" onClick={onToggleBotRunState} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${botRunState === 'RUNNING' ? 'bg-rose-950/40 text-rose-200 border border-rose-500/30' : 'bg-emerald-700 text-white border border-emerald-500/40'}`}>
                        {botRunState === 'RUNNING' ? <><Square className="h-3.5 w-3.5" /> Stop strategy proposals</> : <><Play className="h-3.5 w-3.5" /> Run strategy proposals</>}
                      </button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-100">XM account and order reconciliation · read-only</h4>
                      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">View account, open positions/orders, and 30 days of broker history/deals on demo or live accounts. Incomplete responses fail closed.</p>
                    </div>
                    <button type="button" onClick={() => void reconcileXM()} disabled={isReconciling} className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                      <RefreshCw className={`h-3.5 w-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
                      {isReconciling ? 'Reconciling…' : 'Reconcile XM now'}
                    </button>
                  </div>
                  {reconciliationError && <p role="alert" className="text-xs text-rose-300">{reconciliationError}</p>}
                  {reconciliation && <div role="status" className="grid gap-2 text-[11px] text-emerald-200 sm:grid-cols-2 lg:grid-cols-4">
                    <span>Account snapshot: complete</span>
                    <span>Open positions: {reconciliation.open_positions.length}</span>
                    <span>Open orders: {reconciliation.open_orders.length}</span>
                    <span>30-day orders / deals: {reconciliation.history_orders_30d.length} / {reconciliation.deals_30d.length}</span>
                    <span className="sm:col-span-2 lg:col-span-4 text-slate-400">Observed {new Date(reconciliation.observed_at_utc).toLocaleString()}. This view does not yet reconcile app-created broker orders.</span>
                  </div>}
                </div>
              </>
            )}

            <div className="rounded-lg border border-amber-500/25 bg-amber-950/15 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-xs font-semibold text-amber-100">Execution boundary</h4>
                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[10px] font-mono text-amber-200">MANUAL DEMO · LIVE RELEASE LOCKED</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                A manually confirmed demo order route is available in the Windows native app; no strategy is connected to it. Live activation remains blocked until a separate release approval and safety/recovery gates pass.
              </p>
              <p className="text-[11px] text-slate-400">This source has not been verified against an XM account. No strategy guarantees profit; market gaps and losses remain possible.</p>
            </div>
          </div>
        ) : (
          <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
            Automatic XM MT5 connection is currently supported only by the Windows app. No broker service is configured on this platform.
          </p>
        ) : (
        <>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="sr-only" htmlFor="local-bridge-token">Local bridge access token</label>
          <input
            id="local-bridge-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={bridgeToken}
            onChange={event => setBridgeToken(event.target.value)}
            placeholder="Paste locally generated bridge token"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
          />
          <button
            type="button"
            onClick={verifyBridge}
            disabled={isCheckingBridge}
            className="rounded-lg border border-blue-500/40 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300 disabled:cursor-wait disabled:opacity-60"
          >
            {isCheckingBridge ? 'Verifying…' : 'Verify read-only terminal'}
          </button>
        </div>
        {bridgeError && (
          <p role="alert" className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
            {bridgeError}
          </p>
        )}
        {bridgeSnapshot && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sky-300">CONNECTED_READ_ONLY · {bridgeSnapshot.status.account_mode}</strong>
                <span className="text-slate-400">Observed {new Date(bridgeSnapshot.status.observed_at_utc).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-slate-200">
                {bridgeSnapshot.status.broker_company} · {bridgeSnapshot.status.server} · {bridgeSnapshot.status.currency}
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
                Terminal connected: {String(bridgeSnapshot.status.terminal_connected)} · Terminal trade allowed: {String(bridgeSnapshot.status.terminal_trade_allowed)} · Account trade allowed: {String(bridgeSnapshot.status.account_trade_allowed)} · Expert allowed: {String(bridgeSnapshot.status.account_expert_allowed)}
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">This snapshot does not feed the synthetic charts or authorize trading.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              {[
                [`${bridgeSnapshot.account.account_mode} balance`, bridgeSnapshot.account.balance],
                [`${bridgeSnapshot.account.account_mode} equity`, bridgeSnapshot.account.equity],
                [`${bridgeSnapshot.account.account_mode} profit`, bridgeSnapshot.account.profit],
                ['Free margin', bridgeSnapshot.account.free_margin],
                ['Margin used', bridgeSnapshot.account.margin_used],
                ['Margin level', bridgeSnapshot.account.margin_level_percent === null
                  ? null
                  : `${bridgeSnapshot.account.margin_level_percent}%`],
                ['Leverage', `1:${bridgeSnapshot.account.leverage}`]
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <span className="block text-[10px] text-slate-400">{label}</span>
                  <span className="mt-1 block font-mono text-slate-100">
                    {value === null
                      ? 'Unavailable'
                      : typeof value === 'number'
                      ? `${bridgeSnapshot.account.currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : value}
                  </span>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full min-w-[1250px] text-left text-[11px]">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="p-2">Exact symbol</th>
                    <th className="p-2">Mode</th>
                    <th className="p-2">Currencies</th>
                    <th className="p-2">Contract</th>
                    <th className="p-2">Point / tick size / value</th>
                    <th className="p-2">Volume min / max / step</th>
                    <th className="p-2">Stops / freeze (points)</th>
                    <th className="p-2">Margin initial / maintenance</th>
                    <th className="p-2">Execution / fill</th>
                    <th className="p-2">Bid / ask</th>
                    <th className="p-2">Tick age</th>
                    <th className="p-2">Tick timestamp (UTC)</th>
                    <th className="p-2">Freshness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {bridgeSnapshot.symbols.length === 0
                    ? <tr><td colSpan={13} className="p-4 text-center text-slate-400">No visible terminal symbols were returned.</td></tr>
                    : bridgeSnapshot.symbols.map(symbol => (
                      <tr key={symbol.symbol}>
                        <td className="p-2 font-mono font-semibold text-white" title={symbol.description}>
                          {symbol.symbol} <span className="text-slate-500">({symbol.digits} digits)</span>
                        </td>
                        <td className="p-2">{symbol.trade_mode}</td>
                        <td className="p-2">{symbol.currency_base}/{symbol.currency_profit}/{symbol.currency_margin}</td>
                        <td className="p-2">{symbol.contract_size ?? 'Unavailable'}</td>
                        <td className="p-2">{symbol.point ?? 'Unavailable'} / {symbol.tick_size ?? 'Unavailable'} / {symbol.tick_value_profit ?? 'Unavailable'} profit, {symbol.tick_value_loss ?? 'Unavailable'} loss</td>
                        <td className="p-2">{symbol.volume_min ?? 'Unavailable'} / {symbol.volume_max ?? 'Unavailable'} / {symbol.volume_step ?? 'Unavailable'}</td>
                        <td className="p-2">{symbol.stops_level_points} / {symbol.freeze_level_points}</td>
                        <td className="p-2">{symbol.margin_initial ?? 'Unavailable'} / {symbol.margin_maintenance ?? 'Unavailable'}</td>
                        <td className="p-2">{symbol.execution_mode} / {symbol.filling_mode}</td>
                        <td className="p-2 font-mono">{symbol.bid ?? 'Unavailable'} / {symbol.ask ?? 'Unavailable'}</td>
                        <td className="p-2">{symbol.tick_age_ms === null ? 'Unavailable' : `${Math.round(symbol.tick_age_ms / 1000)}s`}</td>
                        <td className="p-2">{symbol.tick_timestamp_utc ? new Date(symbol.tick_timestamp_utc).toLocaleString() : 'Unavailable'}</td>
                        <td className={`p-2 font-semibold ${symbol.freshness === 'FRESH' ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {symbol.freshness}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-400">
              Broker snapshots are read-only, refreshed only when requested, and held in page memory. Exact names are displayed without symbol substitution; stale or future-dated ticks are not considered fresh.
            </p>
          </div>
        )}
        </>
        )}
      </section>

      {/* Contract Specifications Reference Table */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-xs">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 pb-2 border-b border-slate-800 font-sans">
          Local Paper-Simulation Contract Assumptions
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 text-[11px]">
                <th className="p-2.5">Symbol</th>
                <th className="p-2.5">Asset Class</th>
                <th className="p-2.5">Contract Size</th>
                <th className="p-2.5">Tick Size / Value</th>
                <th className="p-2.5">Min / Step Lot</th>
                <th className="p-2.5">Typ. Spread</th>
                <th className="p-2.5">Margin Cur.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {Object.values(SIMULATED_INSTRUMENT_SPECS).map(spec => (
                <tr key={spec.symbol} className="hover:bg-slate-800/30">
                  <td className="p-2.5 font-bold text-white">{spec.symbol}</td>
                  <td className="p-2.5 text-slate-400">{spec.assetClass}</td>
                  <td className="p-2.5">{spec.contractSize.toLocaleString()} units</td>
                  <td className="p-2.5">{spec.tickSize} / ${spec.tickValue}</td>
                  <td className="p-2.5">{spec.minVolumeLots}L / {spec.volumeStepLots}L</td>
                  <td className="p-2.5">{spec.typicalSpreadPips} pips</td>
                  <td className="p-2.5 text-slate-400">{spec.marginCurrency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
