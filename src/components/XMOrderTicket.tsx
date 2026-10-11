import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react';

interface XMOrderSymbol {
  symbol: string;
  visible: boolean;
  trade_mode: string;
  digits: number;
  point: number | null;
  volume_min: number | null;
  volume_max: number | null;
  volume_step: number | null;
  bid: number | null;
  ask: number | null;
  freshness: string;
}

interface PreparedOrder {
  confirmationId: string;
  expiresAt: string;
  accountMode: 'DEMO' | 'LIVE';
  symbol: string;
  side: 'BUY' | 'SELL';
  volume: number;
  quote: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  riskLimit: number;
  margin: number;
  currency: string;
  preflight: string;
}

interface BrokerResult {
  state: 'FILLED' | 'PARTIALLY_FILLED' | 'PLACED' | 'REJECTED' | 'UNKNOWN';
  accountMode: 'DEMO' | 'LIVE';
  symbol: string;
  side: 'BUY' | 'SELL';
  requestedVolume: number;
  message?: string;
  broker: {
    available: boolean;
    retcode?: number | null;
    comment?: string;
    order_ticket?: number;
    deal_ticket?: number;
    volume?: number | null;
    price?: number | null;
  };
}

interface XMOrderTicketProps {
  accountMode: 'DEMO' | 'LIVE';
  symbols: XMOrderSymbol[];
  terminalTradeAllowed: boolean;
  terminalTradeApiDisabled: boolean;
  accountTradeAllowed: boolean;
  expertAllowed: boolean;
  orderSessionEnabled: boolean;
  recoveryRequired: boolean;
  unresolvedOrders: Array<{ client_order_id: string; state: string; created_at_utc: string }>;
  onRefresh: () => Promise<void>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNullableFiniteNumber = (value: unknown): value is number | null =>
  value === null || isFiniteNumber(value);

const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const orderRequest = async (request: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const response = await invoke<unknown>('mt5_connector_request', { request });
  if (!isRecord(response)) throw new Error('The bundled connector returned an invalid order response.');
  if (response.state === 'ERROR') {
    throw new Error(typeof response.message === 'string' ? response.message : 'The XM connector rejected the request.');
  }
  return response;
};

export const XMOrderTicket: React.FC<XMOrderTicketProps> = ({
  accountMode,
  symbols,
  terminalTradeAllowed,
  terminalTradeApiDisabled,
  accountTradeAllowed,
  expertAllowed,
  orderSessionEnabled,
  recoveryRequired,
  unresolvedOrders,
  onRefresh
}) => {
  const [localSessionEnabled, setLocalSessionEnabled] = useState(false);
  const [sessionPhrase, setSessionPhrase] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [volume, setVolume] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [prepared, setPrepared] = useState<PreparedOrder | null>(null);
  const [confirmOrder, setConfirmOrder] = useState(false);
  const [result, setResult] = useState<BrokerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usableSymbols = symbols.filter(symbol =>
    symbol.visible
    && symbol.trade_mode === 'FULL'
    && symbol.freshness === 'FRESH'
    && symbol.volume_min !== null
    && symbol.volume_max !== null
    && symbol.volume_step !== null
  );
  const firstUsableSymbol = usableSymbols[0]?.symbol;
  const activeSymbol = usableSymbols.find(symbol => symbol.symbol === selectedSymbol);
  const sessionEnabled = orderSessionEnabled || localSessionEnabled;

  useEffect(() => {
    setLocalSessionEnabled(orderSessionEnabled);
    if (!orderSessionEnabled) {
      setPrepared(null);
      setConfirmOrder(false);
    }
  }, [orderSessionEnabled]);

  useEffect(() => {
    if (!usableSymbols.some(symbol => symbol.symbol === selectedSymbol)) {
      setSelectedSymbol(firstUsableSymbol ?? '');
    }
  }, [firstUsableSymbol, selectedSymbol, usableSymbols]);

  useEffect(() => {
    if (activeSymbol?.volume_min !== null && activeSymbol?.volume_min !== undefined) {
      setVolume(String(activeSymbol.volume_min));
    }
  }, [activeSymbol?.symbol, activeSymbol?.volume_min]);

  useEffect(() => {
    if (recoveryRequired) {
      setPrepared(null);
      setConfirmOrder(false);
    }
  }, [recoveryRequired]);

  const enableDemoSession = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await orderRequest({
        action: 'enable_trading',
        account_mode: accountMode,
        confirmation: sessionPhrase
      });
      if (
        accountMode !== 'DEMO'
        || response.state !== 'DEMO_ORDER_SUBMISSION_ENABLED_FOR_SESSION'
        || response.account_mode !== 'DEMO'
        || response.order_submission !== false
      ) {
        throw new Error('The connector did not confirm demo order-session activation.');
      }
      setLocalSessionEnabled(true);
      setSessionPhrase('');
      await onRefresh();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Demo order submission could not be enabled.');
    } finally {
      setBusy(false);
    }
  };

  const disableSession = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await orderRequest({ action: 'disable_trading' });
      if (response.state !== 'ORDER_SUBMISSION_LOCKED') {
        throw new Error('The connector did not confirm that order submission was locked.');
      }
      setLocalSessionEnabled(false);
      setPrepared(null);
      setConfirmOrder(false);
      setResult(null);
      await onRefresh();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Order submission could not be locked.');
    } finally {
      setBusy(false);
    }
  };

  const prepareOrder = async () => {
    if (!sessionEnabled || !selectedSymbol) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setPrepared(null);
    setConfirmOrder(false);
    try {
      const response = await orderRequest({
        action: 'prepare_order',
        order: {
          client_order_id: crypto.randomUUID().replace(/-/g, ''),
          symbol: selectedSymbol,
          side,
          volume: Number(volume),
          stop_loss: Number(stopLoss),
          take_profit: Number(takeProfit)
        }
      });
      const preflight = response.broker_check;
      if (
        response.state !== 'ORDER_PREPARED'
        || response.order_submission !== false
        || typeof response.confirmation_id !== 'string'
        || !isTimestamp(response.expires_at_utc)
        || (response.account_mode !== 'DEMO' && response.account_mode !== 'LIVE')
        || !isFiniteNumber(response.volume)
        || !isFiniteNumber(response.quoted_price)
        || !isFiniteNumber(response.potential_loss_account_currency)
        || !isFiniteNumber(response.risk_limit_percent)
        || !isFiniteNumber(response.estimated_margin_account_currency)
        || typeof response.account_currency !== 'string'
        || !isRecord(preflight)
        || !isFiniteNumber(preflight.retcode)
        || typeof preflight.comment !== 'string'
        || !isNullableFiniteNumber(preflight.margin)
        || !isNullableFiniteNumber(preflight.free_margin)
      ) {
        throw new Error('MT5 returned incomplete review data; no order was submitted.');
      }
      setPrepared({
        confirmationId: response.confirmation_id,
        expiresAt: response.expires_at_utc,
        accountMode: response.account_mode,
        symbol: selectedSymbol,
        side,
        volume: response.volume,
        quote: response.quoted_price,
        stopLoss: Number(stopLoss),
        takeProfit: Number(takeProfit),
        riskAmount: response.potential_loss_account_currency,
        riskLimit: response.risk_limit_percent,
        margin: response.estimated_margin_account_currency,
        currency: response.account_currency,
        preflight: preflight.comment || `retcode ${preflight.retcode}`
      });
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'MT5 could not prepare this order.');
    } finally {
      setBusy(false);
    }
  };

  const submitOrder = async () => {
    if (!prepared || !confirmOrder) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await orderRequest({
        action: 'submit_order',
        confirmation: {
          confirmation_id: prepared.confirmationId,
          confirm_order: true,
          confirm_live: false
        }
      });
      const validStates = ['FILLED', 'PARTIALLY_FILLED', 'PLACED', 'REJECTED', 'UNKNOWN'];
      if (
        !validStates.includes(String(response.state))
        || response.order_submission !== true
        || (response.account_mode !== 'DEMO' && response.account_mode !== 'LIVE')
        || (response.side !== 'BUY' && response.side !== 'SELL')
        || typeof response.symbol !== 'string'
        || !isFiniteNumber(response.requested_volume)
        || !isRecord(response.broker_result)
        || typeof response.broker_result.available !== 'boolean'
      ) {
        throw new Error('The result is inconclusive. Check MT5 before retrying; do not submit another order.');
      }
      const broker: BrokerResult = {
        state: response.state as BrokerResult['state'],
        accountMode: response.account_mode,
        symbol: response.symbol,
        side: response.side,
        requestedVolume: response.requested_volume,
        message: typeof response.message === 'string' ? response.message : undefined,
        broker: response.broker_result as BrokerResult['broker']
      };
      setResult(broker);
      setPrepared(null);
      setConfirmOrder(false);
      if (broker.state === 'UNKNOWN') {
        setError('MT5 did not return a definitive outcome. Do not retry; reconcile the order in the official terminal.');
      }
      await onRefresh();
    } catch (operationError) {
      setPrepared(null);
      setConfirmOrder(false);
      setError(operationError instanceof Error ? operationError.message : 'The outcome is unknown. Check MT5 before retrying.');
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const hasTradingPermissions = terminalTradeAllowed
    && !terminalTradeApiDisabled
    && accountTradeAllowed
    && expertAllowed;

  return (
    <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">XM order session</h4>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
            Manual market-order ticket only; strategy proposals are not sent to XM. Each demo order requires a fresh broker check, review, and explicit confirmation.
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-mono ${sessionEnabled ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/25 bg-amber-400/10 text-amber-200'}`}>
          {sessionEnabled ? 'SESSION UNLOCKED' : 'LOCKED BY DEFAULT'}
        </span>
      </div>

      {accountMode === 'LIVE' ? (
        <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-100">
          <Lock className="mr-2 inline h-4 w-4 align-text-bottom" />
          Live order activation is disabled pending separate release approval and completion of demo, safety, and recovery gates.
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          {!sessionEnabled ? (
            <>
              <label className="sr-only" htmlFor="demo-order-session-confirmation">Demo order session confirmation phrase</label>
              <input
                id="demo-order-session-confirmation"
                value={sessionPhrase}
                onChange={event => setSessionPhrase(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="Type ENABLE DEMO ORDER SUBMISSION"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
              />
              <button
                type="button"
                onClick={() => void enableDemoSession()}
                disabled={busy || sessionPhrase !== 'ENABLE DEMO ORDER SUBMISSION' || recoveryRequired}
                className="rounded-lg border border-emerald-500/40 bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Updating…' : 'Enable demo order submission'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void disableSession()}
              disabled={busy}
              className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-900/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300 disabled:opacity-50"
            >
              {busy ? 'Locking…' : 'Lock demo order submission'}
            </button>
          )}
        </div>
      )}

      {recoveryRequired && (
        <div role="alert" className="rounded-lg border border-rose-500/35 bg-rose-950/25 p-3 text-xs text-rose-100">
          <strong className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Order recovery required</strong>
          <p className="mt-1">A prior send was interrupted or returned an unknown result. New orders are blocked. Reconcile it in MT5; do not retry.</p>
          {unresolvedOrders.map(order => (
            <p key={order.client_order_id} className="mt-1 break-all font-mono text-[11px]">
              {order.state} · {order.client_order_id} · {new Date(order.created_at_utc).toLocaleString()}
            </p>
          ))}
        </div>
      )}

      {accountMode === 'DEMO' && sessionEnabled && !recoveryRequired && (
        <div className="space-y-4 border-t border-slate-800 pt-4">
          <h5 className="text-xs font-semibold text-slate-100">Prepare a demo market order</h5>
          <p className="text-[11px] leading-relaxed text-slate-400">
            MT5 rechecks quote freshness, permissions, stop-loss risk, margin, position limits, and daily/session limits before you review. A 0.20% per-order loss ceiling applies; market gaps and slippage remain possible.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="xm-order-symbol" className="mb-1 block text-[11px] text-slate-300">Exact MT5 symbol</label>
              <select
                id="xm-order-symbol"
                value={selectedSymbol}
                onChange={event => setSelectedSymbol(event.target.value)}
                disabled={busy || usableSymbols.length === 0}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-50"
              >
                {usableSymbols.map(symbol => <option key={symbol.symbol} value={symbol.symbol}>{symbol.symbol} · {symbol.digits} digits</option>)}
                {usableSymbols.length === 0 && <option value="">No fresh, fully tradable symbol</option>}
              </select>
            </div>
            <div>
              <label htmlFor="xm-order-side" className="mb-1 block text-[11px] text-slate-300">Side</label>
              <select id="xm-order-side" value={side} onChange={event => setSide(event.target.value as 'BUY' | 'SELL')} disabled={busy} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-50">
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
              </select>
            </div>
            <div>
              <label htmlFor="xm-order-volume" className="mb-1 block text-[11px] text-slate-300">Lots {activeSymbol?.volume_min !== null && activeSymbol?.volume_min !== undefined ? `(min ${activeSymbol.volume_min}, step ${activeSymbol.volume_step})` : ''}</label>
              <input id="xm-order-volume" type="number" min={activeSymbol?.volume_min ?? undefined} max={activeSymbol?.volume_max ?? undefined} step={activeSymbol?.volume_step ?? undefined} value={volume} onChange={event => setVolume(event.target.value)} disabled={busy || !activeSymbol} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-50" />
            </div>
            <div>
              <label htmlFor="xm-order-stop-loss" className="mb-1 block text-[11px] text-slate-300">Stop loss price</label>
              <input id="xm-order-stop-loss" type="number" min="0" step={activeSymbol?.point ?? undefined} value={stopLoss} onChange={event => setStopLoss(event.target.value)} disabled={busy} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-50" />
            </div>
            <div>
              <label htmlFor="xm-order-take-profit" className="mb-1 block text-[11px] text-slate-300">Take profit price</label>
              <input id="xm-order-take-profit" type="number" min="0" step={activeSymbol?.point ?? undefined} value={takeProfit} onChange={event => setTakeProfit(event.target.value)} disabled={busy} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-50" />
            </div>
            <div className="flex items-end">
              <button type="button" onClick={() => void prepareOrder()} disabled={busy || !selectedSymbol || !volume || !stopLoss || !takeProfit || !activeSymbol || !hasTradingPermissions} className="w-full rounded-lg border border-blue-500/40 bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? 'Checking with MT5…' : 'Check & review order'}
              </button>
            </div>
          </div>
          {activeSymbol && <p className="text-[11px] text-slate-400">Latest terminal quote: Bid {activeSymbol.bid ?? 'unavailable'} / Ask {activeSymbol.ask ?? 'unavailable'} · {activeSymbol.freshness}</p>}
          {!hasTradingPermissions && <p role="status" className="text-[11px] text-amber-200">Enable trading in MT5 and verify account permissions before preparing an order.</p>}
        </div>
      )}

      {prepared && (
        <div className="space-y-3 rounded-lg border border-blue-500/30 bg-blue-950/20 p-4 text-xs">
          <h5 className="font-semibold text-blue-100">Review before sending · expires {new Date(prepared.expiresAt).toLocaleTimeString()}</h5>
          <div className="grid gap-2 text-slate-200 sm:grid-cols-2">
            <span>{prepared.accountMode} · {prepared.side} {prepared.volume} {prepared.symbol}</span>
            <span>MT5-checked quote: {prepared.quote}</span>
            <span>Stop loss: {prepared.stopLoss} · take profit: {prepared.takeProfit}</span>
            <span>Estimated loss at stop: {prepared.currency} {prepared.riskAmount.toFixed(2)} (limit {prepared.riskLimit}%)</span>
            <span>Estimated margin: {prepared.currency} {prepared.margin.toFixed(2)}</span>
            <span>MT5 preflight: {prepared.preflight}</span>
          </div>
          <label className="flex items-start gap-2 text-slate-200">
            <input type="checkbox" checked={confirmOrder} onChange={event => setConfirmOrder(event.target.checked)} disabled={busy} className="mt-0.5 accent-blue-500" />
            I reviewed these exact terms and confirm sending this demo order to XM MT5.
          </label>
          <button type="button" onClick={() => void submitOrder()} disabled={busy || !confirmOrder} className="rounded-lg border border-emerald-500/40 bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? 'Waiting for MT5 result…' : 'Confirm & send demo order'}
          </button>
        </div>
      )}

      {result && (
        <div role="status" className={`rounded-lg border p-3 text-xs ${result.state === 'FILLED' ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-100' : result.state === 'REJECTED' ? 'border-rose-500/30 bg-rose-950/20 text-rose-100' : 'border-amber-500/30 bg-amber-950/20 text-amber-100'}`}>
          <strong className="flex items-center gap-2">
            {result.state === 'FILLED' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            MT5 response: {result.state} · {result.accountMode}
          </strong>
          <p className="mt-1">Request sent to MT5: {result.side} {result.requestedVolume} {result.symbol}. The status below is the broker response, not a simulated fill.</p>
          {result.broker.available ? (
            <p className="mt-1 break-words font-mono text-[11px]">
              Retcode {result.broker.retcode ?? 'unavailable'} · {result.broker.comment || 'No broker comment'}
              {result.broker.order_ticket ? ` · order #${result.broker.order_ticket}` : ''}
              {result.broker.deal_ticket ? ` · deal #${result.broker.deal_ticket}` : ''}
              {result.broker.volume !== null && result.broker.volume !== undefined ? ` · executed volume ${result.broker.volume}` : ''}
              {result.broker.price !== null && result.broker.price !== undefined ? ` · executed price ${result.broker.price}` : ''}
            </p>
          ) : <p className="mt-1">MT5 did not return a broker result. Do not retry; reconcile directly in MT5.</p>}
          {result.message && <p className="mt-1">{result.message}</p>}
        </div>
      )}

      {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-100">{error}</p>}
    </section>
  );
};
