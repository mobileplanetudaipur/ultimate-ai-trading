import { Candle, FeedFreshness, MarketQuote, OperatingMode } from '../types/trading';

export interface InstrumentConfig {
  symbol: string;
  name: string;
  basePrice: number;
  digits: number;
  pipMultiplier: number;
  typicalSpreadPips: number;
  volatilityPerTick: number;
  contractSize: number;
}

export const SUPPORTED_INSTRUMENTS: InstrumentConfig[] = [
  {
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    basePrice: 1.0850,
    digits: 5,
    pipMultiplier: 10000,
    typicalSpreadPips: 1.2,
    volatilityPerTick: 0.00015,
    contractSize: 100000
  },
  {
    symbol: 'GBP/USD',
    name: 'British Pound / US Dollar',
    basePrice: 1.2940,
    digits: 5,
    pipMultiplier: 10000,
    typicalSpreadPips: 1.6,
    volatilityPerTick: 0.00022,
    contractSize: 100000
  },
  {
    symbol: 'USD/JPY',
    name: 'US Dollar / Japanese Yen',
    basePrice: 152.40,
    digits: 3,
    pipMultiplier: 100,
    typicalSpreadPips: 1.5,
    volatilityPerTick: 0.035,
    contractSize: 100000
  },
  {
    symbol: 'XAU/USD',
    name: 'Gold / US Dollar',
    basePrice: 2650.50,
    digits: 2,
    pipMultiplier: 10,
    typicalSpreadPips: 2.8,
    volatilityPerTick: 0.45,
    contractSize: 100 // 100 oz per lot
  },
  {
    symbol: 'BTC/USD',
    name: 'Bitcoin / US Dollar',
    basePrice: 87400.00,
    digits: 2,
    pipMultiplier: 1,
    typicalSpreadPips: 4.5,
    volatilityPerTick: 15.0,
    contractSize: 1 // 1 BTC per lot
  }
];

export class MarketDataService {
  private quotes: Map<string, MarketQuote> = new Map();
  private candles: Map<string, Candle[]> = new Map();
  private listeners: Set<(quote: MarketQuote) => void> = new Set();
  private intervalId: any = null;
  private isDegraded: boolean = false;
  private isOffline: boolean = false;
  private currentMode: OperatingMode = 'simulated';
  private brokerFeedActive = false;

  constructor() {
    this.initializeData();
  }

  public setOperatingMode(mode: OperatingMode) {
    this.currentMode = mode;
    this.updateFreshnessState();
  }

  public setBrokerFeedActive(active: boolean) {
    this.brokerFeedActive = active;
    if (active) {
      this.quotes.clear();
      this.candles.clear();
    }
  }

  public replaceBrokerData(quotes: MarketQuote[], candles: Map<string, Candle[]>) {
    this.brokerFeedActive = true;
    this.quotes = new Map(quotes.map(quote => [quote.symbol, quote]));
    this.candles = new Map(candles);
    for (const quote of quotes) this.notifyListeners(quote);
  }

  public setDegradedState(degraded: boolean) {
    this.isDegraded = degraded;
    this.updateFreshnessState();
  }

  public setOfflineState(offline: boolean) {
    this.isOffline = offline;
    this.updateFreshnessState();
  }

  private updateFreshnessState() {
    // STRICT TRUTH: Never claim broker-confirmed when generating local data
    const freshness: FeedFreshness = this.isOffline || this.currentMode === 'disconnected'
      ? 'unavailable'
      : this.isDegraded
      ? 'stale'
      : 'simulated';

    for (const [symbol, quote] of this.quotes.entries()) {
      if (this.brokerFeedActive) {
        const updatedQuote: MarketQuote = {
          ...quote,
          freshness: this.currentMode === 'disconnected' || this.isOffline ? 'unavailable' : quote.freshness,
          isStale: this.currentMode === 'disconnected' || this.isOffline || quote.isStale
        };
        this.quotes.set(symbol, updatedQuote);
        this.notifyListeners(updatedQuote);
        continue;
      }
      const updatedQuote: MarketQuote = {
        ...quote,
        freshness,
        isStale: this.isDegraded || this.isOffline || this.currentMode === 'disconnected',
        latencyMs: this.isDegraded ? 850 : this.isOffline ? 9999 : Math.floor(Math.random() * 20) + 10
      };
      this.quotes.set(symbol, updatedQuote);
      this.notifyListeners(updatedQuote);
    }
  }

  private initializeData() {
    const now = Date.now();
    for (const inst of SUPPORTED_INSTRUMENTS) {
      const instCandles: Candle[] = [];
      let currentPrice = inst.basePrice;
      const intervalMs = 15 * 60 * 1000;

      for (let i = 96; i >= 0; i--) {
        const time = now - i * intervalMs;
        const change = (Math.random() - 0.49) * (inst.volatilityPerTick * 8);
        const open = currentPrice;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * (inst.volatilityPerTick * 4);
        const low = Math.min(open, close) - Math.random() * (inst.volatilityPerTick * 4);
        const volume = Math.floor(Math.random() * 500) + 120;

        instCandles.push({
          time,
          open: Number(open.toFixed(inst.digits)),
          high: Number(high.toFixed(inst.digits)),
          low: Number(low.toFixed(inst.digits)),
          close: Number(close.toFixed(inst.digits)),
          volume
        });
        currentPrice = close;
      }

      this.candles.set(inst.symbol, instCandles);

      const lastCandle = instCandles[instCandles.length - 1];
      const recent24h = instCandles.slice(-96);
      const spreadPips = inst.typicalSpreadPips;
      const halfSpread = (spreadPips / inst.pipMultiplier) / 2;
      const bid = lastCandle.close - halfSpread;
      const ask = lastCandle.close + halfSpread;

      const initialQuote: MarketQuote = {
        symbol: inst.symbol,
        bid: Number(bid.toFixed(inst.digits)),
        ask: Number(ask.toFixed(inst.digits)),
        spreadPips,
        last: lastCandle.close,
        high24h: Math.max(...instCandles.map(c => c.high)),
        low24h: Math.min(...instCandles.map(c => c.low)),
        volume24h: recent24h.reduce((sum, c) => sum + c.volume, 0),
        change24hPercent: Number((((lastCandle.close - instCandles[0].open) / instCandles[0].open) * 100).toFixed(2)),
        digits: inst.digits,
        pipMultiplier: inst.pipMultiplier,
        provider: 'Local In-Memory Simulation (Paper Engine)',
        timestamp: now,
        freshness: 'simulated',
        latencyMs: 14,
        isStale: false
      };

      this.quotes.set(inst.symbol, initialQuote);
    }
  }

  public startTickStream() {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      if (this.brokerFeedActive) return;
      if (this.isOffline || this.currentMode === 'disconnected') return;

      const randomIndex = Math.floor(Math.random() * SUPPORTED_INSTRUMENTS.length);
      const inst = SUPPORTED_INSTRUMENTS[randomIndex];
      const currentQuote = this.quotes.get(inst.symbol);
      const candlesList = this.candles.get(inst.symbol);

      if (!currentQuote || !candlesList) return;

      const drift = (Math.random() - 0.495) * inst.volatilityPerTick;
      const newLast = Number((currentQuote.last + drift).toFixed(inst.digits));

      let currentSpread = inst.typicalSpreadPips;
      if (this.isDegraded) {
        currentSpread = inst.typicalSpreadPips * 3.5;
      } else if (Math.random() < 0.15) {
        currentSpread = Number((inst.typicalSpreadPips * (1 + Math.random() * 0.3)).toFixed(1));
      }

      const halfSpread = (currentSpread / inst.pipMultiplier) / 2;
      const newBid = Number((newLast - halfSpread).toFixed(inst.digits));
      const newAsk = Number((newLast + halfSpread).toFixed(inst.digits));

      const updatedQuote: MarketQuote = {
        ...currentQuote,
        bid: newBid,
        ask: newAsk,
        last: newLast,
        spreadPips: currentSpread,
        timestamp: Date.now(),
        latencyMs: this.isDegraded ? 720 : Math.floor(Math.random() * 15) + 8
      };

      this.quotes.set(inst.symbol, updatedQuote);

      const lastCandle = candlesList[candlesList.length - 1];
      if (lastCandle) {
        lastCandle.close = newLast;
        if (newLast > lastCandle.high) lastCandle.high = newLast;
        if (newLast < lastCandle.low) lastCandle.low = newLast;
        lastCandle.volume += Math.floor(Math.random() * 4) + 1;
      }

      this.notifyListeners(updatedQuote);
    }, 1200);
  }

  public stopTickStream() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public subscribe(listener: (quote: MarketQuote) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(quote: MarketQuote) {
    for (const listener of this.listeners) {
      listener(quote);
    }
  }

  public getQuote(symbol: string): MarketQuote | undefined {
    return this.quotes.get(symbol);
  }

  public getAllQuotes(): MarketQuote[] {
    return Array.from(this.quotes.values());
  }

  public getCandles(symbol: string): Candle[] {
    return this.candles.get(symbol) || [];
  }
}

export const marketDataService = new MarketDataService();
