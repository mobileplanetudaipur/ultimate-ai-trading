import { RiskEngine } from '../services/riskEngine';
import { MarketQuote, AccountState, EconomicEvent, OrderRecord, ClosedTradeRecord } from '../types/trading';
import { OrderLifecycleManager } from '../services/orderLifecycleManager';
import { strategyEngine, DEFINED_STRATEGIES } from '../services/strategyEngine';
import { StorageCheckpointService } from '../services/storageCheckpoint';
import { calculateExecutionMetrics } from '../services/metricsCalculator';

class MemoryStorage {
  private value: string | null = null;

  getItem(_key: string) {
    return this.value;
  }

  setItem(_key: string, value: string) {
    this.value = value;
  }

  removeItem(_key: string) {
    this.value = null;
  }
}

/**
 * Automated Safety & Risk Engine Verification Suite
 */
async function runTests() {
  console.log('====================================================');
  console.log('ULTIMATE AI TRADING — AUTOMATED RISK & SAFETY VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, failureDetails?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (failureDetails) console.error(`   Details: ${failureDetails}`);
    }
  }

  const testQuoteTime = new Date();
  testQuoteTime.setUTCHours(12, 0, 0, 0);
  if (testQuoteTime.getUTCDay() === 0) testQuoteTime.setUTCDate(testQuoteTime.getUTCDate() + 1);
  if (testQuoteTime.getUTCDay() === 6) testQuoteTime.setUTCDate(testQuoteTime.getUTCDate() + 2);

  const baseQuote: MarketQuote = {
    symbol: 'EUR/USD',
    bid: 1.0850,
    ask: 1.0851,
    spreadPips: 1.0,
    last: 1.08505,
    high24h: 1.0900,
    low24h: 1.0800,
    volume24h: 5000,
    change24hPercent: 0.1,
    digits: 5,
    pipMultiplier: 10000,
    provider: 'Test Provider',
    timestamp: testQuoteTime.getTime(),
    freshness: 'simulated',
    latencyMs: 15,
    isStale: false
  };

  const baseAccount: AccountState = {
    currency: 'USD',
    balance: 10000,
    equity: 10000,
    marginUsed: 0,
    freeMargin: 10000,
    marginLevelPercent: 9999,
    leverage: 100,
    brokerConfirmed: false,
    lastReconciledAt: Date.now(),
    reconciliationStatus: 'LOCAL_CONSISTENT',
    discrepancies: []
  };

  // Test 1: Baseline 0.20% per trade risk limit enforcement
  {
    const engine = new RiskEngine(10000);
    // On $10,000 equity, 0.20% is exactly $20.00 max risk
    // Entry 1.0851, SL 1.0831 (20 pips distance = 0.0020)
    // Loss per lot (100k) = 100,000 * 0.0020 = $200 per lot
    // Expected lots for $20 risk: 20 / 200 = 0.10 lots
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851);
    assert(
      res.isApproved === true && res.calculatedLotSize === 0.10 && res.calculatedRiskAmount === 20.0,
      'Test 1: 0.20% per-trade risk calculation ($20 risk on $10k equity = 0.10 lot EUR/USD)',
      `Got approved: ${res.isApproved}, lots: ${res.calculatedLotSize}, risk: ${res.calculatedRiskAmount}`
    );
  }

  // Non-simulation modes must never approve order proposals.
  {
    const blockedModes = [
      ['read_only', 'READ_ONLY_MODE'],
      ['demo_pending', 'BROKER_ADAPTER_UNAVAILABLE'],
      ['disconnected', 'SYSTEM_DISCONNECTED']
    ] as const;

    for (const [mode, expectedRule] of blockedModes) {
      const engine = new RiskEngine(10000);
      engine.setOperatingMode(mode);
      const result = engine.validateOrderProposal(
        baseQuote,
        baseAccount,
        [],
        [],
        'BUY',
        1.0831,
        1.0851
      );
      assert(
        !result.isApproved && result.ruleBlocked === expectedRule,
        `Operating mode ${mode} blocks new entries`,
        `Got approved: ${result.isApproved}, rule: ${result.ruleBlocked}`
      );
    }
  }

  // Test 2: Reject if minimum lot (0.01) exceeds 0.20% risk budget
  {
    const engine = new RiskEngine(1000); // Small $1,000 equity -> 0.20% is only $2.00 risk!
    // EUR/USD with wide stop: Entry 1.0851, SL 1.0551 (300 pips distance = 0.0300)
    // Loss for 0.01 lot = 0.01 * 100,000 * 0.0300 = $30.00!
    // $30.00 >> $2.00 risk budget! Must REJECT.
    const smallAccount = { ...baseAccount, equity: 1000, balance: 1000, freeMargin: 1000 };
    const res = engine.validateOrderProposal(baseQuote, smallAccount, [], [], 'BUY', 1.0551, 1.0851);
    assert(
      res.isApproved === false && res.ruleBlocked === 'LOT_SIZE_EXCEEDS_MAX_RISK',
      'Test 2: Rejects trade if minimum broker lot (0.01) exceeds approved 0.20% risk budget',
      `Got ruleBlocked: ${res.ruleBlocked}, msg: ${res.rejectionMessage}`
    );
  }

  // Test 3: Instrument-aware contract sizing (Gold XAU/USD = 100 contract size)
  {
    const engine = new RiskEngine(10000);
    const goldQuote: MarketQuote = {
      ...baseQuote,
      symbol: 'XAU/USD',
      bid: 2650.00,
      ask: 2650.25,
      last: 2650.10,
      digits: 2,
      pipMultiplier: 10
    };
    // Gold contract size = 100
    // Entry 2650.25, SL 2640.25 (10.00 price diff)
    // Loss per 1 lot = 100 * 10 = $1,000
    // Risk budget $20 -> Lots = 20 / 1000 = 0.02 lots
    const res = engine.validateOrderProposal(goldQuote, baseAccount, [], [], 'BUY', 2640.25, 2650.25);
    assert(
      res.isApproved === true && res.calculatedLotSize === 0.02,
      'Test 3: Instrument-aware contract sizing for Gold (XAU/USD: 100 oz contract size)',
      `Got lots: ${res.calculatedLotSize}, rule: ${res.ruleBlocked}`
    );
  }

  // Test 4: Instrument-aware contract sizing (Bitcoin BTC/USD = 1 coin contract size)
  {
    const engine = new RiskEngine(10000);
    const btcQuote: MarketQuote = {
      ...baseQuote,
      symbol: 'BTC/USD',
      bid: 87000.00,
      ask: 87005.00,
      last: 87002.00,
      digits: 2,
      pipMultiplier: 1
    };
    // BTC contract size = 1
    // Entry 87005, SL 85005 (2000 price diff)
    // 0.01 lot loss = 0.01 * 1 * 2000 = $20.00! Matches $20 risk budget!
    const res = engine.validateOrderProposal(btcQuote, baseAccount, [], [], 'BUY', 85005.00, 87005.00);
    assert(
      res.isApproved === true && res.calculatedLotSize === 0.01,
      'Test 4: Instrument-aware contract sizing for Bitcoin (BTC/USD: 1 coin contract size)',
      `Got lots: ${res.calculatedLotSize}, rule: ${res.ruleBlocked}`
    );
  }

  // Test 5: 1.00% daily loss limit enforcement
  {
    const engine = new RiskEngine(10000);
    // Record two losses totaling -$105 (exceeds $100 = 1.00% of $10,000)
    engine.recordCompletedTrade(-55);
    engine.recordCompletedTrade(-50);
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851);
    assert(
      res.isApproved === false && res.ruleBlocked === 'DAILY_LOSS_LIMIT_EXCEEDED',
      'Test 5: Daily loss limit (1.00%) immediately blocks all new entries',
      `Got ruleBlocked: ${res.ruleBlocked}`
    );
  }

  // Test 6: 8 entries per day maximum cap
  {
    const engine = new RiskEngine(10000);
    for (let i = 0; i < 8; i++) {
      engine.recordTradeEntry();
    }
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851);
    assert(
      res.isApproved === false && res.ruleBlocked === 'DAILY_TRADE_CAP_EXCEEDED',
      'Test 6: Daily entry cap counts opened trades and blocks the 9th entry',
      `Got ruleBlocked: ${res.ruleBlocked}`
    );
    engine.recordCompletedTrade(5);
    assert(
      engine.getStatus().todayTradesCount === 8,
      'Test 6b: Closing a trade does not increment the daily entry count'
    );
  }

  // Test 7: 5 consecutive losses triggers 30-minute lockout
  {
    const engine = new RiskEngine(10000);
    for (let i = 0; i < 5; i++) {
      engine.recordCompletedTrade(-5); // 5 consecutive small losses
    }
    const status = engine.getStatus();
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851);
    assert(
      status.isCooldownActive === true && res.isApproved === false && res.ruleBlocked === 'CONSECUTIVE_LOSS_LOCKOUT',
      'Test 7: 5 consecutive net losses triggers mandatory 30-minute lockout',
      `Got cooldownActive: ${status.isCooldownActive}, ruleBlocked: ${res.ruleBlocked}`
    );
  }

  // Test 8: Maximum 3 simultaneous positions limit
  {
    const engine = new RiskEngine(10000);
    const mockPositions: any[] = [
      { id: '1', symbol: 'EUR/USD', sizeLots: 0.1, currentPrice: 1.0850 },
      { id: '2', symbol: 'GBP/USD', sizeLots: 0.1, currentPrice: 1.2940 },
      { id: '3', symbol: 'USD/JPY', sizeLots: 0.1, currentPrice: 152.40 }
    ];
    const res = engine.validateOrderProposal(baseQuote, baseAccount, mockPositions, [], 'BUY', 1.0831, 1.0851);
    assert(
      res.isApproved === false && res.ruleBlocked === 'MAX_POSITIONS_REACHED',
      'Test 8: Maximum 3 simultaneous open positions ceiling enforced',
      `Got ruleBlocked: ${res.ruleBlocked}`
    );
  }

  // Test 9: 3x Maximum Effective Leverage check
  {
    const engine = new RiskEngine(10000);
    // Already holding large exposure: $25,000 position value
    const mockPositions: any[] = [
      { id: '1', symbol: 'EUR/USD', sizeLots: 0.23, currentPrice: 1.0850 } // 0.23 * 100k * 1.085 = $24,955
    ];
    // Adding another position of $11,000 would push total exposure to ~$36,000 ($36k / $10k = 3.6x > 3.0x max!)
    // Let's test with stop distance that asks for 0.10 lots = $10,851 -> Total $35,806 -> 3.58x
    const res = engine.validateOrderProposal(baseQuote, baseAccount, mockPositions, [], 'BUY', 1.0831, 1.0851);
    assert(
      res.isApproved === false && res.ruleBlocked === 'EXCEEDS_MAX_LEVERAGE_3X',
      'Test 9: 3x maximum effective portfolio leverage ceiling strictly enforced',
      `Got ruleBlocked: ${res.ruleBlocked}`
    );
  }

  // Test 10: Fail-closed on stale or unavailable market data
  {
    const engine = new RiskEngine(10000);
    const staleQuote: MarketQuote = {
      ...baseQuote,
      freshness: 'stale',
      isStale: true,
      latencyMs: 3500
    };
    const res = engine.validateOrderProposal(staleQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851);
    assert(
      res.isApproved === false && res.ruleBlocked === 'FEED_UNRELIABLE',
      'Test 10: Fail-closed: Stale or degraded market feed blocks orders',
      `Got ruleBlocked: ${res.ruleBlocked}`
    );
  }

  // Test 11: Emergency Kill Switch halts all entries
  {
    const engine = new RiskEngine(10000);
    engine.triggerKillSwitch();
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851);
    assert(
      res.isApproved === false && res.ruleBlocked === 'KILL_SWITCH_ACTIVE',
      'Test 11: Emergency Kill Switch immediately blocks all automated order proposals',
      `Got ruleBlocked: ${res.ruleBlocked}`
    );
  }

  // Test 12: Missing or invalid stop loss rejection
  {
    const engine = new RiskEngine(10000);
    // Invalid BUY stop above entry
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0890, 1.0851);
    assert(
      res.isApproved === false && res.ruleBlocked === 'INVALID_BUY_STOP',
      'Test 12: Invalid Stop Loss (BUY stop above entry) rejected',
      `Got ruleBlocked: ${res.ruleBlocked}`
    );
  }

  // Test 13: News event blackout window blocks trade entry
  {
    const engine = new RiskEngine(10000);
    const mockUpcomingEvents: EconomicEvent[] = [
      {
        id: 'evt_cpi',
        title: 'US CPI High Impact Release',
        currency: 'USD',
        impact: 'HIGH',
        scheduledTime: baseQuote.timestamp + 20 * 60 * 1000, // 20 minutes away (< 30 min window)
        isSyntheticTestScenario: true
      }
    ];
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851, mockUpcomingEvents);
    assert(
      res.isApproved === false && res.ruleBlocked === 'NEWS_BLACKOUT_ACTIVE',
      'Test 13: News blackout window (< 30m to Tier-1 event) blocks order proposal',
      `Got ruleBlocked: ${res.ruleBlocked}`
    );
  }

  // Test 14: Risk engine respects maximum overall drawdown threshold (5.00%)
  {
    const engine = new RiskEngine(10000);
    // Equity dropped from $10,000 to $9,400 (6% total drawdown > 5.0% limit)
    const drawnDownAccount: AccountState = {
      ...baseAccount,
      equity: 9400,
      balance: 9400
    };
    const res = engine.validateOrderProposal(baseQuote, drawnDownAccount, [], [], 'BUY', 1.0831, 1.0851);
    assert(
      res.isApproved === false && res.ruleBlocked === 'OVERALL_DRAWDOWN_LIMIT_EXCEEDED',
      'Test 14: Overall drawdown ceiling (5.00%) halts new risk entries',
      `Got ruleBlocked: ${res.ruleBlocked}`
    );
  }

  // Test 15: USD/JPY pip value calculation with quote currency conversion
  {
    const engine = new RiskEngine(10000);
    const usdjpyQuote: MarketQuote = {
      ...baseQuote,
      symbol: 'USD/JPY',
      bid: 150.00,
      ask: 150.02,
      last: 150.01,
      digits: 3,
      pipMultiplier: 100
    };
    // 100 pips stop = 1.00 price diff on USD/JPY (SL 149.02)
    // Loss per 1 lot move in USD = (100,000 * 1.00) / 150.02 = $666.58 USD
    // $20 risk budget -> 20 / 666.58 = 0.03 lots
    const res = engine.validateOrderProposal(usdjpyQuote, baseAccount, [], [], 'BUY', 149.02, 150.02);
    assert(
      res.isApproved === true && res.calculatedLotSize === 0.03 && res.calculatedRiskAmount !== undefined && res.calculatedRiskAmount <= 20.05,
      'Test 15: USD/JPY cross-currency pip value conversion ($100k contract size converted to USD equity)',
      `Got approved: ${res.isApproved}, lots: ${res.calculatedLotSize}, risk: ${res.calculatedRiskAmount}`
    );
  }

  // Test 16: Strategy engine fail-closed on stale feed
  {
    const staleQuote: MarketQuote = {
      ...baseQuote,
      freshness: 'unavailable',
      isStale: true
    };
    const regime = strategyEngine.evaluateMarketRegime(baseQuote, [
      { time: Date.now() - 3600000, open: 1.080, high: 1.086, low: 1.079, close: 1.085, volume: 1000 }
    ], []);
    const evals = strategyEngine.evaluateStrategies(staleQuote, [
      { time: Date.now() - 3600000, open: 1.080, high: 1.086, low: 1.079, close: 1.085, volume: 1000 }
    ], regime);
    const allNoTrade = evals.every(e => e.signal === 'NO_TRADE');
    assert(
      allNoTrade === true && evals.length >= 6,
      'Test 16: Strategy engine evaluates all 6 strategies and fails-closed to NO_TRADE on degraded feed',
      `Got allNoTrade: ${allNoTrade}, count: ${evals.length}`
    );
  }

  // Test 17: Ineligible symbol returns explicit NO_TRADE reason
  {
    const regime = {
      ...strategyEngine.evaluateMarketRegime(baseQuote, [
        { time: Date.now() - 3600000, open: 1.080, high: 1.086, low: 1.079, close: 1.085, volume: 1000 }
      ], []),
      sessionName: 'NEW_YORK' as const,
      isPreCloseExclusion: false
    };
    // baseQuote is EUR/USD, btcStrat requires BTC/USD
    const evals = strategyEngine.evaluateStrategies(baseQuote, [
      { time: Date.now() - 3600000, open: 1.080, high: 1.086, low: 1.079, close: 1.085, volume: 1000 }
    ], regime);
    const btcEval = evals.find(e => e.strategyId === 'strat_btc_trend_m15');
    assert(
      btcEval?.signal === 'NO_TRADE' && btcEval?.noTradeReason?.includes('BTC/USD') === true,
      'Test 17: Strategy engine strictly verifies target symbol eligibility before signal generation',
      `Got signal: ${btcEval?.signal}, reason: ${btcEval?.noTradeReason}`
    );
  }

  // Test 18: Idempotency duplicate order protection
  {
    const olm = new OrderLifecycleManager();
    const idempotencyKey = 'test_idem_key_12345';
    let duplicateCaught = false;
    await olm.submitOrder({
      clientOrderId: 'ord_1',
      idempotencyKey,
      symbol: 'EUR/USD',
      side: 'BUY',
      sizeLots: 0.1,
      requestedPrice: 1.0851,
      stopLossPrice: 1.0831,
      takeProfitPrice: 1.0891,
      strategyId: 'strat_test',
      quote: baseQuote
    });

    try {
      await olm.submitOrder({
        clientOrderId: 'ord_2',
        idempotencyKey,
        symbol: 'EUR/USD',
        side: 'BUY',
        sizeLots: 0.1,
        requestedPrice: 1.0851,
        stopLossPrice: 1.0831,
        takeProfitPrice: 1.0891,
        strategyId: 'strat_test',
        quote: baseQuote
      });
    } catch (err: any) {
      if (err.message && err.message.includes('Duplicate submission detected')) {
        duplicateCaught = true;
      }
    }

    assert(
      duplicateCaught === true,
      'Test 18: Idempotency duplicate order protection prevents double order submission',
      `Caught duplicate: ${duplicateCaught}`
    );

    const restoredOlm = new OrderLifecycleManager();
    restoredOlm.setInitialState([], olm.getOrders(), []);
    let restoredDuplicateCaught = false;
    try {
      await restoredOlm.submitOrder({
        clientOrderId: 'ord_after_restore',
        idempotencyKey,
        symbol: 'EUR/USD',
        side: 'BUY',
        sizeLots: 0.1,
        requestedPrice: 1.0851,
        stopLossPrice: 1.0831,
        takeProfitPrice: 1.0891,
        strategyId: 'strat_test',
        quote: baseQuote
      });
    } catch (err: any) {
      restoredDuplicateCaught = err.message?.includes('Duplicate submission detected') === true;
    }
    assert(
      restoredDuplicateCaught,
      'Test 18b: Restored order history rebuilds idempotency protection',
      `Caught duplicate after restore: ${restoredDuplicateCaught}`
    );
  }

  // Test 18c: Unsupported symbols fail closed rather than receiving guessed contract terms
  {
    const unsupportedQuote = { ...baseQuote, symbol: 'UNKNOWN/XYZ' };
    const engine = new RiskEngine(10000);
    const result = engine.validateOrderProposal(
      unsupportedQuote,
      baseAccount,
      [],
      [],
      'BUY',
      1.0831,
      1.0851
    );
    assert(
      result.isApproved === false && result.ruleBlocked === 'UNSUPPORTED_INSTRUMENT',
      'Test 18c: Unknown instruments are rejected without guessed sizing assumptions',
      `Got ruleBlocked: ${result.ruleBlocked}`
    );
  }

  // Test 18d: Pending submissions reserve daily entry capacity
  {
    const engine = new RiskEngine(10000);
    for (let i = 0; i < 7; i++) engine.recordTradeEntry();
    const pendingOrder: OrderRecord = {
      id: 'pending',
      clientOrderId: 'pending',
      idempotencyKey: 'pending',
      symbol: 'EUR/USD',
      side: 'BUY',
      orderType: 'MARKET',
      requestedSizeLots: 0.1,
      filledSizeLots: 0,
      requestedPrice: 1.0851,
      stopLossPrice: 1.0831,
      commissionPaid: 0,
      status: 'SUBMITTED_LOCAL',
      strategyId: 'test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isSimulatedOrder: true
    };
    const result = engine.validateOrderProposal(
      baseQuote,
      baseAccount,
      [],
      [pendingOrder],
      'BUY',
      1.0831,
      1.0851
    );
    assert(
      result.isApproved === false && result.ruleBlocked === 'DAILY_TRADE_CAP_EXCEEDED',
      'Test 18d: Pending submissions reserve the remaining daily entry slot',
      `Got ruleBlocked: ${result.ruleBlocked}`
    );
  }

  // Test 18e: UTC weekend lock is enforced by the central risk gate
  {
    const engine = new RiskEngine(10000);
    const weekendQuote = { ...baseQuote, timestamp: Date.UTC(2026, 9, 17, 12) };
    const result = engine.validateOrderProposal(
      weekendQuote,
      baseAccount,
      [],
      [],
      'BUY',
      1.0831,
      1.0851
    );
    assert(
      result.isApproved === false && result.ruleBlocked === 'MARKET_CLOSED',
      'Test 18e: Weekend proposals fail closed in the centralized risk gate',
      `Got ruleBlocked: ${result.ruleBlocked}`
    );
  }

  // Test 18f: A new UTC day resets daily counters and daily loss state
  {
    const engine = new RiskEngine(10000);
    engine.restoreStatus({
      ...engine.getStatus(),
      dailyPeriodKey: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      todayTradesCount: 8,
      dailyTradeCapBreached: true,
      todayRealizedPnl: -150,
      todayDrawdownPercent: 1.5,
      dailyLossLimitBreached: true
    });
    engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851);
    const status = engine.getStatus();
    assert(
      status.todayTradesCount === 0
        && !status.dailyTradeCapBreached
        && status.todayRealizedPnl === 0
        && !status.dailyLossLimitBreached,
      'Test 18f: UTC day rollover resets daily limits before validation',
      `Got trades: ${status.todayTradesCount}, daily loss: ${status.dailyLossLimitBreached}`
    );
  }

  // Test 18g: Session drawdown remains cumulative after the daily reset
  {
    const engine = new RiskEngine(10000);
    engine.restoreStatus({
      ...engine.getStatus(),
      dailyPeriodKey: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      sessionStartingEquity: 10000
    });
    const result = engine.validateOrderProposal(
      baseQuote,
      { ...baseAccount, equity: 9400, balance: 9400 },
      [],
      [],
      'BUY',
      1.0831,
      1.0851
    );
    assert(
      result.isApproved === false && result.ruleBlocked === 'OVERALL_DRAWDOWN_LIMIT_EXCEEDED',
      'Test 18g: Overall drawdown remains anchored to session-start equity after daily rollover',
      `Got ruleBlocked: ${result.ruleBlocked}`
    );
  }

  // Test 18h: High-impact event blackout covers relevant symbols before and after release
  {
    const engine = new RiskEngine(10000);
    const recentEvent: EconomicEvent = {
      id: 'released_cpi',
      title: 'Released CPI',
      currency: 'USD',
      impact: 'HIGH',
      scheduledTime: baseQuote.timestamp - 5 * 60 * 1000,
      isSyntheticTestScenario: true
    };
    const postReleaseResult = engine.validateOrderProposal(
      baseQuote,
      baseAccount,
      [],
      [],
      'BUY',
      1.0831,
      1.0851,
      [recentEvent]
    );
    const unrelatedQuote = { ...baseQuote, symbol: 'USD/JPY' };
    const unrelatedEvent: EconomicEvent = { ...recentEvent, currency: 'EUR' };
    const unrelatedResult = engine.validateOrderProposal(
      unrelatedQuote,
      baseAccount,
      [],
      [],
      'BUY',
      149.9,
      150.0,
      [unrelatedEvent]
    );
    assert(
      postReleaseResult.ruleBlocked === 'NEWS_BLACKOUT_ACTIVE'
        && unrelatedResult.ruleBlocked !== 'NEWS_BLACKOUT_ACTIVE',
      'Test 18h: Event windows apply for 15 minutes after release and only to matching currencies',
      `Post-release: ${postReleaseResult.ruleBlocked}, unrelated: ${unrelatedResult.ruleBlocked}`
    );
  }

  // Test 18i: Closing a position requires a quote for its own symbol
  {
    const olm = new OrderLifecycleManager();
    const opened = olm.submitOrder({
      clientOrderId: 'close-symbol-check',
      idempotencyKey: 'close-symbol-check',
      symbol: 'EUR/USD',
      side: 'BUY',
      sizeLots: 0.1,
      requestedPrice: 1.0851,
      stopLossPrice: 1.0831,
      takeProfitPrice: 1.0891,
      strategyId: 'test',
      quote: baseQuote
    });
    const wrongSymbolQuote = { ...baseQuote, symbol: 'GBP/USD', bid: 1.29, ask: 1.2902 };
    const closed = opened.position
      ? olm.closePosition(opened.position.id, wrongSymbolQuote)
      : null;
    assert(
      closed === null && olm.getPositions().length === 1,
      'Test 18i: A quote for another symbol cannot close or misprice a paper position',
      `Closed: ${Boolean(closed)}, remaining positions: ${olm.getPositions().length}`
    );
  }

  // Test 19: Checkpoints preserve risk lockouts across restore
  {
    const storage = new MemoryStorage();
    const checkpointService = new StorageCheckpointService(storage);
    const riskStatus = {
      ...new RiskEngine(10000).getStatus(),
      isTradingPaused: true,
      pauseReason: 'Test recovery lock',
      todayTradesCount: 4,
      killSwitchTriggered: true,
      killSwitchTriggeredAt: Date.now()
    };
    checkpointService.saveCheckpoint({
      operatingMode: 'simulated',
      account: baseAccount,
      positions: [],
      orders: [],
      closedTrades: [],
      riskLimits: new RiskEngine(10000).getLimits(),
      riskStatus,
      auditLogs: []
    });

    const restored = checkpointService.loadCheckpoint();
    const restoredEngine = new RiskEngine(10000);
    if (restored) restoredEngine.restoreStatus(restored.riskStatus);
    const restoredStatus = restoredEngine.getStatus();
    assert(
      restoredStatus.isTradingPaused
        && restoredStatus.killSwitchTriggered
        && restoredStatus.todayTradesCount === 4
        && restoredStatus.pauseReason === 'Test recovery lock',
      'Test 19: Checkpoint restore retains pause, kill switch, and daily risk counters',
      `Got paused: ${restoredStatus.isTradingPaused}, kill switch: ${restoredStatus.killSwitchTriggered}, trades: ${restoredStatus.todayTradesCount}`
    );
  }

  // Test 20: Legacy checkpoints recover with entries safely locked
  {
    const storage = new MemoryStorage();
    const checkpointService = new StorageCheckpointService(storage);
    const saved = checkpointService.saveCheckpoint({
      operatingMode: 'simulated',
      account: baseAccount,
      positions: [],
      orders: [],
      closedTrades: [],
      riskLimits: new RiskEngine(10000).getLimits(),
      riskStatus: new RiskEngine(10000).getStatus(),
      auditLogs: []
    });
    const legacy = { ...saved } as Record<string, unknown>;
    delete legacy.schemaVersion;
    delete legacy.riskStatus;
    storage.setItem('', JSON.stringify(legacy));

    const migrated = checkpointService.loadCheckpoint();
    assert(
      migrated?.riskStatus.killSwitchTriggered === true
        && migrated.riskStatus.isTradingPaused
        && migrated.verifiedStatusNote.includes('Legacy'),
      'Test 20: Legacy checkpoint without saved risk state migrates with entries locked',
      `Got checkpoint: ${migrated?.checkpointId}, kill switch: ${migrated?.riskStatus.killSwitchTriggered}`
    );
  }

  // Test 21: Checkpoint storage errors are surfaced instead of returning success
  {
    const failingStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('Storage quota exceeded'); },
      removeItem: () => undefined
    };
    const checkpointService = new StorageCheckpointService(failingStorage);
    let failureReported = false;

    try {
      checkpointService.saveCheckpoint({
        operatingMode: 'simulated',
        account: baseAccount,
        positions: [],
        orders: [],
        closedTrades: [],
        riskLimits: new RiskEngine(10000).getLimits(),
        riskStatus: new RiskEngine(10000).getStatus(),
        auditLogs: []
      });
    } catch (error) {
      failureReported = error instanceof Error && error.message === 'Storage quota exceeded';
    }

    assert(
      failureReported,
      'Test 21: Checkpoint storage failures are thrown for visible UI handling',
      `Reported failure: ${failureReported}`
    );
  }

  // Test 22: Corrupted checkpoints report an explicit load error
  {
    const storage = new MemoryStorage();
    storage.setItem('checkpoint', '{invalid json');
    const checkpointService = new StorageCheckpointService(storage);
    let loadErrorReported = false;

    try {
      checkpointService.loadCheckpoint();
    } catch (error) {
      loadErrorReported = error instanceof Error && error.message.includes('not valid JSON');
    }

    assert(
      loadErrorReported,
      'Test 22: Corrupted checkpoint data is reported instead of silently discarded',
      `Reported load error: ${loadErrorReported}`
    );
  }

  // Test 23: Inconsistent lockout data is rejected during checkpoint load
  {
    const storage = new MemoryStorage();
    const checkpointService = new StorageCheckpointService(storage);
    const saved = checkpointService.saveCheckpoint({
      operatingMode: 'simulated',
      account: baseAccount,
      positions: [],
      orders: [],
      closedTrades: [],
      riskLimits: new RiskEngine(10000).getLimits(),
      riskStatus: new RiskEngine(10000).getStatus(),
      auditLogs: []
    });
    const invalid = {
      ...saved,
      riskStatus: { ...saved.riskStatus, isCooldownActive: true }
    };
    delete invalid.riskStatus.cooldownEndsAt;
    storage.setItem('checkpoint', JSON.stringify(invalid));
    let invalidStateRejected = false;

    try {
      checkpointService.loadCheckpoint();
    } catch (error) {
      invalidStateRejected = error instanceof Error && error.message.includes('invalid risk state');
    }

    assert(
      invalidStateRejected,
      'Test 23: Active cooldown without an end time is rejected as invalid risk state',
      `Invalid state rejected: ${invalidStateRejected}`
    );
  }

  // Test 24: Uncomputable performance ratios are not represented as fabricated numbers
  {
    const winningTrade: ClosedTradeRecord = {
      id: 'win',
      positionId: 'position',
      symbol: 'EUR/USD',
      side: 'BUY',
      sizeLots: 0.1,
      entryPrice: 1.08,
      exitPrice: 1.09,
      slippagePips: 0.2,
      grossPnl: 10,
      commission: 0.7,
      swap: 0,
      netPnl: 9.3,
      openedAt: Date.now() - 1000,
      closedAt: Date.now(),
      exitReason: 'TAKE_PROFIT',
      strategyId: 'test'
    };
    const metrics = calculateExecutionMetrics([winningTrade], []);
    assert(
      metrics.profitFactor === null && metrics.sharpeRatioEstimate === null,
      'Test 24: Undefined profit factor and unsupported Sharpe ratio remain unavailable',
      `Profit factor: ${metrics.profitFactor}, Sharpe: ${metrics.sharpeRatioEstimate}`
    );
  }

  // Test 25: Version 3 checkpoints migrate daily/session risk baselines
  {
    const storage = new MemoryStorage();
    const checkpointService = new StorageCheckpointService(storage);
    const riskStatus = {
      ...new RiskEngine(10000).getStatus(),
      dailyStartingEquity: 12000,
      todayTradesCount: 3
    };
    const saved = checkpointService.saveCheckpoint({
      operatingMode: 'simulated',
      account: baseAccount,
      positions: [],
      orders: [],
      closedTrades: [],
      riskLimits: new RiskEngine(10000).getLimits(),
      riskStatus,
      auditLogs: []
    });
    const oldRiskStatus: Partial<typeof riskStatus> = { ...riskStatus };
    delete oldRiskStatus.dailyPeriodKey;
    delete oldRiskStatus.sessionStartingEquity;
    const v3 = {
      ...saved,
      schemaVersion: 3,
      riskStatus: oldRiskStatus
    };
    storage.setItem('checkpoint', JSON.stringify(v3));
    const migrated = checkpointService.loadCheckpoint();
    assert(
      migrated?.schemaVersion === 4
        && migrated.riskStatus.todayTradesCount === 3
        && migrated.riskStatus.sessionStartingEquity === 12000
        && typeof migrated.riskStatus.dailyPeriodKey === 'string',
      'Test 25: Version 3 risk checkpoints migrate without dropping daily counts',
      `Version: ${migrated?.schemaVersion}, entries: ${migrated?.riskStatus.todayTradesCount}`
    );
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} / ${total} PASSED`);
  console.log('====================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
