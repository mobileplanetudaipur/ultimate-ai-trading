import { AccountState, MarketQuote, OrderRecord, PositionRecord, RiskLimits, RiskStatus } from '../types/trading';

export interface RiskValidationResult {
  isApproved: boolean;
  ruleBlocked?: string;
  rejectionMessage?: string;
  calculatedRiskAmount?: number;
  calculatedLotSize?: number;
}

export class RiskEngine {
  private limits: RiskLimits = {
    maxRiskPerTradePercent: 1.0, // 1% account equity risk per trade
    maxTotalExposurePercent: 5.0, // Max 5% cumulative risk across all open positions
    dailyLossLimitPercent: 3.0, // 3% max daily loss relative to starting equity
    maxDrawdownPercent: 6.0, // 6% overall drawdown ceiling
    maxOpenPositions: 3,
    consecutiveLossLockoutThreshold: 5, // 5 consecutive losses triggers lockout
    cooldownPeriodMinutes: 30, // 30 minutes lockout
    enforceWeekendClosure: true,
    enforceNewsBlackout: true
  };

  private status: RiskStatus = {
    isTradingPaused: false,
    consecutiveLossCount: 0,
    isCooldownActive: false,
    dailyStartingEquity: 10000,
    todayRealizedPnl: 0,
    todayDrawdownPercent: 0,
    dailyLossLimitBreached: false,
    overallMaxDrawdownBreached: false,
    killSwitchTriggered: false
  };

  constructor(initialEquity: number = 10000) {
    this.status.dailyStartingEquity = initialEquity;
  }

  public getLimits(): RiskLimits {
    return { ...this.limits };
  }

  public updateLimits(newLimits: Partial<RiskLimits>) {
    this.limits = { ...this.limits, ...newLimits };
  }

  public getStatus(): RiskStatus {
    // Check if cooldown has expired
    if (this.status.isCooldownActive && this.status.cooldownEndsAt) {
      if (Date.now() >= this.status.cooldownEndsAt) {
        this.status.isCooldownActive = false;
        this.status.cooldownEndsAt = undefined;
      }
    }
    return { ...this.status };
  }

  public setTradingPaused(paused: boolean, reason?: string) {
    this.status.isTradingPaused = paused;
    this.status.pauseReason = reason;
  }

  public triggerKillSwitch() {
    this.status.killSwitchTriggered = true;
    this.status.killSwitchTriggeredAt = Date.now();
    this.status.isTradingPaused = true;
    this.status.pauseReason = 'Emergency Kill Switch Triggered by Operator';
  }

  public resetKillSwitch() {
    this.status.killSwitchTriggered = false;
    this.status.killSwitchTriggeredAt = undefined;
    this.status.isTradingPaused = false;
    this.status.pauseReason = undefined;
  }

  public recordCompletedTrade(netPnl: number) {
    this.status.todayRealizedPnl += netPnl;

    if (netPnl < 0) {
      this.status.consecutiveLossCount += 1;
      if (this.status.consecutiveLossCount >= this.limits.consecutiveLossLockoutThreshold) {
        this.status.isCooldownActive = true;
        this.status.cooldownEndsAt = Date.now() + this.limits.cooldownPeriodMinutes * 60 * 1000;
      }
    } else {
      this.status.consecutiveLossCount = 0;
    }

    // Update drawdown
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

  /**
   * Deterministic pre-trade validation gate (Stage 8)
   */
  public validateOrderProposal(
    quote: MarketQuote,
    account: AccountState,
    openPositions: PositionRecord[],
    pendingOrders: OrderRecord[],
    proposedSide: 'BUY' | 'SELL',
    proposedStopLoss: number,
    entryPrice: number,
    desiredRiskPercent: number = 1.0
  ): RiskValidationResult {
    // 1. Kill Switch Check
    if (this.status.killSwitchTriggered) {
      return {
        isApproved: false,
        ruleBlocked: 'KILL_SWITCH_ACTIVE',
        rejectionMessage: 'System is locked under Emergency Kill Switch state. All automated entries disabled.'
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

    // 3. Consecutive Loss Lockout Rule (Stage 9)
    if (this.status.isCooldownActive && this.status.cooldownEndsAt) {
      if (Date.now() < this.status.cooldownEndsAt) {
        const remainingMinutes = Math.ceil((this.status.cooldownEndsAt - Date.now()) / 60000);
        return {
          isApproved: false,
          ruleBlocked: 'CONSECUTIVE_LOSS_LOCKOUT',
          rejectionMessage: `Behavioral safeguard active: ${this.status.consecutiveLossCount} consecutive losses triggered 30m cooling-off window (${remainingMinutes}m remaining).`
        };
      }
    }

    // 4. Daily Loss Limit Check
    if (this.status.dailyLossLimitBreached || this.status.todayDrawdownPercent >= this.limits.dailyLossLimitPercent) {
      return {
        isApproved: false,
        ruleBlocked: 'DAILY_LOSS_LIMIT_EXCEEDED',
        rejectionMessage: `Daily loss limit of ${this.limits.dailyLossLimitPercent}% reached (Current: ${this.status.todayDrawdownPercent}%). No further risk permitted today.`
      };
    }

    // 5. Data Feed Health & Stale Quote Check (Stage 3)
    if (quote.freshness === 'unavailable' || quote.isStale || quote.latencyMs > 2000) {
      return {
        isApproved: false,
        ruleBlocked: 'FEED_UNRELIABLE',
        rejectionMessage: `Market data feed is ${quote.freshness} (latency: ${quote.latencyMs}ms). Order rejected for execution safety.`
      };
    }

    // 6. Reconciliation Integrity Check (Stage 4)
    if (account.reconciliationStatus === 'DISCREPANCY_DETECTED') {
      return {
        isApproved: false,
        ruleBlocked: 'ACCOUNT_DISCREPANCY',
        rejectionMessage: 'Unresolved discrepancy detected between local state and broker state. New entries blocked until reconciled.'
      };
    }

    // 7. Max Open Positions Cap
    if (openPositions.length >= this.limits.maxOpenPositions) {
      return {
        isApproved: false,
        ruleBlocked: 'MAX_POSITIONS_REACHED',
        rejectionMessage: `Maximum concurrent positions reached (${openPositions.length}/${this.limits.maxOpenPositions}).`
      };
    }

    // 8. Stop Loss Validity Check
    if (!proposedStopLoss || proposedStopLoss <= 0) {
      return {
        isApproved: false,
        ruleBlocked: 'MISSING_STOP_LOSS',
        rejectionMessage: 'Strict deterministic rule: Every order MUST possess a valid stop-loss price.'
      };
    }

    const priceDistance = Math.abs(entryPrice - proposedStopLoss);
    const minDistance = (quote.spreadPips * 1.5) / quote.pipMultiplier;
    if (priceDistance < minDistance) {
      return {
        isApproved: false,
        ruleBlocked: 'STOP_TOO_CLOSE',
        rejectionMessage: `Stop distance (${priceDistance.toFixed(quote.digits)}) is inside broker freeze/spread buffer (${minDistance.toFixed(quote.digits)}).`
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

    // 9. Position Sizing based on fixed fractional risk %
    const riskPercent = Math.min(desiredRiskPercent, this.limits.maxRiskPerTradePercent);
    const riskAmount = (account.equity * (riskPercent / 100));

    // Calculate lots based on stop distance and instrument pip value
    // Risk = Lots * 100,000 * priceDistance (for FX)
    const rawLots = riskAmount / (100000 * priceDistance);
    const safeLotSize = Math.max(0.01, Math.min(2.0, Math.round(rawLots * 100) / 100));

    // 10. Margin Availability Check
    const requiredMargin = (safeLotSize * 100000 * entryPrice) / account.leverage;
    if (requiredMargin > account.freeMargin * 0.8) {
      return {
        isApproved: false,
        ruleBlocked: 'INSUFFICIENT_FREE_MARGIN',
        rejectionMessage: `Required margin ($${requiredMargin.toFixed(2)}) exceeds 80% buffer of free margin ($${account.freeMargin.toFixed(2)}).`
      };
    }

    return {
      isApproved: true,
      calculatedRiskAmount: Number(riskAmount.toFixed(2)),
      calculatedLotSize: safeLotSize
    };
  }
}

export const riskEngine = new RiskEngine();
