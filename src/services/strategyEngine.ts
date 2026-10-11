import { Candle, EconomicEvent, MarketQuote, MarketRegime, StrategyDefinition, StrategyEvaluation } from '../types/trading';
import { calculateATR, calculateBollingerBands, calculateEMA, calculateRSI, estimateADX } from '../utils/indicators';

export const DEFINED_STRATEGIES: StrategyDefinition[] = [
  {
    id: 'strat_btc_trend_m15',
    name: 'BTC/USD M15 EMA 50/200 Trend with ADX & ATR Stop',
    category: 'Trend Following',
    targetSymbol: 'BTC/USD',
    timeframes: ['M15', 'H1'],
    description: 'Disciplined crypto momentum trend follower: requires EMA 50 > EMA 200 alignment, ADX > 25.0 filter, and dynamic 1.8x ATR stop loss.',
    invalidationRules: 'M15 candle close crossing EMA 200 or ADX momentum collapsing below 20.0.',
    holdingTimeExpected: '2 - 8 Hours',
    researchStatus: 'HYPOTHESIS_PENDING_OUT_OF_SAMPLE',
    baselineEvidenceNote: 'Untested strategy hypothesis. No out-of-sample market-data results are available.'
  },
  {
    id: 'strat_mtf_expansion',
    name: 'Multi-Timeframe Trend Alignment (M5 / M15 / H1)',
    category: 'Multi-Timeframe',
    targetSymbol: 'EUR/USD',
    timeframes: ['M5', 'M15', 'H1'],
    description: 'Requires higher-timeframe directional agreement: H1 structural bias confirmed before executing M15 pullback entries.',
    invalidationRules: 'Counter-trend close on H1 or RSI divergent exhaustion.',
    holdingTimeExpected: '1 - 4 Hours',
    researchStatus: 'HYPOTHESIS_PENDING_OUT_OF_SAMPLE',
    baselineEvidenceNote: 'Untested strategy hypothesis. Verified multi-timeframe candles are unavailable.'
  },
  {
    id: 'strat_donchian_breakout',
    name: 'Donchian 20-Period Volatility Breakout',
    category: 'Breakout',
    targetSymbol: 'GBP/USD',
    timeframes: ['M15'],
    description: 'Monitors 20-period highest high and lowest low channels; fires when price breaches channel boundary following volatility compression.',
    invalidationRules: 'False breakout with immediate re-entry back below median 20-channel within 2 bars.',
    holdingTimeExpected: '1 - 6 Hours',
    researchStatus: 'HYPOTHESIS_PENDING_OUT_OF_SAMPLE',
    baselineEvidenceNote: 'Untested strategy hypothesis. Susceptible to chop in range-bound regimes.'
  },
  {
    id: 'strat_xau_liquidity_sweep',
    name: 'XAU/USD Gold Session High/Low Sweep & Reclaim',
    category: 'Liquidity Sweep',
    targetSymbol: 'XAU/USD',
    timeframes: ['M5', 'M15'],
    description: 'Monitors previous session/day liquidity extremes on Gold; enters on swept level rejection followed by closed candle reclaim.',
    invalidationRules: 'Decisive continuation close beyond swept extreme by > 0.5 ATR.',
    holdingTimeExpected: '30m - 90m',
    researchStatus: 'HYPOTHESIS_PENDING_OUT_OF_SAMPLE',
    baselineEvidenceNote: 'Untested strategy hypothesis. Stop-loss required; broker session and gap behavior are unverified.'
  },
  {
    id: 'strat_bb_mean_reversion',
    name: 'Bollinger Band 2σ Mean Reversion with RSI Filter',
    category: 'Mean Reversion',
    targetSymbol: 'EUR/USD',
    timeframes: ['M15', 'H1'],
    description: 'Enters on band exhaustion when 20-period 2σ envelope is pierced and RSI diverges (< 32 for oversold buy, > 68 for overbought sell) with median band mean-reversion target.',
    invalidationRules: 'Band walk expansion where ADX exceeds 25 or candle closes outside 2.5σ channel.',
    holdingTimeExpected: '45m - 3 Hours',
    researchStatus: 'HYPOTHESIS_PENDING_OUT_OF_SAMPLE',
    baselineEvidenceNote: 'Untested strategy hypothesis. Requires a range-bound / low-ADX filter (< 25).'
  },
  {
    id: 'strat_session_open_breakout',
    name: 'London / NY Opening Range Breakout (ORB)',
    category: 'Breakout',
    targetSymbol: 'GBP/USD',
    timeframes: ['M5', 'M15'],
    description: 'Measures initial balance consolidation range during London or NY session opens; enters in direction of range break with 1.2x ATR stop.',
    invalidationRules: 'Re-entry back inside 50% median of the initial balance range within 2 candles.',
    holdingTimeExpected: '1 - 3 Hours',
    researchStatus: 'HYPOTHESIS_PENDING_OUT_OF_SAMPLE',
    baselineEvidenceNote: 'Untested strategy hypothesis. Session hours are not broker-verified.'
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

    const normAtrRatio = atr / (quote.last || 1);
    let volatilityRegime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME' = 'NORMAL';
    if (normAtrRatio < 0.0006) volatilityRegime = 'LOW';
    else if (normAtrRatio > 0.005) volatilityRegime = 'EXTREME';
    else if (normAtrRatio > 0.0025) volatilityRegime = 'HIGH';

    const date = new Date(quote.timestamp);
    const day = date.getUTCDay();
    const utcHours = date.getUTCHours();

    let sessionName: 'SYDNEY' | 'TOKYO' | 'LONDON' | 'NEW_YORK' | 'WEEKEND_CLOSED' = 'NEW_YORK';
    let isPreCloseExclusion = false;

    if (day === 0 || day === 6) {
      sessionName = 'WEEKEND_CLOSED';
      isPreCloseExclusion = true;
    } else if (day === 5 && utcHours >= 20) {
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

    let spreadCondition: 'NORMAL' | 'ELEVATED' | 'BLOWOUT' = 'NORMAL';
    if (quote.spreadPips > 3.8) spreadCondition = 'BLOWOUT';
    else if (quote.spreadPips > 2.4) spreadCondition = 'ELEVATED';

    let scheduledEventRisk: 'NONE' | 'LOW' | 'HIGH_IMPACT_APPROACHING' = 'NONE';
    let nextEventMinutesAway: number | undefined;

    const quoteCurrencies = quote.symbol.split('/');
    const highImpactEvents = upcomingEvents.filter(e =>
      e.impact === 'HIGH' && quoteCurrencies.includes(e.currency)
    );
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
    const atr = regime.volatilityAtr;

    // Safety checks: hard abstention
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
        noTradeReason: 'Data feed is degraded or stale. Safety gate enforcing NO TRADE.',
        evaluatedAt: Date.now()
      };
    }

    if (strategy.targetSymbol !== quote.symbol) {
      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: quote.symbol,
        suitabilityScore: 0,
        suitabilityThreshold: 70,
        marketRegimeFit: `Ineligible instrument (${quote.symbol})`,
        signal: 'NO_TRADE',
        signalConfidence: 0,
        noTradeReason: `Strategy is configured for ${strategy.targetSymbol}, not ${quote.symbol}.`,
        evaluatedAt: Date.now()
      };
    }

    if (strategy.timeframes.length > 1) {
      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: quote.symbol,
        suitabilityScore: 0,
        suitabilityThreshold: 70,
        marketRegimeFit: 'Required timeframes not jointly evaluated',
        signal: 'NO_TRADE',
        signalConfidence: 0,
        noTradeReason: `This strategy requires ${strategy.timeframes.join('/')} validation; the current evaluator only receives one candle series.`,
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
        marketRegimeFit: 'Weekend / Pre-close exclusion window',
        signal: 'NO_TRADE',
        signalConfidence: 0,
        noTradeReason: 'Mandatory trading session lockout: Weekend or Friday pre-close exclusion active.',
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
        marketRegimeFit: 'Macroeconomic news blackout active',
        signal: 'NO_TRADE',
        signalConfidence: 0,
        noTradeReason: `Tier-1 event approaching in ~${regime.nextEventMinutesAway}m. Pre-event blackout enforced.`,
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
        marketRegimeFit: 'Spread blowout condition',
        signal: 'NO_TRADE',
        signalConfidence: 0,
        noTradeReason: `Spread blowout detected (${quote.spreadPips} pips). Exceeds execution risk allowance.`,
        evaluatedAt: Date.now()
      };
    }

    // 1. BTC M15 Trend Following (EMA 50/200 + ADX + ATR stops)
    if (strategy.id === 'strat_btc_trend_m15') {
      if (quote.symbol !== 'BTC/USD') {
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: 0,
          suitabilityThreshold: 70,
          marketRegimeFit: `Ineligible instrument (${quote.symbol})`,
          signal: 'NO_TRADE',
          signalConfidence: 0,
          noTradeReason: 'Strategy specifically configured for BTC/USD M15 trend characteristics.',
          evaluatedAt: Date.now()
        };
      }

      const ema50 = calculateEMA(closes, 50);
      const ema200 = calculateEMA(closes, Math.min(closes.length, 75)); // approximate longer baseline
      const lastEma50 = ema50[ema50.length - 1];
      const lastEma200 = ema200[ema200.length - 1];

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
          noTradeReason: `ADX is ${regime.trendStrengthAdx} (min required: 25.0). Non-directional regime, abstaining.`,
          evaluatedAt: Date.now()
        };
      }

      if (lastEma50 > lastEma200 && quote.last > lastEma50 && currentRsi > 52 && currentRsi < 68) {
        const slDistance = atr * 1.8;
        const sl = Number((quote.bid - slDistance).toFixed(quote.digits));
        const tp = Number((quote.ask + slDistance * 2.2).toFixed(quote.digits));
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: suitability,
          suitabilityThreshold: 70,
          marketRegimeFit: 'Bullish Trend Confirmed (EMA 50 > 200, ADX > 25)',
          signal: 'BUY',
          signalConfidence: 76,
          entryPriceEstimate: quote.ask,
          proposedStopLoss: sl,
          proposedTakeProfit: tp,
          riskRewardRatio: 2.2,
          evaluatedAt: Date.now()
        };
      } else if (lastEma50 < lastEma200 && quote.last < lastEma50 && currentRsi < 48 && currentRsi > 32) {
        const slDistance = atr * 1.8;
        const sl = Number((quote.ask + slDistance).toFixed(quote.digits));
        const tp = Number((quote.bid - slDistance * 2.2).toFixed(quote.digits));
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: suitability,
          suitabilityThreshold: 70,
          marketRegimeFit: 'Bearish Trend Confirmed (EMA 50 < 200, ADX > 25)',
          signal: 'SELL',
          signalConfidence: 75,
          entryPriceEstimate: quote.bid,
          proposedStopLoss: sl,
          proposedTakeProfit: tp,
          riskRewardRatio: 2.2,
          evaluatedAt: Date.now()
        };
      }

      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: quote.symbol,
        suitabilityScore: suitability,
        suitabilityThreshold: 70,
        marketRegimeFit: 'Trend suitable, pullback entry pending',
        signal: 'NO_TRADE',
        signalConfidence: 45,
        noTradeReason: 'Waiting for pullback to EMA 50 before entry confirmation.',
        evaluatedAt: Date.now()
      };
    }

    // 2. Multi-Timeframe Expansion (M5 / M15 / H1)
    if (strategy.id === 'strat_mtf_expansion') {
      let suitability = 50;
      if (regime.trendDirection !== 'SIDEWAYS') suitability += 25;
      if (regime.sessionName === 'LONDON' || regime.sessionName === 'NEW_YORK') suitability += 15;

      if (suitability < 70) {
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: suitability,
          suitabilityThreshold: 70,
          marketRegimeFit: 'Off-session or lack of directional expansion',
          signal: 'NO_TRADE',
          signalConfidence: 35,
          noTradeReason: 'High-timeframe structural alignment not established. Waiting for session impulse.',
          evaluatedAt: Date.now()
        };
      }

      if (regime.trendDirection === 'BULLISH' && currentRsi > 54 && currentRsi < 66) {
        const sl = Number((quote.bid - atr * 1.5).toFixed(quote.digits));
        const tp = Number((quote.ask + atr * 2.5).toFixed(quote.digits));
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: suitability,
          suitabilityThreshold: 70,
          marketRegimeFit: 'H1 / M15 Bullish Alignment Confirmed',
          signal: 'BUY',
          signalConfidence: 73,
          entryPriceEstimate: quote.ask,
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
        marketRegimeFit: 'Higher timeframe aligned, awaiting lower timeframe trigger',
        signal: 'NO_TRADE',
        signalConfidence: 40,
        noTradeReason: 'Lower-timeframe M5 confirmation candle not yet closed in trend direction.',
        evaluatedAt: Date.now()
      };
    }

    // 3. Donchian 20 Breakout
    if (strategy.id === 'strat_donchian_breakout') {
      const highest20 = Math.max(...candles.slice(-20).map(c => c.high));
      const lowest20 = Math.min(...candles.slice(-20).map(c => c.low));
      let suitability = 50;
      if (regime.volatilityRegime === 'NORMAL' || regime.volatilityRegime === 'HIGH') suitability += 25;

      if (quote.last >= highest20) {
        const sl = Number((quote.bid - atr * 1.4).toFixed(quote.digits));
        const tp = Number((quote.ask + atr * 2.8).toFixed(quote.digits));
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: 78,
          suitabilityThreshold: 70,
          marketRegimeFit: '20-Period Upper Channel Breakout',
          signal: 'BUY',
          signalConfidence: 75,
          entryPriceEstimate: quote.ask,
          proposedStopLoss: sl,
          proposedTakeProfit: tp,
          riskRewardRatio: 2.0,
          evaluatedAt: Date.now()
        };
      } else if (quote.last <= lowest20) {
        const sl = Number((quote.ask + atr * 1.4).toFixed(quote.digits));
        const tp = Number((quote.bid - atr * 2.8).toFixed(quote.digits));
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: 78,
          suitabilityThreshold: 70,
          marketRegimeFit: '20-Period Lower Channel Breakout',
          signal: 'SELL',
          signalConfidence: 75,
          entryPriceEstimate: quote.bid,
          proposedStopLoss: sl,
          proposedTakeProfit: tp,
          riskRewardRatio: 2.0,
          evaluatedAt: Date.now()
        };
      }

      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: quote.symbol,
        suitabilityScore: suitability,
        suitabilityThreshold: 70,
        marketRegimeFit: 'Price oscillating inside Donchian envelope',
        signal: 'NO_TRADE',
        signalConfidence: 35,
        noTradeReason: 'Price inside 20-period Donchian bounds. Breakout trigger inactive.',
        evaluatedAt: Date.now()
      };
    }

    // 4. Gold Liquidity Sweep & Reclaim
    if (strategy.id === 'strat_xau_liquidity_sweep') {
      if (quote.symbol !== 'XAU/USD') {
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: 0,
          suitabilityThreshold: 70,
          marketRegimeFit: `Ineligible instrument (${quote.symbol})`,
          signal: 'NO_TRADE',
          signalConfidence: 0,
          noTradeReason: 'Strategy calibrated specifically for Gold (XAU/USD) volatility sweeps.',
          evaluatedAt: Date.now()
        };
      }

      const high24 = quote.high24h;
      const low24 = quote.low24h;
      const bb = calculateBollingerBands(closes, 20, 2);
      const lowerBB = bb.lower[bb.lower.length - 1];
      const upperBB = bb.upper[bb.upper.length - 1];

      if (quote.bid <= low24 * 1.0005 && currentRsi <= 35) {
        const sl = Number((quote.bid - atr * 1.2).toFixed(quote.digits));
        const tp = Number(((upperBB + lowerBB) / 2).toFixed(quote.digits));
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: 82,
          suitabilityThreshold: 70,
          marketRegimeFit: 'Prior Session Low Swept with Rejection Reclaim',
          signal: 'BUY',
          signalConfidence: 78,
          entryPriceEstimate: quote.ask,
          proposedStopLoss: sl,
          proposedTakeProfit: tp,
          riskRewardRatio: 1.8,
          evaluatedAt: Date.now()
        };
      }

      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: quote.symbol,
        suitabilityScore: 50,
        suitabilityThreshold: 70,
        marketRegimeFit: 'Session liquidity bounds intact',
        signal: 'NO_TRADE',
        signalConfidence: 30,
        noTradeReason: 'No sweep of prior day high or low detected. Price inside value area.',
        evaluatedAt: Date.now()
      };
    }

    // 5. Bollinger Band Mean Reversion with RSI Divergence Filter
    if (strategy.id === 'strat_bb_mean_reversion') {
      const bb = calculateBollingerBands(closes, 20, 2);
      const lowerBB = bb.lower[bb.lower.length - 1];
      const upperBB = bb.upper[bb.upper.length - 1];
      const middleBB = bb.middle[bb.middle.length - 1];

      // Mean reversion requires non-trending environment (ADX < 25)
      if (regime.trendStrengthAdx >= 25) {
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: 35,
          suitabilityThreshold: 70,
          marketRegimeFit: `Trending regime active (ADX: ${regime.trendStrengthAdx})`,
          signal: 'NO_TRADE',
          signalConfidence: 20,
          noTradeReason: 'Trending momentum detected (ADX >= 25). Mean reversion abstains to prevent counter-trend runaway.',
          evaluatedAt: Date.now()
        };
      }

      let suitability = 72;
      if (regime.volatilityRegime === 'LOW' || regime.volatilityRegime === 'NORMAL') suitability += 15;

      // Oversold bounce trigger: price pierced lower band and RSI is oversold
      if (quote.bid <= lowerBB && currentRsi <= 32) {
        const sl = Number((quote.bid - atr * 1.1).toFixed(quote.digits));
        const tp = Number(middleBB.toFixed(quote.digits));
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: suitability,
          suitabilityThreshold: 70,
          marketRegimeFit: 'Lower Bollinger Band Pierced with RSI Oversold Divergence',
          signal: 'BUY',
          signalConfidence: 74,
          entryPriceEstimate: quote.ask,
          proposedStopLoss: sl,
          proposedTakeProfit: tp,
          riskRewardRatio: 1.8,
          evaluatedAt: Date.now()
        };
      }

      // Overbought pullback trigger: price pierced upper band and RSI is overbought
      if (quote.ask >= upperBB && currentRsi >= 68) {
        const sl = Number((quote.ask + atr * 1.1).toFixed(quote.digits));
        const tp = Number(middleBB.toFixed(quote.digits));
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: suitability,
          suitabilityThreshold: 70,
          marketRegimeFit: 'Upper Bollinger Band Pierced with RSI Overbought Divergence',
          signal: 'SELL',
          signalConfidence: 74,
          entryPriceEstimate: quote.bid,
          proposedStopLoss: sl,
          proposedTakeProfit: tp,
          riskRewardRatio: 1.8,
          evaluatedAt: Date.now()
        };
      }

      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: quote.symbol,
        suitabilityScore: suitability,
        suitabilityThreshold: 70,
        marketRegimeFit: 'Oscillating within 2-sigma band envelope',
        signal: 'NO_TRADE',
        signalConfidence: 35,
        noTradeReason: 'Price inside 2σ bands or RSI not in extreme reversal zone (RSI: ' + currentRsi.toFixed(1) + ').',
        evaluatedAt: Date.now()
      };
    }

    // 6. London / NY Session Open Breakout (ORB)
    if (strategy.id === 'strat_session_open_breakout') {
      const isLiquidSession = regime.sessionName === 'LONDON' || regime.sessionName === 'NEW_YORK';
      if (!isLiquidSession) {
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: 30,
          suitabilityThreshold: 70,
          marketRegimeFit: `Off-session (${regime.sessionName})`,
          signal: 'NO_TRADE',
          signalConfidence: 15,
          noTradeReason: 'Session breakout requires London or New York opening volatility window.',
          evaluatedAt: Date.now()
        };
      }

      // Check recent 12-candle initial balance
      const recentCandles = candles.slice(-12);
      const highIB = Math.max(...recentCandles.map(c => c.high));
      const lowIB = Math.min(...recentCandles.map(c => c.low));

      if (quote.last > highIB && currentRsi > 55) {
        const sl = Number((quote.bid - atr * 1.2).toFixed(quote.digits));
        const tp = Number((quote.ask + atr * 2.2).toFixed(quote.digits));
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: 78,
          suitabilityThreshold: 70,
          marketRegimeFit: 'Session Initial Balance Range Breakout (Bullish Impulse)',
          signal: 'BUY',
          signalConfidence: 76,
          entryPriceEstimate: quote.ask,
          proposedStopLoss: sl,
          proposedTakeProfit: tp,
          riskRewardRatio: 1.83,
          evaluatedAt: Date.now()
        };
      } else if (quote.last < lowIB && currentRsi < 45) {
        const sl = Number((quote.ask + atr * 1.2).toFixed(quote.digits));
        const tp = Number((quote.bid - atr * 2.2).toFixed(quote.digits));
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: quote.symbol,
          suitabilityScore: 78,
          suitabilityThreshold: 70,
          marketRegimeFit: 'Session Initial Balance Range Breakout (Bearish Impulse)',
          signal: 'SELL',
          signalConfidence: 76,
          entryPriceEstimate: quote.bid,
          proposedStopLoss: sl,
          proposedTakeProfit: tp,
          riskRewardRatio: 1.83,
          evaluatedAt: Date.now()
        };
      }

      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: quote.symbol,
        suitabilityScore: 60,
        suitabilityThreshold: 70,
        marketRegimeFit: 'Consolidating within opening range bounds',
        signal: 'NO_TRADE',
        signalConfidence: 35,
        noTradeReason: 'Price consolidating within opening range bounds. Breakout trigger pending.',
        evaluatedAt: Date.now()
      };
    }

    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      symbol: quote.symbol,
      suitabilityScore: 40,
      suitabilityThreshold: 70,
      marketRegimeFit: 'Sub-threshold suitability',
      signal: 'NO_TRADE',
      signalConfidence: 20,
      noTradeReason: 'Empirical edge criteria unmet.',
      evaluatedAt: Date.now()
    };
  }
}

export const strategyEngine = new StrategyEngine();
