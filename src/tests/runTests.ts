import { RiskEngine } from '../services/riskEngine';
import { MarketQuote, AccountState, EconomicEvent } from '../types/trading';
import { OrderLifecycleManager } from '../services/orderLifecycleManager';
import { strategyEngine, DEFINED_STRATEGIES } from '../services/strategyEngine';
import { reconciliationService } from '../services/reconciliationService';
import { shadowValidationService } from '../services/shadowValidationService';
import { liveReleaseGateService } from '../services/liveReleaseGateService';
import { brokerGateway } from '../services/brokerGateway';

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
    timestamp: Date.now(),
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

  // Test 6: 8 trades per day maximum cap
  {
    const engine = new RiskEngine(10000);
    for (let i = 0; i < 8; i++) {
      engine.recordCompletedTrade(5); // 8 winning trades
    }
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851);
    assert(
      res.isApproved === false && res.ruleBlocked === 'DAILY_TRADE_CAP_EXCEEDED',
      'Test 6: Daily trade cap (8 trades per day) immediately blocks 9th order',
      `Got ruleBlocked: ${res.ruleBlocked}`
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
  }

  // Test 19: Anti-grid averaging down / uncontrolled scaling check
  {
    const engine = new RiskEngine(10000);
    const mockPositions: any[] = [
      { id: 'pos_eur', symbol: 'EUR/USD', side: 'BUY', sizeLots: 0.05, currentPrice: 1.0840, unrealizedPnl: -10 }
    ];
    const res = engine.validateOrderProposal(baseQuote, baseAccount, mockPositions, [], 'BUY', 1.0820, 1.0851);
    assert(
      res.isApproved === false && res.ruleBlocked === 'GRID_AVERAGING_PROHIBITED',
      'Test 19: Anti-grid & scaling safeguard blocks adding to open position in same symbol',
      `Got ruleBlocked: ${res.ruleBlocked}, msg: ${res.rejectionMessage}`
    );
  }

  // Test 20: Anti-martingale protection (increasing lot size after a loss)
  {
    const engine = new RiskEngine(10000);
    // Record previous trade as a loss with 0.02 lots
    engine.recordCompletedTrade(-15, 0.02);
    // Proposing 0.05 lots (> 0.02) after a loss must be blocked
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851, undefined, {
      requestedLotSize: 0.05
    });
    assert(
      res.isApproved === false && res.ruleBlocked === 'MARTINGALE_SCALING_PROHIBITED',
      'Test 20: Anti-martingale safeguard blocks scaled-up lot size following a loss',
      `Got ruleBlocked: ${res.ruleBlocked}, msg: ${res.rejectionMessage}`
    );
  }

  // Test 21: Anti-revenge trading cooldown (5-minute window following loss on same symbol)
  {
    const engine = new RiskEngine(10000);
    const recentClosedTrades: any[] = [
      {
        id: 'trade_eur_loss',
        symbol: 'EUR/USD',
        netPnl: -18,
        closedAt: Date.now() - 60000 // 1 minute ago (< 5 minutes)
      }
    ];
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851, undefined, {
      recentClosedTrades
    });
    assert(
      res.isApproved === false && res.ruleBlocked === 'REVENGE_TRADING_COOLDOWN',
      'Test 21: Anti-revenge safeguard enforces 5-minute cooldown on same symbol after net loss',
      `Got ruleBlocked: ${res.ruleBlocked}, msg: ${res.rejectionMessage}`
    );
  }

  // Test 22: Breaker lockout preservation (synthetic win CANNOT clear genuine breaker)
  {
    const engine = new RiskEngine(10000);
    // Trigger breaker with 5 consecutive losses
    for (let i = 0; i < 5; i++) {
      engine.recordCompletedTrade(-10);
    }
    const beforeStatus = engine.getStatus();
    assert(beforeStatus.isCooldownActive === true, 'Breaker triggered properly');

    // Attempt to clear breaker with a synthetic +$5 winning trade
    engine.recordCompletedTrade(5);
    const afterStatus = engine.getStatus();
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851);

    assert(
      afterStatus.isCooldownActive === true && res.isApproved === false && res.ruleBlocked === 'CONSECUTIVE_LOSS_LOCKOUT',
      'Test 22: Breaker preservation: Synthetic win cannot prematurely clear genuine 30m breaker',
      `Cooldown active: ${afterStatus.isCooldownActive}, ruleBlocked: ${res.ruleBlocked}`
    );
  }

  // Test 23: Operating mode fail-closed (Read-Only blocks order execution)
  {
    const engine = new RiskEngine(10000);
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851, undefined, {
      operatingMode: 'read_only'
    });
    assert(
      res.isApproved === false && res.ruleBlocked === 'READ_ONLY_MODE_ACTIVE',
      'Test 23: Operating mode fail-closed: Read-Only mode blocks order execution',
      `Got ruleBlocked: ${res.ruleBlocked}`
    );
  }

  // Test 24: Duplicate in-flight order rejection
  {
    const engine = new RiskEngine(10000);
    const mockPendingOrders: any[] = [
      { id: 'ord_inflight_1', symbol: 'EUR/USD', side: 'BUY', status: 'SUBMITTED_LOCAL' }
    ];
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], mockPendingOrders, 'BUY', 1.0831, 1.0851);
    assert(
      res.isApproved === false && res.ruleBlocked === 'DUPLICATE_ORDER_IN_FLIGHT',
      'Test 24: Duplicate in-flight order protection prevents double execution on same symbol/side',
      `Got ruleBlocked: ${res.ruleBlocked}`
    );
  }

  // Test 25: Take-profit direction verification (BUY TP below entry price rejected)
  {
    const engine = new RiskEngine(10000);
    // BUY order at 1.0851, with an invalid TP at 1.0820 (below entry)
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851, undefined, {
      proposedTakeProfit: 1.0820
    });
    assert(
      res.isApproved === false && res.ruleBlocked === 'INVALID_BUY_TAKE_PROFIT',
      'Test 25: Take profit direction check: Invalid TP below BUY entry rejected',
      `Got ruleBlocked: ${res.ruleBlocked}`
    );
  }

  // Test 26: Closed-candle confirmation requirement
  {
    const engine = new RiskEngine(10000);
    const res = engine.validateOrderProposal(baseQuote, baseAccount, [], [], 'BUY', 1.0831, 1.0851, undefined, {
      isClosedCandleSignal: false
    });
    assert(
      res.isApproved === false && res.ruleBlocked === 'UNCONFIRMED_INTRABAR_SIGNAL',
      'Test 26: Signal confirmation: Unconfirmed intrabar signal rejected',
      `Got ruleBlocked: ${res.ruleBlocked}`
    );
  }

  // Test 27: Multi-record state separation (Intent, Broker Order, Deal, Position)
  {
    const manager = new OrderLifecycleManager();
    const res = await manager.submitOrder({
      clientOrderId: 'cli_test_sep',
      idempotencyKey: 'idem_test_sep_1',
      symbol: 'EUR/USD',
      side: 'BUY',
      sizeLots: 0.10,
      requestedPrice: 1.0851,
      stopLossPrice: 1.0831,
      takeProfitPrice: 1.0891,
      strategyId: 'trend_continuation_m5',
      quote: baseQuote
    });

    const hasDistinctIntent = res.intent !== undefined && res.intent.status === 'COMPLETED';
    const hasDistinctBrokerOrder = res.brokerOrder !== undefined && res.brokerOrder.status === 'FILLED';
    const hasDistinctDeal = res.deal !== undefined && res.deal.dealType === 'ENTRY_FILL';
    const hasDistinctPosition = res.position !== undefined && res.position.sizeLots === 0.10;

    assert(
      hasDistinctIntent && hasDistinctBrokerOrder && hasDistinctDeal && hasDistinctPosition,
      'Test 27: Multi-record state separation: distinct models for intent, broker order, deal, and position',
      `Intent: ${Boolean(res.intent)}, BrokerOrder: ${Boolean(res.brokerOrder)}, Deal: ${Boolean(res.deal)}, Position: ${Boolean(res.position)}`
    );
  }

  // Test 28: Partial fill handling
  {
    const manager = new OrderLifecycleManager();
    const sub = await manager.submitOrder({
      clientOrderId: 'cli_test_partial',
      idempotencyKey: 'idem_test_partial_1',
      symbol: 'EUR/USD',
      side: 'BUY',
      sizeLots: 0.10,
      requestedPrice: 1.0851,
      stopLossPrice: 1.0831,
      takeProfitPrice: 1.0891,
      strategyId: 'trend_continuation_m5',
      quote: baseQuote,
      simulateTimeout: true // leaves broker order placed but not filled
    });

    if (sub.brokerOrder) {
      const partialRes = manager.handlePartialFill({
        brokerTicket: sub.brokerOrder.brokerTicket,
        fillVolumeLots: 0.04,
        fillPrice: 1.0852
      });

      assert(
        partialRes.brokerOrder.status === 'PARTIALLY_FILLED' &&
        partialRes.brokerOrder.filledVolumeLots === 0.04 &&
        partialRes.brokerOrder.remainingVolumeLots === 0.06 &&
        partialRes.deal.dealType === 'PARTIAL_FILL' &&
        partialRes.position.sizeLots === 0.04,
        'Test 28: Partial fill correctly updates broker order (0.04 filled, 0.06 rem) and creates position',
        `Status: ${partialRes.brokerOrder.status}, Rem: ${partialRes.brokerOrder.remainingVolumeLots}, Pos size: ${partialRes.position.sizeLots}`
      );
    } else {
      assert(false, 'Test 28: Broker order missing for partial fill test');
    }
  }

  // Test 29: Partial close handling
  {
    const manager = new OrderLifecycleManager();
    const sub = await manager.submitOrder({
      clientOrderId: 'cli_test_pclose',
      idempotencyKey: 'idem_test_pclose_1',
      symbol: 'EUR/USD',
      side: 'BUY',
      sizeLots: 0.10,
      requestedPrice: 1.0851,
      stopLossPrice: 1.0831,
      takeProfitPrice: 1.0891,
      strategyId: 'trend_continuation_m5',
      quote: baseQuote
    });

    if (sub.position) {
      const pCloseRes = manager.handlePartialClose(sub.position.id, 0.04, baseQuote, 'MANUAL_CLOSE');

      assert(
        pCloseRes.position.sizeLots === 0.06 &&
        pCloseRes.closedRecord.sizeLots === 0.04 &&
        pCloseRes.deal.dealType === 'PARTIAL_CLOSE',
        'Test 29: Partial close correctly reduces position volume (0.10 -> 0.06) and records 0.04 deal',
        `Rem pos size: ${pCloseRes.position.sizeLots}, closed size: ${pCloseRes.closedRecord.sizeLots}`
      );
    } else {
      assert(false, 'Test 29: Position missing for partial close test');
    }
  }

  // Test 30: Timeout & unknown outcome safety (Blind retry strictly forbidden)
  {
    const manager = new OrderLifecycleManager();
    const intent = manager.createOrderIntent({
      clientOrderId: 'cli_test_timeout',
      idempotencyKey: 'idem_test_timeout_1',
      symbol: 'EUR/USD',
      side: 'BUY',
      requestedVolumeLots: 0.05,
      requestedPrice: 1.0851,
      stopLossPrice: 1.0831,
      takeProfitPrice: 1.0891,
      maxSlippagePips: 1.5,
      strategyId: 'test_strat'
    });

    manager.handleSubmissionTimeout(intent.intentId);
    const retryCheck = manager.canRetrySubmission(intent.intentId);

    assert(
      intent.status === 'TIMEOUT_UNKNOWN' &&
      intent.blindRetryForbidden === true &&
      retryCheck.allowed === false,
      'Test 30: Submission timeout triggers TIMEOUT_UNKNOWN and strictly prohibits blind retries',
      `Status: ${intent.status}, retryAllowed: ${retryCheck.allowed}, reason: ${retryCheck.reason}`
    );
  }

  // Test 31: Duplicate broker deal response idempotency
  {
    const manager = new OrderLifecycleManager();
    const firstCheck = manager.handleDuplicateBrokerResponse('ticket_deal_999');
    const secondCheck = manager.handleDuplicateBrokerResponse('ticket_deal_999');

    assert(
      firstCheck === false && secondCheck === true,
      'Test 31: Duplicate broker response idempotency: duplicate deal ticket dropped without state inflation',
      `First check (new): ${!firstCheck}, Second check (dup dropped): ${secondCheck}`
    );
  }

  // Test 32: Stop loss modification failure detection & reconciliation
  {
    const manager = new OrderLifecycleManager();
    const sub = await manager.submitOrder({
      clientOrderId: 'cli_test_sl_fail',
      idempotencyKey: 'idem_test_sl_fail_1',
      symbol: 'EUR/USD',
      side: 'BUY',
      sizeLots: 0.05,
      requestedPrice: 1.0851,
      stopLossPrice: 1.0831,
      takeProfitPrice: 1.0891,
      strategyId: 'test_strat',
      quote: baseQuote
    });

    if (sub.position) {
      manager.handleStopModificationFailure(sub.position.id, 1.0840, 'Broker freeze level violation');
      const rec = reconciliationService.performReconciliation(baseAccount, [sub.position]);

      assert(
        sub.position.stopLossFailed === true &&
        rec.report.stopsIntegrityValid === false &&
        rec.report.discrepancies.some(d => d.includes('STOP_LOSS_FAILED')),
        'Test 32: Stop loss modification failure flagged and caught by ledger reconciliation audit',
        `stopLossFailed: ${sub.position.stopLossFailed}, stopsValid: ${rec.report.stopsIntegrityValid}`
      );
    } else {
      assert(false, 'Test 32: Position missing for stop failure test');
    }
  }

  // Test 33: External / manual trade detection and portfolio exposure inclusion
  {
    const externalPos: any = {
      id: 'ext_pos_manual_1',
      symbol: 'EUR/USD',
      side: 'BUY',
      sizeLots: 0.10,
      entryPrice: 1.0850,
      currentPrice: 1.0850,
      stopLossPrice: 1.0820,
      takeProfitPrice: 1.0920,
      isTrailingStopActive: false,
      trailingStopDistancePips: 20,
      isBreakEvenLocked: false,
      unrealizedPnl: 0,
      realizedPnl: 0,
      commission: 7.0,
      swap: 0,
      brokerConfirmed: true,
      openedAt: Date.now() - 3600000,
      strategyId: 'MANUAL_EXTERNAL_TRADE'
    };

    const rec = reconciliationService.performReconciliation(baseAccount, [], {
      externalPositions: [externalPos]
    });

    assert(
      rec.report.externalPositionsCount === 1 &&
      rec.report.discrepancies.some(d => d.includes('EXTERNAL_TRADE_DETECTED')) &&
      rec.updatedAccount.marginUsed > 0,
      'Test 33: External/manual trade detected and incorporated into portfolio margin and risk exposure',
      `Ext count: ${rec.report.externalPositionsCount}, Margin used: $${rec.updatedAccount.marginUsed}`
    );
  }

  // Test 34: Truthful shadow validation & Phase 9 readiness gating
  {
    // Record a simulated observation
    const obs = shadowValidationService.recordObservation(baseQuote, 'NORMAL', 'NO_TRADE', 0);
    const metrics = shadowValidationService.getMetrics();
    const readiness = shadowValidationService.evaluatePhase9Readiness();

    assert(
      obs.isGenuineBrokerFeed === false &&
      metrics.provenanceStatus !== 'GENUINE_FEED_VERIFIED' &&
      readiness.overallReadiness === 'BLOCKED_PENDING_BROKER_AND_SETUP',
      'Test 34: Synthetic quotes excluded from genuine shadow evidence; Phase 9 truthfully gated and blocked',
      `isGenuine: ${obs.isGenuineBrokerFeed}, provenanceStatus: ${metrics.provenanceStatus}, readiness: ${readiness.overallReadiness}`
    );
  }

  // Test 35: Live mode locked by default without explicit approval
  {
    const gateEval = liveReleaseGateService.evaluateGates();
    const modeCheck = liveReleaseGateService.validateModeExecution('live');
    const riskEngine = new RiskEngine(10000);
    const orderCheck = riskEngine.validateOrderProposal(
      baseQuote,
      baseAccount,
      [],
      [],
      'BUY',
      1.0830,
      1.0850,
      [],
      { operatingMode: 'live' }
    );

    assert(
      gateEval.isLiveReleasePermitted === false &&
      modeCheck.isPermitted === false &&
      orderCheck.isApproved === false &&
      orderCheck.ruleBlocked === 'OPERATING_MODE_GATE_BLOCKED',
      'Test 35: Live mode locked by default; orders fail-closed without explicit approval',
      `permitted: ${gateEval.isLiveReleasePermitted}, orderApproved: ${orderCheck.isApproved}`
    );
  }

  // Test 36: Account mode mismatch: Live broker account detected while in demo mode blocks execution
  {
    const liveAccount: AccountState = {
      ...baseAccount,
      brokerConfirmed: true,
      isRealBrokerAccount: true
    };

    const riskEngine = new RiskEngine(10000);
    const orderCheck = riskEngine.validateOrderProposal(
      baseQuote,
      liveAccount,
      [],
      [],
      'BUY',
      1.0830,
      1.0850,
      [],
      { operatingMode: 'demo' }
    );

    assert(
      orderCheck.isApproved === false &&
      orderCheck.ruleBlocked === 'OPERATING_MODE_GATE_BLOCKED' &&
      orderCheck.rejectionMessage?.includes('ACCOUNT TYPE CONFLICT') === true,
      'Test 36: Account type conflict: Connected broker account is REAL while in demo mode blocks execution',
      `approved: ${orderCheck.isApproved}, msg: ${orderCheck.rejectionMessage}`
    );
  }

  // Test 37: Deliberate live activation rejects missing approval phrase or offline bridge
  {
    const badActivation = liveReleaseGateService.requestLiveActivation({
      operatorApprovalPhrase: 'WRONG PHRASE',
      localCredentialsPresent: false,
      brokerServerName: 'XMGlobal-Real 14',
      accountLoginNumber: '123456',
      accountType: 'REAL',
      acknowledgedExistingPositionsPolicy: false,
      acknowledgedRiskLimits: false,
      acknowledgedInstruments: ['EUR/USD']
    });

    assert(
      badActivation.success === false &&
      badActivation.rejectionDetails !== undefined &&
      badActivation.rejectionDetails.length >= 3,
      'Test 37: Live activation gate strictly rejects incomplete requirements and incorrect approval phrase',
      `success: ${badActivation.success}, errors: ${badActivation.rejectionDetails?.length}`
    );
  }

  // Test 38: Cross-platform Web App Manifest & Service Worker validation
  {
    const fs = await import('fs');
    const path = await import('path');
    const manifestPath = path.resolve(process.cwd(), 'public/manifest.json');
    const swPath = path.resolve(process.cwd(), 'public/sw.js');
    const manifestExists = fs.existsSync(manifestPath);
    const swExists = fs.existsSync(swPath);
    let manifestValid = false;
    if (manifestExists) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifestValid = manifest.id === '/' &&
        manifest.display === 'standalone' &&
        Array.isArray(manifest.icons) &&
        manifest.icons.length >= 4;
    }

    assert(
      manifestExists && swExists && manifestValid,
      'Test 38: PWA manifest, service worker, and standalone mobile configuration are valid and compliant',
      `manifest: ${manifestExists}, sw: ${swExists}, valid: ${manifestValid}`
    );
  }

  // Test 39: Truthful cross-platform broker boundaries: Mobile/macOS do not attempt native Windows MT5 execution
  {
    const fs = await import('fs');
    const path = await import('path');
    const archDoc = fs.readFileSync(path.resolve(process.cwd(), 'docs/CROSS_PLATFORM_ARCHITECTURE.md'), 'utf8');
    const hasLoopback = archDoc.includes('127.0.0.1:8000');
    const hasWorkstation = archDoc.toUpperCase().includes('WINDOWS WORKSTATION');
    const hasZeroCreds = archDoc.includes('Zero Credentials in Transit');
    const boundariesDocumented = hasLoopback && hasWorkstation && hasZeroCreds;

    assert(
      boundariesDocumented,
      'Test 39: Cross-platform broker boundary specification documented with truthful adapter limits',
      `loopback: ${hasLoopback}, workstation: ${hasWorkstation}, zeroCreds: ${hasZeroCreds}`
    );
  }

  // Test 40: Truthful operating mode derivation: When local MT5 bridge is offline, requested 'demo' falls back to 'simulated'
  {
    const derived = brokerGateway.deriveOperatingMode('demo');
    assert(
      derived.effectiveMode === 'simulated' && derived.isFallback === true && derived.reason.includes('offline'),
      'Test 40: Truthful operating mode derivation: Offline MT5 bridge falls back to simulated paper mode',
      `effectiveMode: ${derived.effectiveMode}, isFallback: ${derived.isFallback}`
    );
  }

  // Test 41: Separation of entry counting from trade closing
  {
    const isolatedRisk = new RiskEngine(10000);
    const initialTrades = isolatedRisk.getStatus().todayTradesCount;
    // Closing a position should NOT increment today's entry count
    isolatedRisk.recordPositionClosed(50.0, 0.05);
    const afterCloseTrades = isolatedRisk.getStatus().todayTradesCount;
    // An entry submission MUST increment today's entry count
    isolatedRisk.recordOrderEntry();
    const afterEntryTrades = isolatedRisk.getStatus().todayTradesCount;

    assert(
      initialTrades === 0 && afterCloseTrades === 0 && afterEntryTrades === 1,
      'Test 41: Separation of entry counting from trade closing (entries count on submission, closures do not)',
      `initial: ${initialTrades}, afterClose: ${afterCloseTrades}, afterEntry: ${afterEntryTrades}`
    );
  }

  // Test 42: Breaker preservation on kill-switch reset
  {
    const isolatedRisk = new RiskEngine(10000);
    // Trigger 5 consecutive losses to activate 30m breaker
    for (let i = 0; i < 5; i++) {
      isolatedRisk.recordCompletedTrade(-20.0);
    }
    const isLockedBefore = isolatedRisk.getStatus().isCooldownActive;
    // Operator triggers kill switch
    isolatedRisk.triggerKillSwitch();
    assert(isolatedRisk.getStatus().killSwitchTriggered === true, 'Test 42.1: Kill switch active');
    // Operator resets kill switch - breaker MUST be preserved
    isolatedRisk.resetKillSwitch();
    const statusAfterReset = isolatedRisk.getStatus();

    assert(
      isLockedBefore && statusAfterReset.killSwitchTriggered === false && statusAfterReset.isCooldownActive === true && statusAfterReset.isTradingPaused === true,
      'Test 42: Breaker preservation on kill-switch reset: 30-minute lockout remains intact after reset',
      `cooldownActive: ${statusAfterReset.isCooldownActive}, paused: ${statusAfterReset.isTradingPaused}`
    );
  }

  // Test 43: Truthful package status: Zero fake checksums and unbuilt native packages marked BLOCKED
  {
    const fs = await import('fs');
    const path = await import('path');
    const viewSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/views/ReleasePackagesView.tsx'), 'utf8');
    const hasUnbuiltTag = viewSrc.includes('NOT_BUILT_BLOCKED');
    const hasNoFakeHash = viewSrc.includes('None — Unbuilt artifact. No checksum fabricated.');
    const hasActivePwa = viewSrc.includes('VERIFIED_ACTIVE');

    assert(
      hasUnbuiltTag && hasNoFakeHash && hasActivePwa,
      'Test 43: Release page truthfulness: Zero fake checksums, unbuilt native packages marked BLOCKED with blockers',
      `unbuiltTag: ${hasUnbuiltTag}, noFakeHash: ${hasNoFakeHash}, activePwa: ${hasActivePwa}`
    );
  }

  // Test 44: Durable ledger integrity validation and fail-closed corrupt state handling
  {
    const fs = await import('fs');
    const path = await import('path');
    const storageCode = fs.readFileSync(path.resolve(process.cwd(), 'src/services/storageCheckpoint.ts'), 'utf8');
    const hasIntegrityDigest = storageCode.includes('integrityDigest');
    const hasSchemaV2 = storageCode.includes('schemaVersion: 2');
    const hasFailClosedValidation = storageCode.includes('INTEGRITY_MISMATCH');

    assert(
      hasIntegrityDigest && hasSchemaV2 && hasFailClosedValidation,
      'Test 44: Durable ledger integrity verification with schema v2 and tamper/corruption fail-closed checks',
      `integrityDigest: ${hasIntegrityDigest}, schemaV2: ${hasSchemaV2}, failClosed: ${hasFailClosedValidation}`
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
