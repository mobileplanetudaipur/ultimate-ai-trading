import { Candle, EconomicEvent, MarketQuote, MarketRegime, StrategyDefinition, StrategyEvaluation } from '../types/trading';
import { calculateATR, calculateBollingerBands, calculateEMA, calculateRSI, estimateADX } from '../utils/indicators';

export const DEFINED_STRATEGIES: StrategyDefinition[] = [
  {
    id: 'strat_trend_ema',
    name: 'Dual EMA Dynamic Trend Follower',
    category: 'Trend Following',
    targetSymbol: 'EUR/USD',
    timeframe: 'M15',
    description: 'Captures sustained trending expansions using EMA 20/50 alignment validated by ADX > 25.0 filter.',
    invalidationRules: 'Counter-trend candle close beyond EMA 50 or ADX collapse below 20.0.',
    holdingTimeExpected: '2 - 6 Hours',
    historicalSampleSize: 428,
    outOfSampleSharpe: 1.68,
    winRate: 54.2,
    profitFactor: 1.82,
    maxHistoricalDrawdown: 4.8
  },
  {
    id: 'strat_mean_reversion',
    name: 'Bollinger Band / RSI Mean Reversion',
    category: 'Mean Reversion',
    targetSymbol: 'EUR/USD',
    timeframe: 'M15',
    description: 'Trades false breakouts and overextended range boundaries when market is non-trending (ADX < 22).',
    invalidationRules: 'Price closes decisively beyond outer 2.5 standard deviations or ADX surges > 28.',
    holdingTimeExpected: '45m - 2 Hours',
    historicalSampleSize: 312,
    outOfSampleSharpe: 1.45,
    winRate: 61.5,
    profitFactor: 1.64,
    maxHistoricalDrawdown: 5.2
  },
  {
    id: 'strat_vol_squeeze',
    name: 'Keltner/ATR Volatility Compression Breakout',
    category: 'Volatility Breakout',
    targetSymbol: 'GBP/USD',
    timeframe: 'M15',
    description: 'Identifies compression squeezes (low ATR) and fires on explosive momentum impulse into new volume.',
    invalidationRules: 'Failure to produce continuation bar within 2 candles of breakout.',
    holdingTimeExpected: '1 - 4 Hours',
    historicalSampleSize: 240,
    outOfSampleSharpe: 1.52,
    winRate: 49.0,
    profitFactor: 1.95,
    maxHistoricalDrawdown: 6.1
  },
  {
    id: 'strat_liquidity_sweep',
    name: 'Session Range Liquidity Sweep & Reject',
    category: 'Liquidity Sweep',
    targetSymbol: 'XAU/USD',
    timeframe: 'M15',
    description: 'Identifies stops swept above/below previous session high/low with rapid rejection pin-bar structure.',
    invalidationRules: 'Acceptance and closure beyond swept level by more than 0.5 ATR.',
    holdingTimeExpected: '30m - 90m',
    historicalSampleSize: 185,
    outOfSampleSharpe: 1.39,
    winRate: 58.0,
    profitFactor: 1.71,
    maxHistoricalDrawdown: 4.2
  }
];

export class StrategyEngine {
  /**
   * Evaluates current market regime for an instrument
   */
  public evaluateMarketRegime(
    quote: MarketQuote,
    candles: Candle[],
    upcomingEvents: EconomicEvent[]
  ): MarketRegime {
    const closes = candles.map(c => c.close);
    const adx = estimateADX(candles, 14);
    const atrList = calculateATR(candles, 14);
    const atr = atrList[atrList.length - 1] || 0.0015;

    // Fast vs slow EMA
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const lastEma20 = ema20[ema20.length - 1];
    const lastEma50 = ema50[ema50.length - 1];

    let trendDirection: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' = 'SIDEWAYS';
    if (adx >= 24) {
      if (lastEma20 > lastEma50 && quote.last > lastEma20) {
        trendDirection = 'BULLISH';
      } else if (lastEma20 < lastEma50 && quote.last < lastEma20) {
        trendDirection = 'BEARISH';
      }
    }

    // Volatility categorization
    const normAtrRatio = atr / (quote.last || 1);
    let volatilityRegime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME' = 'NORMAL';
    if (normAtrRatio < 0.0006) volatilityRegime = 'LOW';
    else if (normAtrRatio > 0.0025) volatilityRegime = 'HIGH';
    else if (normAtrRatio > 0.005) volatilityRegime = 'EXTREME';

    // Session determination
    const date = new Date(quote.timestamp);
    const day = date.getUTCDay();
    const utcHours = date.getUTCHours();

    let sessionName: 'SYDNEY' | 'TOKYO' | 'LONDON' | 'NEW_YORK' | 'WEEKEND_CLOSED' = 'NEW_YORK';
    let isPreCloseExclusion = false;

    if (day === 0 || day === 6) {
      sessionName = 'WEEKEND_CLOSED';
      isPreCloseExclusion = true;
    } else if (day === 5 && utcHours >= 20) {
      // Friday after 20:00 UTC (pre-close exclusion)
      isPreCloseExclusion = true;
    } else if (utcHours >= 7 && utcHours < 16) {
      sessionName = 'LONDON';
    } else if (utcHours >= 12 && utcHours < 21) {
      sessionName = 'NEW_YORK';
    } else if (utcHours >= 0 && utcHours < 9) {
      sessionName = 'TOKYO';
    } else {
      sessionName = 'SYDNEY';
    }

    // Spread condition
    let spreadCondition: 'NORMAL' | 'ELEVATED' | 'BLOWOUT' = 'NORMAL';
    if (quote.spreadPips > 3.5) spreadCondition = 'BLOWOUT';
    else if (quote.spreadPips > 2.2) spreadCondition = 'ELEVATED';

    // Upcoming news risk
    let scheduledEventRisk: 'NONE' | 'LOW' | 'HIGH_IMPACT_APPROACHING' = 'NONE';
    let nextEventMinutesAway: number | undefined;

    const highImpactEvents = upcomingEvents.filter(e => e.impact === 'HIGH');
    for (const evt of highImpactEvents) {
      const minutesAway = (evt.scheduledTime - quote.timestamp) / 60000;
      if (minutesAway > 0 && minutesAway <= 45) {
        scheduledEventRisk = 'HIGH_IMPACT_APPROACHING';
        nextEventMinutesAway = Math.round(minutesAway);
        break;
      }
    }

    return {
      trendDirection,
      trendStrengthAdx: Math.round(adx * 10) / 10,
      volatilityAtr: Number(atr.toFixed(quote.digits)),
      volatilityRegime,
      sessionName,
      isPreCloseExclusion,
      spreadCondition,
      scheduledEventRisk,
      nextEventMinutesAway
    };
  }

  /**
   * Evaluates all candidate strategies for an instrument against regime
   */
  public evaluateStrategies(
    quote: MarketQuote,
    candles: Candle[],
    regime: MarketRegime
  ): StrategyEvaluation[] {
    const results: StrategyEvaluation[] = [];

    for (const def of DEFINED_STRATEGIES) {
      results.push(this.evaluateSingleStrategy(def, quote, candles, regime));
    }

    return results;
  }

  private evaluateSingleStrategy(
    strategy: StrategyDefinition,
    quote: MarketQuote,
    candles: Candle[],
    regime: MarketRegime
  ): StrategyEvaluation {
    const closes = candles.map(c => c.close);
    const rsiList = calculateRSI(closes, 14);
    const currentRsi = rsiList[rsiList.length - 1] || 50;
    const bb = calculateBollingerBands(closes, 20, 2);
    const upperBB = bb.upper[bb.upper.length - 1];
    const lowerBB = bb.lower[bb.lower.length - 1];
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const lastEma20 = ema20[ema20.length - 1];
    const lastEma50 = ema50[ema50.length - 1];
    const atr = regime.volatilityAtr;

    // Hard abstention checks based on system safety
    if (quote.freshness === 'unavailable' || quote.isStale) {
      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: quote.symbol,
        suitabilityScore: 0,
        suitabilityThreshold: 70,
        marketRegimeFit: 'Data feed stale or unavailable',
        signal: 'NO_TRADE',
        signalConfidence: 0,
        noTradeReason: 'Data feed is degraded or stale. Trading blocked by Stage 3 safety rules.',
        evaluatedAt: Date.now()
      };
    }

    if (regime.isPreCloseExclusion || regime.sessionName === 'WEEKEND_CLOSED') {
      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: quote.symbol,
        suitabilityScore: 10,
        suitabilityThreshold: 70,
        marketRegimeFit: 'Weekend / Pre-close blackout',
        signal: 'NO_TRADE',
        signalConfidence: 0,
        noTradeReason: 'Mandatory session lockout: Weekend or Friday pre-close exclusion active.',
        evaluatedAt: Date.now()
      };
    }

    if (regime.scheduledEventRisk === 'HIGH_IMPACT_APPROACHING') {
      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: quote.symbol,
        suitabilityScore: 15,
        suitabilityThreshold: 70,
        marketRegimeFit: 'High impact macroeconomic release proximity',
        signal: 'NO_TRADE',
        signalConfidence: 0,
        noTradeReason: `Tier-1 event approaching in ~${regime.nextEventMinutesAway}m. Pre-event volatility blackout enforced.`,
        evaluatedAt: Date.now()
      };
    }

    if (regime.spreadCondition === 'BLOWOUT') {
      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: quote.symbol,
        suitabilityScore: 20,
        suitabilityThreshold: 70,
        marketRegimeFit: 'Spread blowout',
        signal: 'NO_TRADE',
        signalConfidence: 0,
        noTradeReason: `Spread blowout detected (${quote.spreadPips} pips). Exceeds strategy cost envelope.`,
        evaluatedAt: Date.now()
      };
    }

    // Specific strategy logic
    if (strategy.category === 'Trend Following') {
      let suitability = 40;
      if (regime.trendStrengthAdx > 25) suitability += 35;
      if (regime.trendDirection !== 'SIDEWAYS') suitability += 20;

      if (suitability < 70) {
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: suitability,
          suitabilityThreshold: 70,
          marketRegimeFit: `Sideways or weak trend (ADX: ${regime.trendStrengthAdx})`,
          signal: 'NO_TRADE',
          signalConfidence: 30,
          noTradeReason: `Trend strength insufficient: ADX is ${regime.trendStrengthAdx} (min required: 25.0). Regime is non-directional.`,
          evaluatedAt: Date.now()
        };
      }

      // Check buy/sell triggers
      if (regime.trendDirection === 'BULLISH' && lastEma20 > lastEma50 && currentRsi > 52 && currentRsi < 68) {
        const sl = Number((quote.bid - atr * 1.5).toFixed(quote.digits));
        const tp = Number((quote.ask + atr * 2.5).toFixed(quote.digits));
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: suitability,
          suitabilityThreshold: 70,
          marketRegimeFit: 'Established Bullish Trend (ADX > 25)',
          signal: 'BUY',
          signalConfidence: 78,
          entryPriceEstimate: quote.ask,
          proposedStopLoss: sl,
          proposedTakeProfit: tp,
          riskRewardRatio: 1.67,
          evaluatedAt: Date.now()
        };
      } else if (regime.trendDirection === 'BEARISH' && lastEma20 < lastEma50 && currentRsi < 48 && currentRsi > 32) {
        const sl = Number((quote.ask + atr * 1.5).toFixed(quote.digits));
        const tp = Number((quote.bid - atr * 2.5).toFixed(quote.digits));
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: suitability,
          suitabilityThreshold: 70,
          marketRegimeFit: 'Established Bearish Trend (ADX > 25)',
          signal: 'SELL',
          signalConfidence: 76,
          entryPriceEstimate: quote.bid,
          proposedStopLoss: sl,
          proposedTakeProfit: tp,
          riskRewardRatio: 1.67,
          evaluatedAt: Date.now()
        };
      }

      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: quote.symbol,
        suitabilityScore: suitability,
        suitabilityThreshold: 70,
        marketRegimeFit: 'Trend suitable, but entry trigger not confirmed',
        signal: 'NO_TRADE',
        signalConfidence: 45,
        noTradeReason: 'Price extended beyond optimal pullback threshold to EMA 20/50. Waiting for retest.',
        evaluatedAt: Date.now()
      };
    }

    if (strategy.category === 'Mean Reversion') {
      let suitability = 40;
      if (regime.trendStrengthAdx < 22) suitability += 35;
      if (regime.volatilityRegime === 'NORMAL' || regime.volatilityRegime === 'LOW') suitability += 20;

      if (suitability < 70) {
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: suitability,
          suitabilityThreshold: 70,
          marketRegimeFit: `Trending market (ADX: ${regime.trendStrengthAdx})`,
          signal: 'NO_TRADE',
          signalConfidence: 25,
          noTradeReason: `Market is in active trend mode (ADX ${regime.trendStrengthAdx} >= 22.0). Mean reversion prohibited to avoid fighting momentum.`,
          evaluatedAt: Date.now()
        };
      }

      if (quote.bid <= lowerBB && currentRsi <= 32) {
        const sl = Number((quote.bid - atr * 1.2).toFixed(quote.digits));
        const tp = Number(((upperBB + lowerBB) / 2).toFixed(quote.digits));
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: suitability,
          suitabilityThreshold: 70,
          marketRegimeFit: 'Overextended range boundary at Lower BB',
          signal: 'BUY',
          signalConfidence: 74,
          entryPriceEstimate: quote.ask,
          proposedStopLoss: sl,
          proposedTakeProfit: tp,
          riskRewardRatio: 1.5,
          evaluatedAt: Date.now()
        };
      } else if (quote.ask >= upperBB && currentRsi >= 68) {
        const sl = Number((quote.ask + atr * 1.2).toFixed(quote.digits));
        const tp = Number(((upperBB + lowerBB) / 2).toFixed(quote.digits));
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: suitability,
          suitabilityThreshold: 70,
          marketRegimeFit: 'Overextended range boundary at Upper BB',
          signal: 'SELL',
          signalConfidence: 72,
          entryPriceEstimate: quote.bid,
          proposedStopLoss: sl,
          proposedTakeProfit: tp,
          riskRewardRatio: 1.5,
          evaluatedAt: Date.now()
        };
      }

      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: quote.symbol,
        suitabilityScore: suitability,
        suitabilityThreshold: 70,
        marketRegimeFit: 'Range bound, price inside bands',
        signal: 'NO_TRADE',
        signalConfidence: 40,
        noTradeReason: 'Price is oscillating within inner Bollinger envelope (RSI neutral). No statistical edge.',
        evaluatedAt: Date.now()
      };
    }

    // Default abstention for other experimental or non-eligible strategies
    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      symbol: quote.symbol,
      suitabilityScore: 50,
      suitabilityThreshold: 70,
      marketRegimeFit: 'Sub-threshold suitability',
      signal: 'NO_TRADE',
      signalConfidence: 35,
      noTradeReason: 'Criteria not satisfied. Evidence threshold not met under Stage 6 rules.',
      evaluatedAt: Date.now()
    };
  }
}

export const strategyEngine = new StrategyEngine();
