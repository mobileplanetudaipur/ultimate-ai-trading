import { AccountState, EconomicEvent, MarketQuote, OperatingMode, OrderRecord, PositionRecord, RiskLimits, RiskStatus } from '../types/trading';
import { brokerGateway } from './brokerGateway';

export interface RiskValidationResult {
  isApproved: boolean;
  ruleBlocked?: string;
  rejectionMessage?: string;
  calculatedRiskAmount?: number;
  calculatedLotSize?: number;
  effectiveLeverageRatio?: number;
}

export class RiskEngine {
  private operatingMode: OperatingMode = 'simulated';

  private limits: RiskLimits = {
    maxRiskPerTradePercent: 0.20, // Baseline: Strict 0.20% reference equity risk per trade
    dailyLossLimitPercent: 1.00, // Baseline: Strict 1.00% daily loss ceiling
    maxOverallDrawdownPercent: 5.00, // Baseline: Strict 5.00% max overall drawdown
    maxOpenPositions: 3, // Baseline: 3 maximum simultaneous positions
    maxDailyTrades: 8, // Baseline: 8 trades per day maximum cap
    consecutiveLossLockoutThreshold: 5, // Baseline: 5 consecutive losses triggers 30m lock
    cooldownPeriodMinutes: 30, // 30 minutes lockout
    maxEffectiveLeverage: 3.0, // Baseline: 3x maximum effective leverage
    enforceWeekendClosure: true,
    enforceNewsBlackout: true
  };

  private status: RiskStatus = {
    isTradingPaused: false,
    consecutiveLossCount: 0,
    isCooldownActive: false,
    dailyStartingEquity: 10000,
    sessionStartingEquity: 10000,
    dailyPeriodKey: new Date().toISOString().slice(0, 10),
    todayRealizedPnl: 0,
    todayTradesCount: 0,
    todayDrawdownPercent: 0,
    dailyLossLimitBreached: false,
    dailyTradeCapBreached: false,
    killSwitchTriggered: false
  };

  constructor(initialEquity: number = 10000) {
    this.status.dailyStartingEquity = initialEquity;
    this.status.sessionStartingEquity = initialEquity;
  }

  public getLimits(): RiskLimits {
    return { ...this.limits };
  }

  public getStatus(): RiskStatus {
    this.ensureCurrentDay(this.status.dailyStartingEquity + this.status.todayRealizedPnl);
    // Check if cooldown has naturally elapsed
    if (this.status.isCooldownActive && this.status.cooldownEndsAt) {
      if (Date.now() >= this.status.cooldownEndsAt) {
        this.status.isCooldownActive = false;
        this.status.cooldownEndsAt = undefined;
      }
    }
    return { ...this.status };
  }

  public restoreStatus(status: RiskStatus) {
    this.status = {
      ...status,
      dailyPeriodKey: status.dailyPeriodKey ?? '',
      sessionStartingEquity: status.sessionStartingEquity ?? status.dailyStartingEquity
    };
  }

  public setOperatingMode(mode: OperatingMode) {
    this.operatingMode = mode;
  }

  public setTradingPaused(paused: boolean, reason?: string) {
    this.status.isTradingPaused = paused;
    this.status.pauseReason = reason;
  }

  public triggerKillSwitch() {
    this.status.killSwitchTriggered = true;
    this.status.killSwitchTriggeredAt = Date.now();
    this.status.isTradingPaused = true;
    this.status.pauseReason = 'Emergency Kill Switch Activated by Operator';
  }

  public resetKillSwitch() {
    this.status.killSwitchTriggered = false;
    this.status.killSwitchTriggeredAt = undefined;
    this.status.isTradingPaused = false;
    this.status.pauseReason = undefined;
  }

  public recordTradeEntry() {
    this.ensureCurrentDay(this.status.dailyStartingEquity + this.status.todayRealizedPnl);
    this.status.todayTradesCount += 1;
    if (this.status.todayTradesCount >= this.limits.maxDailyTrades) {
      this.status.dailyTradeCapBreached = true;
    }
  }

  public recordCompletedTrade(netPnl: number) {
    this.ensureCurrentDay(this.status.dailyStartingEquity + this.status.todayRealizedPnl);
    this.status.todayRealizedPnl += netPnl;

    if (netPnl < 0) {
      this.status.consecutiveLossCount += 1;
      if (this.status.consecutiveLossCount >= this.limits.consecutiveLossLockoutThreshold) {
        this.status.isCooldownActive = true;
        this.status.cooldownEndsAt = Date.now() + this.limits.cooldownPeriodMinutes * 60 * 1000;
      }
    } else if (netPnl > 0) {
      // Natural reset on genuine winning completed trade
      this.status.consecutiveLossCount = 0;
    }

    // Update daily drawdown
    const equityDrop = this.status.dailyStartingEquity - (this.status.dailyStartingEquity + this.status.todayRealizedPnl);
    if (equityDrop > 0) {
      this.status.todayDrawdownPercent = Number(((equityDrop / this.status.dailyStartingEquity) * 100).toFixed(2));
    } else {
      this.status.todayDrawdownPercent = 0;
    }

    if (this.status.todayDrawdownPercent >= this.limits.dailyLossLimitPercent) {
      this.status.dailyLossLimitBreached = true;
    }
  }

  private ensureCurrentDay(currentEquity: number) {
    const currentDay = new Date().toISOString().slice(0, 10);
    if (this.status.dailyPeriodKey === currentDay) return;

    this.status.dailyPeriodKey = currentDay;
    this.status.dailyStartingEquity = Math.max(1, currentEquity);
    this.status.todayRealizedPnl = 0;
    this.status.todayTradesCount = 0;
    this.status.todayDrawdownPercent = 0;
    this.status.dailyLossLimitBreached = false;
    this.status.dailyTradeCapBreached = false;
  }

  /**
   * Deterministic pre-trade validation gate (Phase 3)
   * Enforces 0.20% max risk, 1.00% daily loss, 8 trades/day, 5-loss/30m lock, 3x leverage,
   * instrument-aware contract sizes, and fail-closed checks.
   */
  public validateOrderProposal(
    quote: MarketQuote,
    account: AccountState,
    openPositions: PositionRecord[],
    pendingOrders: OrderRecord[],
    proposedSide: 'BUY' | 'SELL',
    proposedStopLoss: number,
    entryPrice: number,
    upcomingEvents?: EconomicEvent[]
  ): RiskValidationResult {
    this.ensureCurrentDay(account.equity);

    if (this.operatingMode !== 'simulated') {
      const blockedModes: Record<Exclude<OperatingMode, 'simulated'>, { rule: string; message: string }> = {
        read_only: {
          rule: 'READ_ONLY_MODE',
          message: 'Read-only observation mode does not permit paper order submissions.'
        },
        demo_pending: {
          rule: 'BROKER_ADAPTER_UNAVAILABLE',
          message: 'Demo execution remains blocked because the guarded XM order boundary is not connected to broker-fed strategies, durable portfolio reconciliation, and operator controls.'
        },
        disconnected: {
          rule: 'SYSTEM_DISCONNECTED',
          message: 'The system is disconnected. Order entries are blocked.'
        }
      };
      const blocked = blockedModes[this.operatingMode];
      return {
        isApproved: false,
        ruleBlocked: blocked.rule,
        rejectionMessage: blocked.message
      };
    }

    // 1. Emergency Kill Switch Check
    if (this.status.killSwitchTriggered) {
      return {
        isApproved: false,
        ruleBlocked: 'KILL_SWITCH_ACTIVE',
        rejectionMessage: 'System is locked under Emergency Kill Switch. All order entries halted.'
      };
    }

    // 2. Manual Pause Check
    if (this.status.isTradingPaused) {
      return {
        isApproved: false,
        ruleBlocked: 'TRADING_PAUSED',
        rejectionMessage: `Trading is currently paused: ${this.status.pauseReason || 'Operator restriction'}`
      };
    }

    // 3. Stage 9 Consecutive Loss Lockout Rule (5 consecutive losses -> 30m lock)
    if (this.status.isCooldownActive && this.status.cooldownEndsAt) {
      if (Date.now() < this.status.cooldownEndsAt) {
        const remainingMinutes = Math.ceil((this.status.cooldownEndsAt - Date.now()) / 60000);
        return {
          isApproved: false,
          ruleBlocked: 'CONSECUTIVE_LOSS_LOCKOUT',
          rejectionMessage: `Behavioral safeguard active: 5 consecutive losses triggered mandatory 30m cooling-off window (${remainingMinutes}m remaining). Cannot be overridden.`
        };
      }
    }

    // 4. Daily Trade Cap Check (8 trades per day max)
    const pendingEntryCount = pendingOrders.filter(order =>
      order.status === 'PREPARED' || order.status === 'RISK_APPROVED' || order.status === 'SUBMITTED_LOCAL'
    ).length;
    if (
      this.status.dailyTradeCapBreached
      || this.status.todayTradesCount + pendingEntryCount >= this.limits.maxDailyTrades
    ) {
      const countedTrades = this.status.todayTradesCount + pendingEntryCount;
      return {
        isApproved: false,
        ruleBlocked: 'DAILY_TRADE_CAP_EXCEEDED',
        rejectionMessage: `Daily trade cap reached (${countedTrades}/${this.limits.maxDailyTrades} entries today or pending). Entry blocked to prevent overtrading.`
      };
    }

    if (this.limits.enforceWeekendClosure) {
      const quoteDate = new Date(quote.timestamp);
      const weekday = quoteDate.getUTCDay();
      const utcHour = quoteDate.getUTCHours();
      if (weekday === 0 || weekday === 6 || (weekday === 5 && utcHour >= 20)) {
        return {
          isApproved: false,
          ruleBlocked: 'MARKET_CLOSED',
          rejectionMessage: 'The conservative UTC weekend/pre-close paper-trading lock is active. Broker-specific trading hours are not verified.'
        };
      }
    }

    // 5. Daily Loss Limit Check (1.00% max daily downside)
    if (this.status.dailyLossLimitBreached || this.status.todayDrawdownPercent >= this.limits.dailyLossLimitPercent) {
      return {
        isApproved: false,
        ruleBlocked: 'DAILY_LOSS_LIMIT_EXCEEDED',
        rejectionMessage: `Daily loss limit of ${this.limits.dailyLossLimitPercent.toFixed(2)}% reached (Current daily loss: ${this.status.todayDrawdownPercent}%). New risk prohibited.`
      };
    }

    // 6. Overall Portfolio Drawdown Check (5.00% max overall downside)
    const overallDrop = this.status.sessionStartingEquity - account.equity;
    if (overallDrop > 0) {
      const overallDrawdownPercent = (overallDrop / this.status.sessionStartingEquity) * 100;
      if (overallDrawdownPercent >= this.limits.maxOverallDrawdownPercent) {
        return {
          isApproved: false,
          ruleBlocked: 'OVERALL_DRAWDOWN_LIMIT_EXCEEDED',
          rejectionMessage: `Maximum overall drawdown threshold (${this.limits.maxOverallDrawdownPercent.toFixed(2)}%) reached (Current drawdown: ${overallDrawdownPercent.toFixed(2)}%). Capital preservation halt active.`
        };
      }
    }

    // 7. Data Feed Health & Stale Quote Check (Fail-closed)
    if (
      quote.freshness === 'unavailable'
      || quote.isStale
      || quote.latencyMs > 2000
      || Date.now() - quote.timestamp > 15000
      || ![quote.bid, quote.ask, quote.last, quote.spreadPips, quote.timestamp, entryPrice].every(Number.isFinite)
      || quote.bid <= 0
      || quote.ask < quote.bid
      || quote.pipMultiplier <= 0
      || quote.spreadPips < 0
    ) {
      return {
        isApproved: false,
        ruleBlocked: 'FEED_UNRELIABLE',
        rejectionMessage: `Market data is stale, unavailable, or invalid (freshness: ${quote.freshness}, latency: ${quote.latencyMs}ms). Order rejected for execution safety.`
      };
    }

    const spec = brokerGateway.getInstrumentSpec(quote.symbol);
    if (!spec) {
      return {
        isApproved: false,
        ruleBlocked: 'UNSUPPORTED_INSTRUMENT',
        rejectionMessage: `No paper-simulation contract assumptions are configured for '${quote.symbol}'.`
      };
    }
    if (account.currency !== 'USD' || account.equity <= 0 || account.leverage <= 0) {
      return {
        isApproved: false,
        ruleBlocked: 'UNSUPPORTED_ACCOUNT_CONFIGURATION',
        rejectionMessage: 'Paper risk sizing requires a positive-equity USD account with positive leverage.'
      };
    }

    // 8. Synthetic high-impact event blackout (30m before and 15m after)
    if (this.limits.enforceNewsBlackout && upcomingEvents && upcomingEvents.length > 0) {
      const quoteCurrencies = quote.symbol.split('/');
      const highImpactEvents = upcomingEvents.filter(e =>
        e.impact === 'HIGH' && quoteCurrencies.includes(e.currency)
      );
      for (const evt of highImpactEvents) {
        const minutesAway = (evt.scheduledTime - quote.timestamp) / 60000;
        if ((minutesAway > 0 && minutesAway <= 30) || (minutesAway <= 0 && minutesAway >= -15)) {
          const window = minutesAway > 0 ? 'pre-release' : 'post-release';
          return {
            isApproved: false,
            ruleBlocked: 'NEWS_BLACKOUT_ACTIVE',
            rejectionMessage: `High-impact ${evt.currency} event '${evt.title}' is in its ${window} blackout window.`
          };
        }
      }
    }

    // 9. Max Open Positions Cap (Max 3 positions)
    const pendingEntries = pendingOrders.filter(order =>
      order.status === 'PREPARED' || order.status === 'RISK_APPROVED' || order.status === 'SUBMITTED_LOCAL'
    );
    if (openPositions.length + pendingEntries.length >= this.limits.maxOpenPositions) {
      return {
        isApproved: false,
        ruleBlocked: 'MAX_POSITIONS_REACHED',
        rejectionMessage: `Maximum concurrent or pending entries reached (${openPositions.length + pendingEntries.length}/${this.limits.maxOpenPositions}).`
      };
    }

    // 10. Stop Loss Validity & Distance Check
    if (!proposedStopLoss || proposedStopLoss <= 0) {
      return {
        isApproved: false,
        ruleBlocked: 'MISSING_STOP_LOSS',
        rejectionMessage: 'Strict deterministic rule: Every order MUST possess a valid stop-loss price.'
      };
    }

    const priceDistance = Number(Math.abs(entryPrice - proposedStopLoss).toFixed(quote.digits));
    if (priceDistance <= 0) {
      return {
        isApproved: false,
        ruleBlocked: 'ZERO_STOP_DISTANCE',
        rejectionMessage: 'Stop loss price cannot be identical to entry price.'
      };
    }

    const minDistance = (quote.spreadPips * 1.5) / quote.pipMultiplier;
    if (priceDistance < minDistance) {
      return {
        isApproved: false,
        ruleBlocked: 'STOP_TOO_CLOSE',
        rejectionMessage: `Stop distance (${priceDistance.toFixed(quote.digits)}) is within spread buffer (${minDistance.toFixed(quote.digits)}).`
      };
    }

    if (proposedSide === 'BUY' && proposedStopLoss >= entryPrice) {
      return {
        isApproved: false,
        ruleBlocked: 'INVALID_BUY_STOP',
        rejectionMessage: 'For BUY orders, stop-loss price must be strictly BELOW the entry price.'
      };
    }

    if (proposedSide === 'SELL' && proposedStopLoss <= entryPrice) {
      return {
        isApproved: false,
        ruleBlocked: 'INVALID_SELL_STOP',
        rejectionMessage: 'For SELL orders, stop-loss price must be strictly ABOVE the entry price.'
      };
    }

    // 11. Instrument-Aware Position Sizing using Exact Contract Specifications
    const contractSize = spec.contractSize; // 100,000 for FX, 100 for Gold, 1 for BTC

    // Risk budget: strictly 0.20% of account equity
    const riskPercent = this.limits.maxRiskPerTradePercent; // 0.20%
    const riskBudgetUsd = Number(((account.equity * (riskPercent / 100))).toFixed(2));

    // Loss per 1 lot move: convert to account currency (USD)
    let lossPerLot = contractSize * priceDistance;
    if (spec.quoteCurrency === 'JPY' && account.currency === 'USD') {
      lossPerLot = (contractSize * priceDistance) / (entryPrice || 1);
    }
    lossPerLot = Number(lossPerLot.toFixed(4));
    if (lossPerLot <= 0) {
      return {
        isApproved: false,
        ruleBlocked: 'CALCULATION_ERROR',
        rejectionMessage: 'Unable to calculate loss per lot reliably for this instrument.'
      };
    }

    const rawLots = (riskBudgetUsd / lossPerLot);
    const minVol = spec.minVolumeLots;
    const worstCaseLossAtMinLot = minVol * lossPerLot;

    // Reject if even the minimum 0.01 lot exceeds the 0.20% risk budget
    if (worstCaseLossAtMinLot > riskBudgetUsd) {
      return {
        isApproved: false,
        ruleBlocked: 'LOT_SIZE_EXCEEDS_MAX_RISK',
        rejectionMessage: `Minimum broker lot (${minVol}) would risk $${worstCaseLossAtMinLot.toFixed(2)}, which exceeds the approved 0.20% risk budget ($${riskBudgetUsd.toFixed(2)}). Trade rejected to protect capital.`
      };
    }

    // Add tiny epsilon to handle floating point truncation before floor
    const steps = Math.min(
      Math.floor((rawLots + 1e-9) / spec.volumeStepLots),
      Math.floor(spec.maxVolumeLots / spec.volumeStepLots)
    );
    const calculatedLotSize = Number((Math.max(spec.minVolumeLots, steps * spec.volumeStepLots)).toFixed(2));

    // Re-verify actual worst-case risk at calculated lot
    const actualRiskAmount = Number((calculatedLotSize * lossPerLot).toFixed(2));
    if (actualRiskAmount > riskBudgetUsd) {
      return {
        isApproved: false,
        ruleBlocked: 'RISK_BUDGET_EXCEEDED',
        rejectionMessage: `Calculated position risk ($${actualRiskAmount}) exceeds approved 0.20% limit ($${riskBudgetUsd}).`
      };
    }

    // 10. Maximum Effective Leverage Check (3x Cap)
    let currentOpenExposureUsd = 0;
    for (const pos of openPositions) {
      const posSpec = brokerGateway.getInstrumentSpec(pos.symbol);
      if (!posSpec) {
        return {
          isApproved: false,
          ruleBlocked: 'UNSUPPORTED_INSTRUMENT',
          rejectionMessage: `Open paper position uses unsupported instrument '${pos.symbol}'.`
        };
      }
      const posValUsd = posSpec.baseCurrency === 'USD'
        ? pos.sizeLots * posSpec.contractSize
        : pos.sizeLots * posSpec.contractSize * pos.currentPrice;
      currentOpenExposureUsd += posValUsd;
    }
    for (const pendingOrder of pendingEntries) {
      const pendingSpec = brokerGateway.getInstrumentSpec(pendingOrder.symbol);
      if (!pendingSpec) {
        return {
          isApproved: false,
          ruleBlocked: 'UNSUPPORTED_INSTRUMENT',
          rejectionMessage: `Pending paper order uses unsupported instrument '${pendingOrder.symbol}'.`
        };
      }
      const pendingExposureUsd = pendingSpec.baseCurrency === 'USD'
        ? pendingOrder.requestedSizeLots * pendingSpec.contractSize
        : pendingOrder.requestedSizeLots * pendingSpec.contractSize * pendingOrder.requestedPrice;
      currentOpenExposureUsd += pendingExposureUsd;
    }
    const newPositionValueUsd = spec.baseCurrency === 'USD'
      ? calculatedLotSize * contractSize
      : calculatedLotSize * contractSize * entryPrice;
    const totalExposureUsd = currentOpenExposureUsd + newPositionValueUsd;
    const effectiveLeverage = totalExposureUsd / (account.equity || 1);

    if (effectiveLeverage > this.limits.maxEffectiveLeverage) {
      return {
        isApproved: false,
        ruleBlocked: 'EXCEEDS_MAX_LEVERAGE_3X',
        rejectionMessage: `Effective portfolio leverage would reach ${effectiveLeverage.toFixed(2)}x, exceeding the mandatory 3.0x leverage ceiling.`
      };
    }

    // 11. Margin Headroom Check
    const requiredMargin = newPositionValueUsd / account.leverage;
    if (requiredMargin > account.freeMargin * 0.8) {
      return {
        isApproved: false,
        ruleBlocked: 'INSUFFICIENT_FREE_MARGIN',
        rejectionMessage: `Required margin ($${requiredMargin.toFixed(2)}) exceeds 80% buffer of available free margin ($${account.freeMargin.toFixed(2)}).`
      };
    }

    return {
      isApproved: true,
      calculatedRiskAmount: actualRiskAmount,
      calculatedLotSize,
      effectiveLeverageRatio: Number(effectiveLeverage.toFixed(2))
    };
  }
}

export const riskEngine = new RiskEngine();
