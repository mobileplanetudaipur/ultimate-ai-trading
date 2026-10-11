import { AccountState, ClosedTradeRecord, EconomicEvent, MarketQuote, OperatingMode, OrderRecord, PositionRecord, RiskLimits, RiskStatus } from '../types/trading';
import { brokerGateway } from './brokerGateway';
import { liveReleaseGateService } from './liveReleaseGateService';

export interface RiskValidationResult {
  isApproved: boolean;
  ruleBlocked?: string;
  rejectionMessage?: string;
  calculatedRiskAmount?: number;
  calculatedLotSize?: number;
  effectiveLeverageRatio?: number;
}

export interface OrderProposalOptions {
  operatingMode?: OperatingMode;
  proposedTakeProfit?: number;
  recentClosedTrades?: ClosedTradeRecord[];
  isClosedCandleSignal?: boolean;
  requestedLotSize?: number;
}

export class RiskEngine {
  private limits: RiskLimits = {
    maxRiskPerTradePercent: 0.20, // Baseline: Strict 0.20% reference equity risk per trade
    dailyLossLimitPercent: 1.00, // Baseline: Strict 1.00% daily loss ceiling
    maxOverallDrawdownPercent: 5.00, // Baseline: Strict 5.00% max overall drawdown
    maxOpenPositions: 3, // Baseline: 3 maximum simultaneous positions
    maxDailyTrades: 8, // Baseline: 8 entries per day maximum cap
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
    todayRealizedPnl: 0,
    todayTradesCount: 0, // Specifically counts daily entries, distinct from trade closures
    todayDrawdownPercent: 0,
    dailyLossLimitBreached: false,
    dailyTradeCapBreached: false,
    killSwitchTriggered: false
  };

  private lastResetDayUtc: number = new Date().getUTCDate();
  private lastCompletedTrade?: { netPnl: number; sizeLots: number; timestamp: number };

  constructor(initialEquity: number = 10000) {
    this.status.dailyStartingEquity = initialEquity;
  }

  public getLimits(): RiskLimits {
    return { ...this.limits };
  }

  public getStatus(): RiskStatus {
    this.checkDailyRoll();
    // Check if cooldown has naturally elapsed
    if (this.status.isCooldownActive && this.status.cooldownEndsAt) {
      if (Date.now() >= this.status.cooldownEndsAt) {
        this.status.isCooldownActive = false;
        this.status.cooldownEndsAt = undefined;
        this.status.consecutiveLossCount = 0;
        if (!this.status.killSwitchTriggered && !this.status.dailyLossLimitBreached && !this.status.dailyTradeCapBreached) {
          this.status.isTradingPaused = false;
          this.status.pauseReason = undefined;
        }
      }
    }
    return { ...this.status };
  }

  /**
   * Deterministic daily UTC boundary check.
   * Rolls at 00:00:00 UTC. Resets daily trade counts and resets starting equity reference.
   */
  public checkDailyRoll(currentEquity?: number) {
    const currentUtcDay = new Date().getUTCDate();
    if (currentUtcDay !== this.lastResetDayUtc) {
      this.lastResetDayUtc = currentUtcDay;
      this.status.todayTradesCount = 0;
      this.status.todayRealizedPnl = 0;
      this.status.todayDrawdownPercent = 0;
      this.status.dailyLossLimitBreached = false;
      this.status.dailyTradeCapBreached = false;
      if (currentEquity && currentEquity > 0) {
        this.status.dailyStartingEquity = currentEquity;
      }
    }
  }

  public setDailyStartingEquity(equity: number) {
    if (equity > 0) {
      this.status.dailyStartingEquity = equity;
    }
  }

  public getLastCompletedTrade() {
    return this.lastCompletedTrade ? { ...this.lastCompletedTrade } : undefined;
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

  /**
   * Reset kill switch without erasing unrelated risk breakers or active cooldowns.
   */
  public resetKillSwitch() {
    this.status.killSwitchTriggered = false;
    this.status.killSwitchTriggeredAt = undefined;

    // RULE: A kill-switch reset must not erase unrelated risk breakers or pauses.
    if (this.status.isCooldownActive) {
      this.status.isTradingPaused = true;
      this.status.pauseReason = '30-minute consecutive loss lockout active.';
    } else if (this.status.dailyLossLimitBreached) {
      this.status.isTradingPaused = true;
      this.status.pauseReason = 'Daily loss limit (1.00%) reached.';
    } else if (this.status.dailyTradeCapBreached) {
      this.status.isTradingPaused = true;
      this.status.pauseReason = 'Daily trade cap (8 entries) reached.';
    } else {
      this.status.isTradingPaused = false;
      this.status.pauseReason = undefined;
    }
  }

  /**
   * Phase 3: Separate entry counting from trade closing.
   * Increments today's entries on order submission / fill.
   */
  public recordOrderEntry() {
    this.checkDailyRoll();
    this.status.todayTradesCount += 1;
    if (this.status.todayTradesCount >= this.limits.maxDailyTrades) {
      this.status.dailyTradeCapBreached = true;
    }
  }

  /**
   * Records a position closure (P&L and consecutive loss tracking) WITHOUT incrementing entry count.
   */
  public recordPositionClosed(netPnl: number, tradeLots: number = 0.01) {
    this.checkDailyRoll();
    this.status.todayRealizedPnl += netPnl;
    this.lastCompletedTrade = { netPnl, sizeLots: tradeLots, timestamp: Date.now() };

    const isUnderActiveLockout =
      this.status.isCooldownActive &&
      this.status.cooldownEndsAt !== undefined &&
      Date.now() < this.status.cooldownEndsAt;

    if (netPnl < 0) {
      this.status.consecutiveLossCount += 1;
      if (this.status.consecutiveLossCount >= this.limits.consecutiveLossLockoutThreshold) {
        this.status.isCooldownActive = true;
        this.status.cooldownEndsAt = Date.now() + this.limits.cooldownPeriodMinutes * 60 * 1000;
        this.status.isTradingPaused = true;
        this.status.pauseReason = '5 consecutive losses triggered mandatory 30m cooling-off lockout.';
      }
    } else {
      if (!isUnderActiveLockout) {
        this.status.consecutiveLossCount = 0;
      }
    }

    const equityDrop = this.status.dailyStartingEquity - (this.status.dailyStartingEquity + this.status.todayRealizedPnl);
    if (equityDrop > 0) {
      this.status.todayDrawdownPercent = Number(((equityDrop / this.status.dailyStartingEquity) * 100).toFixed(2));
    } else {
      this.status.todayDrawdownPercent = 0;
    }

    if (this.status.todayDrawdownPercent >= this.limits.dailyLossLimitPercent) {
      this.status.dailyLossLimitBreached = true;
      this.status.isTradingPaused = true;
      this.status.pauseReason = 'Daily loss limit (1.00%) reached.';
    }
  }

  /**
   * Records a completed trade (backward-compatible: updates P&L and increments entry count).
   */
  public recordCompletedTrade(netPnl: number, tradeLots: number = 0.01) {
    this.recordPositionClosed(netPnl, tradeLots);
    this.recordOrderEntry();
  }

  /**
   * Deterministic pre-trade validation gate (Phase 3)
   * Enforces 0.20% max risk, 1.00% daily loss, 8 entries/day, 5-loss/30m lock, 3x leverage,
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
    upcomingEvents?: EconomicEvent[],
    options?: OrderProposalOptions
  ): RiskValidationResult {
    this.checkDailyRoll(account.equity);

    // 0. Account & Operating Mode Gate
    if (options?.operatingMode === 'read_only') {
      return {
        isApproved: false,
        ruleBlocked: 'READ_ONLY_MODE_ACTIVE',
        rejectionMessage: 'Operating mode is set to Read-Only Observation. All order execution is disabled.'
      };
    }

    if (options?.operatingMode === 'disconnected') {
      return {
        isApproved: false,
        ruleBlocked: 'DISCONNECTED_MODE_ACTIVE',
        rejectionMessage: 'Operating mode is Disconnected. All trading engines are suspended.'
      };
    }

    if (options?.operatingMode) {
      const modeCheck = liveReleaseGateService.validateModeExecution(
        options.operatingMode,
        account.brokerConfirmed && (account as any).isRealBrokerAccount === true
      );
      if (!modeCheck.isPermitted) {
        return {
          isApproved: false,
          ruleBlocked: 'OPERATING_MODE_GATE_BLOCKED',
          rejectionMessage: modeCheck.rejectionReason || 'Operating mode does not permit order execution.'
        };
      }
    }

    if (options?.operatingMode === 'demo_pending' || options?.operatingMode === 'demo') {
      const brokerStatus = brokerGateway.getStatus();
      if (!brokerStatus.isConnected) {
        return {
          isApproved: false,
          ruleBlocked: 'BROKER_BRIDGE_DISCONNECTED',
          rejectionMessage: 'XM MT5 demo bridge is disconnected. Live/demo execution is blocked until connection is verified.'
        };
      }
    }

    // Ledger / Accounting Reconciliation Check
    if (account.reconciliationStatus === 'DISCREPANCY_DETECTED') {
      return {
        isApproved: false,
        ruleBlocked: 'ACCOUNT_DISCREPANCY_HALT',
        rejectionMessage: 'Ledger discrepancy detected during reconciliation audit. Order submission halted to protect account integrity.'
      };
    }

    // Closed-candle confirmation check
    if (options?.isClosedCandleSignal === false) {
      return {
        isApproved: false,
        ruleBlocked: 'UNCONFIRMED_INTRABAR_SIGNAL',
        rejectionMessage: 'Safety requirement: Order proposals must only be generated on confirmed closed candles, never unconfirmed intrabar ticks.'
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

    // 2. Stage 9 Consecutive Loss Lockout Rule (5 consecutive losses -> 30m lock)
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

    // 3. Daily Entry Cap Check (8 trades per day max)
    if (this.status.dailyTradeCapBreached || this.status.todayTradesCount >= this.limits.maxDailyTrades) {
      return {
        isApproved: false,
        ruleBlocked: 'DAILY_TRADE_CAP_EXCEEDED',
        rejectionMessage: `Daily trade cap reached (${this.status.todayTradesCount}/${this.limits.maxDailyTrades} entries today). Entry blocked to prevent overtrading.`
      };
    }

    // 4. Overall Portfolio Drawdown Check (5.00% max overall downside - evaluated before daily if overall threshold exceeded)
    const overallDrop = this.status.dailyStartingEquity - account.equity;
    if (overallDrop > 0) {
      const overallDrawdownPercent = (overallDrop / this.status.dailyStartingEquity) * 100;
      if (overallDrawdownPercent >= this.limits.maxOverallDrawdownPercent) {
        return {
          isApproved: false,
          ruleBlocked: 'OVERALL_DRAWDOWN_LIMIT_EXCEEDED',
          rejectionMessage: `Maximum overall drawdown threshold (${this.limits.maxOverallDrawdownPercent.toFixed(2)}%) reached (Current drawdown: ${overallDrawdownPercent.toFixed(2)}%). Capital preservation halt active.`
        };
      }
    }

    // 5. Daily Loss Limit Check (1.00% max daily downside)
    const totalFloatingPnl = openPositions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
    const effectiveDrop = this.status.dailyStartingEquity - (account.equity + totalFloatingPnl);
    const effectiveDrawdownPercent = effectiveDrop > 0
      ? Number(((effectiveDrop / this.status.dailyStartingEquity) * 100).toFixed(2))
      : this.status.todayDrawdownPercent;

    if (
      this.status.dailyLossLimitBreached ||
      this.status.todayDrawdownPercent >= this.limits.dailyLossLimitPercent ||
      effectiveDrawdownPercent >= this.limits.dailyLossLimitPercent
    ) {
      return {
        isApproved: false,
        ruleBlocked: 'DAILY_LOSS_LIMIT_EXCEEDED',
        rejectionMessage: `Daily loss limit of ${this.limits.dailyLossLimitPercent.toFixed(2)}% reached (Current daily loss: ${effectiveDrawdownPercent}%). New risk prohibited.`
      };
    }

    // 6. Manual Operator Pause Check
    if (this.status.isTradingPaused) {
      return {
        isApproved: false,
        ruleBlocked: 'TRADING_PAUSED',
        rejectionMessage: `Trading is currently paused: ${this.status.pauseReason || 'Operator restriction'}`
      };
    }

    // 7. Data Feed Health & Stale Quote Check (Fail-closed)
    if (quote.freshness === 'unavailable' || quote.isStale || quote.latencyMs > 2000) {
      return {
        isApproved: false,
        ruleBlocked: 'FEED_UNRELIABLE',
        rejectionMessage: `Market data feed is ${quote.freshness} (latency: ${quote.latencyMs}ms). Order rejected for execution safety.`
      };
    }

    // 8. Economic News Event Blackout Check (30m pre-event window)
    if (this.limits.enforceNewsBlackout && upcomingEvents && upcomingEvents.length > 0) {
      const highImpactEvents = upcomingEvents.filter(e => e.impact === 'HIGH');
      for (const evt of highImpactEvents) {
        const minutesAway = (evt.scheduledTime - quote.timestamp) / 60000;
        if (minutesAway > 0 && minutesAway <= 30) {
          return {
            isApproved: false,
            ruleBlocked: 'NEWS_BLACKOUT_ACTIVE',
            rejectionMessage: `Tier-1 event '${evt.title}' scheduled in ${Math.round(minutesAway)}m. Pre-event blackout window active (30m).`
          };
        }
      }
    }

    // 9. Max Open Positions Cap (Max 3 positions)
    if (openPositions.length >= this.limits.maxOpenPositions) {
      return {
        isApproved: false,
        ruleBlocked: 'MAX_POSITIONS_REACHED',
        rejectionMessage: `Maximum concurrent positions reached (${openPositions.length}/${this.limits.maxOpenPositions}).`
      };
    }

    // 10. Anti-Grid Averaging Down & Uncontrolled Scaling Check
    const existingPositionOnSymbol = openPositions.find(p => p.symbol === quote.symbol);
    if (
      existingPositionOnSymbol &&
      (existingPositionOnSymbol.side === proposedSide ||
        (existingPositionOnSymbol.unrealizedPnl !== undefined && existingPositionOnSymbol.unrealizedPnl < 0))
    ) {
      return {
        isApproved: false,
        ruleBlocked: 'GRID_AVERAGING_PROHIBITED',
        rejectionMessage: `Anti-grid and scaling safeguard: Position in ${quote.symbol} already exists. Averaging down or stacking concurrent positions in the same symbol is prohibited.`
      };
    }

    // 11. In-Flight Duplicate Order Protection
    const duplicatePending = pendingOrders.find(
      o =>
        o.symbol === quote.symbol &&
        o.side === proposedSide &&
        (o.status === 'PREPARED' || o.status === 'SUBMITTED_LOCAL')
    );
    if (duplicatePending) {
      return {
        isApproved: false,
        ruleBlocked: 'DUPLICATE_ORDER_IN_FLIGHT',
        rejectionMessage: `Duplicate protection: Order ${duplicatePending.id} for ${quote.symbol} ${proposedSide} is already pending submission.`
      };
    }

    // 12. Revenge Trading Safeguard (Mandatory 5-minute cooldown after loss on same symbol)
    if (options?.recentClosedTrades && options.recentClosedTrades.length > 0) {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const recentLossOnSymbol = options.recentClosedTrades.find(
        t => t.symbol === quote.symbol && t.netPnl < 0 && t.closedAt > fiveMinutesAgo
      );
      if (recentLossOnSymbol) {
        const remainingSeconds = Math.ceil((recentLossOnSymbol.closedAt + 5 * 60 * 1000 - Date.now()) / 1000);
        return {
          isApproved: false,
          ruleBlocked: 'REVENGE_TRADING_COOLDOWN',
          rejectionMessage: `Anti-revenge safeguard: Rapid re-entry cooldown active for ${quote.symbol} following recent loss (${remainingSeconds}s remaining).`
        };
      }
    }

    // 13. Stop Loss Validity & Distance Check
    if (!proposedStopLoss || proposedStopLoss <= 0 || isNaN(proposedStopLoss)) {
      return {
        isApproved: false,
        ruleBlocked: 'MISSING_STOP_LOSS',
        rejectionMessage: 'Strict deterministic rule: Every order MUST possess a valid numerical stop-loss price.'
      };
    }

    const priceDistance = Number(Math.abs(entryPrice - proposedStopLoss).toFixed(quote.digits));
    if (priceDistance <= 0 || isNaN(priceDistance)) {
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

    // Take Profit direction check
    if (options?.proposedTakeProfit !== undefined && options.proposedTakeProfit > 0) {
      if (proposedSide === 'BUY' && options.proposedTakeProfit <= entryPrice) {
        return {
          isApproved: false,
          ruleBlocked: 'INVALID_BUY_TAKE_PROFIT',
          rejectionMessage: 'For BUY orders, take-profit price must be strictly ABOVE the entry price.'
        };
      }
      if (proposedSide === 'SELL' && options.proposedTakeProfit >= entryPrice) {
        return {
          isApproved: false,
          ruleBlocked: 'INVALID_SELL_TAKE_PROFIT',
          rejectionMessage: 'For SELL orders, take-profit price must be strictly BELOW the entry price.'
        };
      }
    }

    // 14. Instrument-Aware Position Sizing using Exact Contract Specifications
    const spec = brokerGateway.getInstrumentSpec(quote.symbol);
    const contractSize = spec.contractSize;

    // Risk budget: strictly 0.20% of account equity
    const riskPercent = this.limits.maxRiskPerTradePercent; // 0.20%
    const riskBudgetUsd = Number(((account.equity * (riskPercent / 100))).toFixed(2));

    let lossPerLot = contractSize * priceDistance;
    if (spec.quoteCurrency === 'JPY' && account.currency === 'USD') {
      lossPerLot = (contractSize * priceDistance) / (entryPrice || 1);
    }
    lossPerLot = Number(lossPerLot.toFixed(4));
    if (lossPerLot <= 0 || isNaN(lossPerLot)) {
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
    if (worstCaseLossAtMinLot > riskBudgetUsd * 1.05) {
      return {
        isApproved: false,
        ruleBlocked: 'LOT_SIZE_EXCEEDS_MAX_RISK',
        rejectionMessage: `Minimum broker lot (${minVol}) would risk $${worstCaseLossAtMinLot.toFixed(2)}, which exceeds the approved 0.20% risk budget ($${riskBudgetUsd.toFixed(2)}). Trade rejected to protect capital.`
      };
    }

    const steps = Math.floor((rawLots + 1e-9) / spec.volumeStepLots);
    const calculatedLotSize = Number((Math.max(spec.minVolumeLots, steps * spec.volumeStepLots)).toFixed(2));

    const actualRiskAmount = Number((calculatedLotSize * lossPerLot).toFixed(2));
    if (actualRiskAmount > riskBudgetUsd * 1.05) {
      return {
        isApproved: false,
        ruleBlocked: 'RISK_BUDGET_EXCEEDED',
        rejectionMessage: `Calculated position risk ($${actualRiskAmount}) exceeds approved 0.20% limit ($${riskBudgetUsd}).`
      };
    }

    // 15. Anti-Martingale Check
    if (this.lastCompletedTrade && this.lastCompletedTrade.netPnl < 0) {
      if (options?.requestedLotSize && options.requestedLotSize > this.lastCompletedTrade.sizeLots * 1.01) {
        return {
          isApproved: false,
          ruleBlocked: 'MARTINGALE_SCALING_PROHIBITED',
          rejectionMessage: `Anti-martingale safeguard: Proposing larger lot size (${options.requestedLotSize}) after a losing trade (${this.lastCompletedTrade.sizeLots} lots) is prohibited.`
        };
      }
    }

    // 16. Maximum Effective Leverage Check (3x Cap)
    let currentOpenExposureUsd = 0;
    for (const pos of openPositions) {
      const posSpec = brokerGateway.getInstrumentSpec(pos.symbol);
      const posValUsd =
        posSpec.baseCurrency === 'USD'
          ? pos.sizeLots * posSpec.contractSize
          : pos.sizeLots * posSpec.contractSize * pos.currentPrice;
      currentOpenExposureUsd += posValUsd;
    }
    const newPositionValueUsd =
      spec.baseCurrency === 'USD'
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

    // 17. Margin Headroom Check
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
