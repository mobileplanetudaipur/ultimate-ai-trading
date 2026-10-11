import { invoke, isTauri } from '@tauri-apps/api/core';
import { Candle, MarketQuote } from '../types/trading';
import { SUPPORTED_INSTRUMENTS } from './marketDataService';

interface XMQuoteSymbol {
  symbol: string;
  bid: number | null;
  ask: number | null;
  digits: number;
  tick_age_ms: number | null;
  freshness: 'FRESH' | 'STALE' | 'FUTURE_TIMESTAMP' | 'UNAVAILABLE' | 'INVALID';
  received_at_utc: string;
  tick_timestamp_utc: string | null;
}

interface XMSnapshot {
  state: string;
  status: { account_mode: 'DEMO' | 'LIVE' };
  symbols?: XMQuoteSymbol[];
  order_submission: false;
}

interface XMCandleHistory {
  symbol: string;
  timeframe: string;
  candles: Candle[];
  provider: string;
  order_submission: false;
}

export interface XMBrokerMarketData {
  quotes: MarketQuote[];
  candles: Map<string, Candle[]>;
  exactSymbols: Map<string, string>;
  accountMode: 'DEMO' | 'LIVE';
}

export interface XMReconciliation {
  account: Record<string, unknown>;
  open_positions: Record<string, unknown>[];
  open_orders: Record<string, unknown>[];
  history_orders_30d: Record<string, unknown>[];
  deals_30d: Record<string, unknown>[];
  complete: true;
  observed_at_utc: string;
  order_submission: false;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const normalizedName = (name: string): string => name.replace(/[^a-z0-9]/gi, '').toUpperCase();

/** Resolve only a unique exact name or a common delimiter-separated XM suffix. */
export const resolveExactXMSymbol = (displaySymbol: string, visibleSymbols: XMQuoteSymbol[]): string | null => {
  const alias = normalizedName(displaySymbol);
  const matching = visibleSymbols.filter(item => {
    const brokerName = item.symbol.toUpperCase();
    return normalizedName(item.symbol) === alias
      || new RegExp(`^${alias}(?:[#._-][A-Z0-9]+)?$`, 'i').test(brokerName);
  });
  return matching.length === 1 ? matching[0].symbol : null;
};

const parseCandleHistory = (value: unknown, symbol: string): Candle[] => {
  if (!record(value) || value.symbol !== symbol || value.order_submission !== false || !Array.isArray(value.candles)) {
    throw new Error(`XM returned an invalid history response for ${symbol}.`);
  }
  const bars: Candle[] = [];
  for (const item of value.candles) {
    if (!record(item) || !['time', 'open', 'high', 'low', 'close', 'volume'].every(key => finite(item[key]))) continue;
    const bar = item as unknown as Candle;
    if (bar.time <= 0 || bar.time > Date.now() || bar.volume < 0 || bar.high < Math.max(bar.open, bar.close) || bar.low > Math.min(bar.open, bar.close)) continue;
    bars.push(bar);
  }
  bars.sort((a, b) => a.time - b.time);
  if (bars.length < 50) throw new Error(`XM returned fewer than 50 valid M15 bars for ${symbol}.`);
  return bars.slice(-300);
};

const parseSnapshot = (value: unknown): XMSnapshot => {
  if (!record(value) || value.order_submission !== false || value.state !== 'CONNECTED_READ_ONLY'
    || !record(value.status) || !['DEMO', 'LIVE'].includes(String(value.status.account_mode))
    || !Array.isArray(value.symbols)) throw new Error('The XM terminal is not connected or its snapshot is invalid.');
  const symbols = value.symbols.filter((item): item is XMQuoteSymbol => record(item)
    && typeof item.symbol === 'string'
    && ['FRESH', 'STALE', 'FUTURE_TIMESTAMP', 'UNAVAILABLE', 'INVALID'].includes(String(item.freshness))
    && (item.bid === null || finite(item.bid)) && (item.ask === null || finite(item.ask))
    && Number.isInteger(item.digits)
    && (item.tick_age_ms === null || finite(item.tick_age_ms))
    && typeof item.received_at_utc === 'string'
    && (item.tick_timestamp_utc === null || typeof item.tick_timestamp_utc === 'string'));
  return { state: 'CONNECTED_READ_ONLY', status: value.status as XMSnapshot['status'], symbols, order_submission: false };
};

export const loadXMBrokerMarketData = async (cached?: Pick<XMBrokerMarketData, 'exactSymbols' | 'candles' | 'accountMode'>, refreshHistory = false): Promise<XMBrokerMarketData> => {
  if (!isTauri()) throw new Error('XM terminal data is available only in the installed desktop application.');
  const snapshot = cached
    ? null
    : parseSnapshot(await invoke<unknown>('mt5_connector_snapshot'));
  const quoteResponse: unknown = snapshot
    ? { symbols: snapshot.symbols, account_mode: snapshot.status.account_mode, order_submission: false }
    : await invoke('mt5_connector_request', { request: { action: 'quotes', symbols: [...cached!.exactSymbols.values()] } });
  if (!record(quoteResponse) || quoteResponse.order_submission !== false
    || !['DEMO', 'LIVE'].includes(String(quoteResponse.account_mode))
    || !Array.isArray(quoteResponse.symbols)) {
    throw new Error('XM returned an invalid quote refresh.');
  }
  const accountMode = quoteResponse.account_mode as 'DEMO' | 'LIVE';
  const visibleSymbols = quoteResponse.symbols.filter((item): item is XMQuoteSymbol => record(item)
    && typeof item.symbol === 'string'
    && ['FRESH', 'STALE', 'FUTURE_TIMESTAMP', 'UNAVAILABLE', 'INVALID'].includes(String(item.freshness))
    && (item.bid === null || finite(item.bid)) && (item.ask === null || finite(item.ask))
    && Number.isInteger(item.digits)
    && (item.tick_age_ms === null || finite(item.tick_age_ms))
    && typeof item.received_at_utc === 'string'
    && (item.tick_timestamp_utc === null || typeof item.tick_timestamp_utc === 'string'));
  if (visibleSymbols.length !== quoteResponse.symbols.length) throw new Error('XM quote response contains invalid symbol data.');
  const exactSymbols = new Map<string, string>();
  const quotes: MarketQuote[] = [];
  const candles = new Map<string, Candle[]>();
  for (const instrument of SUPPORTED_INSTRUMENTS) {
    const exactSymbol = cached?.exactSymbols.get(instrument.symbol)
      || resolveExactXMSymbol(instrument.symbol, visibleSymbols);
    if (!exactSymbol) continue;
    if (!visibleSymbols.some(item => item.symbol === exactSymbol)) throw new Error(`XM no longer reports the mapped symbol ${exactSymbol}.`);
    const symbol = visibleSymbols.find(item => item.symbol === exactSymbol)!;
    const barsCached = !refreshHistory && cached?.exactSymbols.get(instrument.symbol) === exactSymbol
      ? cached.candles.get(instrument.symbol)
      : undefined;
    let bars: Candle[];
    try {
      const history = barsCached ? null : await invoke<unknown>('mt5_connector_request', {
        request: { action: 'candle_history', symbol: exactSymbol, timeframe: 'M15', count: 300 }
      });
      bars = barsCached || parseCandleHistory(history, exactSymbol);
    } catch {
      continue;
    }
    exactSymbols.set(instrument.symbol, exactSymbol);
    candles.set(instrument.symbol, bars);
    if (!finite(symbol.bid) || !finite(symbol.ask) || symbol.bid <= 0 || symbol.ask < symbol.bid) continue;
    const timestamp = Date.parse(symbol.tick_timestamp_utc || symbol.received_at_utc);
    const isFresh = symbol.freshness === 'FRESH' && Number.isFinite(timestamp) && Date.now() - timestamp <= 15000 && Date.now() >= timestamp;
    const recent = bars.slice(-96);
    const last = recent[recent.length - 1];
    const first = recent[0];
    const quote: MarketQuote = {
      symbol: instrument.symbol,
      bid: symbol.bid,
      ask: symbol.ask,
      last: (symbol.bid + symbol.ask) / 2,
      spreadPips: (symbol.ask - symbol.bid) * instrument.pipMultiplier,
      high24h: Math.max(...recent.map(bar => bar.high)),
      low24h: Math.min(...recent.map(bar => bar.low)),
      volume24h: recent.reduce((total, bar) => total + bar.volume, 0),
      change24hPercent: first.open > 0 ? ((last.close - first.open) / first.open) * 100 : 0,
      digits: symbol.digits,
      pipMultiplier: instrument.pipMultiplier,
      provider: `XM MT5 · ${exactSymbol}`,
      timestamp: timestamp,
      freshness: isFresh ? 'broker' : 'stale',
      latencyMs: Math.max(0, symbol.tick_age_ms ?? 999999),
      isStale: !isFresh
    };
    quotes.push(quote);
  }
  if (!quotes.length) throw new Error('No unambiguous supported XM symbols with fresh quotes and sufficient history were found.');
  return { quotes, candles, exactSymbols, accountMode };
};

export const loadXMReconciliation = async (): Promise<XMReconciliation> => {
  if (!isTauri()) throw new Error('XM reconciliation is available only in the installed desktop application.');
  const value: unknown = await invoke('mt5_connector_request', { request: { action: 'reconciliation' } });
  if (!record(value) || value.order_submission !== false || value.complete !== true
    || !record(value.account) || !isValidTimestamp(value.observed_at_utc)
    || !['DEMO', 'LIVE'].includes(String(value.account.account_mode))
    || !['open_positions', 'open_orders', 'history_orders_30d', 'deals_30d'].every(key => Array.isArray(value[key]) && (value[key] as unknown[]).every(record))) {
    throw new Error('XM reconciliation is incomplete or invalid; broker state must not be assumed.');
  }
  return value as unknown as XMReconciliation;
};

const isValidTimestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
