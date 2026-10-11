import {
  BrokerOrderRecord,
  ClosedTradeRecord,
  DealExecutionRecord,
  MarketQuote,
  OrderIntentRecord,
  OrderRecord,
  PositionRecord
} from '../types/trading';
import { brokerGateway } from './brokerGateway';

export class OrderLifecycleManager {
  private intents: Map<string, OrderIntentRecord> = new Map();
  private brokerOrders: Map<string, BrokerOrderRecord> = new Map();
  private deals: Map<string, DealExecutionRecord> = new Map();
  private orders: Map<string, OrderRecord> = new Map();
  private positions: Map<string, PositionRecord> = new Map();
  private closedTrades: ClosedTradeRecord[] = [];
  private idempotencyKeys: Set<string> = new Set();
  private processedDealTickets: Set<string> = new Set();

  public getIntents(): OrderIntentRecord[] {
    return Array.from(this.intents.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getBrokerOrders(): BrokerOrderRecord[] {
    return Array.from(this.brokerOrders.values()).sort((a, b) => b.placedAt - a.placedAt);
  }

  public getDeals(): DealExecutionRecord[] {
    return Array.from(this.deals.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  public getOrders(): OrderRecord[] {
    return Array.from(this.orders.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getPositions(): PositionRecord[] {
    return Array.from(this.positions.values()).sort((a, b) => b.openedAt - a.openedAt);
  }

  public getClosedTrades(): ClosedTradeRecord[] {
    return [...this.closedTrades].sort((a, b) => b.closedAt - a.closedAt);
  }

  /**
   * Stage 4/5: Creates a formal OrderIntentRecord prior to submission.
   */
  public createOrderIntent(params: {
    clientOrderId: string;
    idempotencyKey: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    requestedVolumeLots: number;
    requestedPrice: number;
    stopLossPrice: number;
    takeProfitPrice: number;
    maxSlippagePips: number;
    strategyId: string;
  }): OrderIntentRecord {
    if (this.idempotencyKeys.has(params.idempotencyKey)) {
      throw new Error(`Duplicate submission detected. Idempotency key '${params.idempotencyKey}' already processed.`);
    }
    this.idempotencyKeys.add(params.idempotencyKey);

    const intentId = 'intent_' + Math.random().toString(36).substring(2, 9);
    const now = Date.now();

    const intent: OrderIntentRecord = {
      intentId,
      clientOrderId: params.clientOrderId,
      idempotencyKey: params.idempotencyKey,
      symbol: params.symbol,
      side: params.side,
      requestedVolumeLots: params.requestedVolumeLots,
      requestedPrice: params.requestedPrice,
      stopLossPrice: params.stopLossPrice,
      takeProfitPrice: params.takeProfitPrice,
      maxSlippagePips: params.maxSlippagePips,
      strategyId: params.strategyId,
      status: 'RISK_APPROVED',
      createdAt: now,
      updatedAt: now,
      blindRetryForbidden: true
    };

    this.intents.set(intentId, intent);
    return intent;
  }

  /**
   * Handles submission timeout / unknown outcome.
   * STRICT SAFETY: Flags blindRetryForbidden = true. Never blindly retry!
   */
  public handleSubmissionTimeout(intentId: string): OrderIntentRecord | null {
    const intent = this.intents.get(intentId);
    if (!intent) return null;

    intent.status = 'TIMEOUT_UNKNOWN';
    intent.blindRetryForbidden = true;
    intent.rejectionReason = 'Submission timed out or outcome unknown. Blind retry forbidden until broker reconciliation.';
    intent.updatedAt = Date.now();
    return intent;
  }

  /**
   * Verifies whether retry is permitted.
   * STRICT SAFETY RULE: Always false for unknown outcomes until broker reconciliation passes.
   */
  public canRetrySubmission(intentId: string): { allowed: boolean; reason: string } {
    const intent = this.intents.get(intentId);
    if (!intent) return { allowed: false, reason: 'Intent not found.' };

    if (intent.status === 'TIMEOUT_UNKNOWN' || intent.blindRetryForbidden) {
      return {
        allowed: false,
        reason: 'BLIND_RETRY_FORBIDDEN: Outcome is uncertain. Broker query and reconciliation required before retry.'
      };
    }

    return { allowed: true, reason: 'Retry permitted.' };
  }

  /**
   * Prevents duplicate broker deal messages from inflating fills or positions.
   */
  public handleDuplicateBrokerResponse(dealTicket: string): boolean {
    if (this.processedDealTickets.has(dealTicket)) {
      return true; // Already processed, duplicate dropped
    }
    this.processedDealTickets.add(dealTicket);
    return false; // New unique deal
  }

  /**
   * Handles Partial Fill on a Broker Order.
   */
  public handlePartialFill(params: {
    brokerTicket: string;
    fillVolumeLots: number;
    fillPrice: number;
    commission?: number;
    fee?: number;
  }): { brokerOrder: BrokerOrderRecord; deal: DealExecutionRecord; position: PositionRecord } {
    const { brokerTicket, fillVolumeLots, fillPrice, commission = 2.80, fee = 0 } = params;
    const brokerOrder = this.brokerOrders.get(brokerTicket);
    if (!brokerOrder) {
      throw new Error(`Broker order '${brokerTicket}' not found.`);
    }

    const remaining = Number(Math.max(0, brokerOrder.remainingVolumeLots - fillVolumeLots).toFixed(2));
    brokerOrder.filledVolumeLots = Number((brokerOrder.filledVolumeLots + fillVolumeLots).toFixed(2));
    brokerOrder.remainingVolumeLots = remaining;
    brokerOrder.status = remaining === 0 ? 'FILLED' : 'PARTIALLY_FILLED';
    brokerOrder.averageFillPrice = fillPrice;
    brokerOrder.updatedAt = Date.now();

    const dealTicket = 'deal_' + Math.random().toString(36).substring(2, 9);
    this.processedDealTickets.add(dealTicket);

    const positionId = 'pos_' + brokerOrder.symbol.replace('/', '').toLowerCase() + '_' + Math.random().toString(36).substring(2, 6);

    const deal: DealExecutionRecord = {
      dealTicket,
      brokerOrderTicket: brokerTicket,
      positionTicket: positionId,
      intentId: brokerOrder.intentId,
      symbol: brokerOrder.symbol,
      side: brokerOrder.side,
      dealType: remaining === 0 ? 'ENTRY_FILL' : 'PARTIAL_FILL',
      volumeLots: fillVolumeLots,
      executionPrice: fillPrice,
      commission,
      fee,
      swap: 0,
      slippagePips: 0.1,
      timestamp: Date.now(),
      isBrokerConfirmed: brokerOrder.isBrokerConfirmed,
      isExternalOrManual: false,
      comment: remaining === 0 ? 'Full Fill' : `Partial Fill (${fillVolumeLots} lots)`
    };
    this.deals.set(dealTicket, deal);

    // Create or update position for partial volume
    let position = this.positions.get(positionId);
    if (!position) {
      position = {
        id: positionId,
        symbol: brokerOrder.symbol,
        side: brokerOrder.side,
        sizeLots: fillVolumeLots,
        entryPrice: fillPrice,
        currentPrice: fillPrice,
        stopLossPrice: brokerOrder.stopLossPrice,
        takeProfitPrice: brokerOrder.takeProfitPrice,
        isTrailingStopActive: false,
        trailingStopDistancePips: 20,
        isBreakEvenLocked: false,
        unrealizedPnl: -commission,
        realizedPnl: 0,
        commission,
        swap: 0,
        brokerConfirmed: brokerOrder.isBrokerConfirmed,
        openedAt: Date.now(),
        strategyId: 'strategy_partial',
        remainingVolumeLots: fillVolumeLots
      };
      this.positions.set(positionId, position);
    } else {
      position.sizeLots = Number((position.sizeLots + fillVolumeLots).toFixed(2));
      position.remainingVolumeLots = position.sizeLots;
    }

    return { brokerOrder, deal, position };
  }

  /**
   * Handles Partial Close of an open Position.
   */
  public handlePartialClose(
    positionId: string,
    closeVolumeLots: number,
    quote: MarketQuote,
    reason: ClosedTradeRecord['exitReason'] = 'MANUAL_CLOSE'
  ): { position: PositionRecord; closedRecord: ClosedTradeRecord; deal: DealExecutionRecord } {
    const pos = this.positions.get(positionId);
    if (!pos) throw new Error(`Position '${positionId}' not found.`);

    if (closeVolumeLots >= pos.sizeLots) {
      throw new Error(`closeVolumeLots (${closeVolumeLots}) must be less than full position size (${pos.sizeLots}). Use closePosition for full close.`);
    }

    const spec = brokerGateway.getInstrumentSpec(pos.symbol);
    const currentPrice = pos.side === 'BUY' ? quote.bid : quote.ask;
    const priceDiff = pos.side === 'BUY' ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
    const grossPnl = priceDiff * spec.contractSize * closeVolumeLots;
    const proportionalCommission = Number(((pos.commission * closeVolumeLots) / pos.sizeLots).toFixed(2));
    const netPnl = Number((grossPnl - proportionalCommission).toFixed(2));

    const dealTicket = 'deal_close_' + Math.random().toString(36).substring(2, 9);
    this.processedDealTickets.add(dealTicket);

    const deal: DealExecutionRecord = {
      dealTicket,
      brokerOrderTicket: 'close_ord_' + positionId,
      positionTicket: positionId,
      symbol: pos.symbol,
      side: pos.side === 'BUY' ? 'SELL' : 'BUY',
      dealType: 'PARTIAL_CLOSE',
      volumeLots: closeVolumeLots,
      executionPrice: currentPrice,
      commission: proportionalCommission,
      fee: 0,
      swap: 0,
      slippagePips: 0.1,
      timestamp: Date.now(),
      isBrokerConfirmed: pos.brokerConfirmed,
      isExternalOrManual: false,
      comment: `Partial Close of ${closeVolumeLots} lots`
    };
    this.deals.set(dealTicket, deal);

    const closedRecord: ClosedTradeRecord = {
      id: 'trade_part_' + Math.random().toString(36).substring(2, 9),
      positionId: pos.id,
      symbol: pos.symbol,
      side: pos.side,
      sizeLots: closeVolumeLots,
      entryPrice: pos.entryPrice,
      exitPrice: currentPrice,
      slippagePips: 0.1,
      grossPnl: Number(grossPnl.toFixed(2)),
      commission: proportionalCommission,
      swap: 0,
      netPnl,
      openedAt: pos.openedAt,
      closedAt: Date.now(),
      exitReason: reason,
      strategyId: pos.strategyId
    };
    this.closedTrades.push(closedRecord);

    // Update remaining position volume
    pos.sizeLots = Number((pos.sizeLots - closeVolumeLots).toFixed(2));
    pos.remainingVolumeLots = pos.sizeLots;
    pos.commission = Number((pos.commission - proportionalCommission).toFixed(2));

    return { position: pos, closedRecord, deal };
  }

  /**
   * Handles Stop Loss Modification Failure reported by broker.
   */
  public handleStopModificationFailure(positionId: string, attemptedStop: number, reason: string): boolean {
    const pos = this.positions.get(positionId);
    if (!pos) return false;

    pos.stopLossFailed = true;
    pos.stopLossFailureReason = `Broker rejected SL update to ${attemptedStop}: ${reason}`;
    return true;
  }

  /**
   * Ingests external or manual trade detected on broker so that portfolio exposure is fully tracked.
   */
  public handleExternalTradeDetected(externalPos: PositionRecord) {
    externalPos.isExternalOrManual = true;
    this.positions.set(externalPos.id, externalPos);
  }

  /**
   * Submits order creating distinct OrderIntent, BrokerOrder, DealExecution, and Position records.
   */
  public async submitOrder(params: {
    clientOrderId: string;
    idempotencyKey: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    sizeLots: number;
    requestedPrice: number;
    stopLossPrice: number;
    takeProfitPrice: number;
    strategyId: string;
    quote: MarketQuote;
    simulateBrokerFailure?: boolean;
    simulateTimeout?: boolean;
    simulateSlippagePips?: number;
  }): Promise<{
    order: OrderRecord;
    position?: PositionRecord;
    intent?: OrderIntentRecord;
    brokerOrder?: BrokerOrderRecord;
    deal?: DealExecutionRecord;
  }> {
    const {
      clientOrderId,
      idempotencyKey,
      symbol,
      side,
      sizeLots,
      requestedPrice,
      stopLossPrice,
      takeProfitPrice,
      strategyId,
      quote,
      simulateBrokerFailure = false,
      simulateTimeout = false,
      simulateSlippagePips = 0.2
    } = params;

    // 1. Create distinct OrderIntent
    const intent = this.createOrderIntent({
      clientOrderId,
      idempotencyKey,
      symbol,
      side,
      requestedVolumeLots: sizeLots,
      requestedPrice,
      stopLossPrice,
      takeProfitPrice,
      maxSlippagePips: 1.5,
      strategyId
    });

    const orderId = 'ord_' + Math.random().toString(36).substring(2, 9);
    const brokerTicket = 'brk_tk_' + Math.random().toString(36).substring(2, 9);
    const now = Date.now();

    // 2. Legacy OrderRecord for existing UI compatibility
    const order: OrderRecord = {
      id: orderId,
      clientOrderId,
      idempotencyKey,
      symbol,
      side,
      orderType: 'MARKET',
      requestedSizeLots: sizeLots,
      filledSizeLots: 0,
      requestedPrice,
      stopLossPrice,
      takeProfitPrice,
      commissionPaid: 0,
      status: 'PREPARED',
      strategyId,
      createdAt: now,
      updatedAt: now,
      isSimulatedOrder: true
    };
    this.orders.set(orderId, order);

    // 3. BrokerOrderRecord
    const brokerOrder: BrokerOrderRecord = {
      brokerTicket,
      intentId: intent.intentId,
      clientOrderId,
      symbol,
      side,
      orderType: 'MARKET',
      requestedVolumeLots: sizeLots,
      filledVolumeLots: 0,
      remainingVolumeLots: sizeLots,
      requestedPrice,
      stopLossPrice,
      takeProfitPrice,
      status: 'PLACED',
      isBrokerConfirmed: false,
      placedAt: now,
      updatedAt: now
    };
    this.brokerOrders.set(brokerTicket, brokerOrder);

    // Timeout / Unknown Outcome Check
    if (simulateTimeout) {
      intent.status = 'TIMEOUT_UNKNOWN';
      intent.blindRetryForbidden = true;
      intent.rejectionReason = 'Submission timeout: outcome unknown. Blind retry forbidden.';
      brokerOrder.status = 'TIMEOUT_UNKNOWN';
      order.status = 'TIMEOUT_UNKNOWN';
      order.rejectionReason = intent.rejectionReason;
      return { order, intent, brokerOrder };
    }

    // Broker Failure / Rejection Check
    if (simulateBrokerFailure) {
      intent.status = 'REJECTED';
      intent.rejectionReason = 'Simulation rejection: Volatility spread expansion out of tolerance.';
      brokerOrder.status = 'REJECTED';
      brokerOrder.rejectionReason = intent.rejectionReason;
      order.status = 'REJECTED';
      order.rejectionReason = intent.rejectionReason;
      order.updatedAt = Date.now();
      return { order, intent, brokerOrder };
    }

    // 4. Execution / Deal Fill
    const slippageUnits = (simulateSlippagePips / quote.pipMultiplier);
    const executedPrice = side === 'BUY'
      ? Number((quote.ask + slippageUnits).toFixed(quote.digits))
      : Number((quote.bid - slippageUnits).toFixed(quote.digits));

    const commission = Number((sizeLots * 7.0).toFixed(2));

    order.filledSizeLots = sizeLots;
    order.executedPrice = executedPrice;
    order.slippagePips = simulateSlippagePips;
    order.commissionPaid = commission;
    order.status = 'SIMULATED_FILL';
    order.updatedAt = Date.now();

    brokerOrder.filledVolumeLots = sizeLots;
    brokerOrder.remainingVolumeLots = 0;
    brokerOrder.averageFillPrice = executedPrice;
    brokerOrder.status = 'FILLED';
    brokerOrder.updatedAt = Date.now();

    intent.status = 'COMPLETED';
    intent.updatedAt = Date.now();

    const positionId = 'paper_pos_' + Math.random().toString(36).substring(2, 9);
    const dealTicket = 'deal_' + Math.random().toString(36).substring(2, 9);
    this.processedDealTickets.add(dealTicket);

    const deal: DealExecutionRecord = {
      dealTicket,
      brokerOrderTicket: brokerTicket,
      positionTicket: positionId,
      intentId: intent.intentId,
      symbol,
      side,
      dealType: 'ENTRY_FILL',
      volumeLots: sizeLots,
      executionPrice: executedPrice,
      commission,
      fee: 0,
      swap: 0,
      slippagePips: simulateSlippagePips,
      timestamp: Date.now(),
      isBrokerConfirmed: false,
      isExternalOrManual: false,
      comment: 'Initial Entry Fill'
    };
    this.deals.set(dealTicket, deal);

    // 5. Position Record
    const position: PositionRecord = {
      id: positionId,
      symbol,
      side,
      sizeLots,
      entryPrice: executedPrice,
      currentPrice: executedPrice,
      stopLossPrice,
      takeProfitPrice,
      isTrailingStopActive: false,
      trailingStopDistancePips: 20,
      isBreakEvenLocked: false,
      unrealizedPnl: -commission,
      realizedPnl: 0,
      commission,
      swap: 0,
      brokerConfirmed: false,
      openedAt: Date.now(),
      strategyId,
      remainingVolumeLots: sizeLots
    };
    this.positions.set(positionId, position);

    return { order, position, intent, brokerOrder, deal };
  }

  /**
   * Updates positions marks, trailing stops, and evaluates TP/SL hits
   */
  public updatePositionsWithQuote(quote: MarketQuote): { closedTrades: ClosedTradeRecord[]; modifiedPositions: PositionRecord[] } {
    const closed: ClosedTradeRecord[] = [];
    const modified: PositionRecord[] = [];
    const spec = brokerGateway.getInstrumentSpec(quote.symbol);

    for (const [posId, pos] of this.positions.entries()) {
      if (pos.symbol !== quote.symbol) continue;

      const currentPrice = pos.side === 'BUY' ? quote.bid : quote.ask;
      pos.currentPrice = currentPrice;

      // PnL calculation using instrument contract size
      const priceDiff = pos.side === 'BUY' ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
      const pipGain = priceDiff * quote.pipMultiplier;
      const grossPnl = priceDiff * spec.contractSize * pos.sizeLots;
      pos.unrealizedPnl = Number((grossPnl - pos.commission - pos.swap).toFixed(2));

      // Dynamic Break-Even protection (Stage 10)
      if (!pos.isBreakEvenLocked && pipGain >= 20) {
        const breakEvenPrice = pos.side === 'BUY'
          ? Number((pos.entryPrice + 1.0 / quote.pipMultiplier).toFixed(quote.digits))
          : Number((pos.entryPrice - 1.0 / quote.pipMultiplier).toFixed(quote.digits));
        
        pos.stopLossPrice = breakEvenPrice;
        pos.isBreakEvenLocked = true;
        modified.push({ ...pos });
      }

      // Dynamic Trailing Stop protection
      if (pos.isTrailingStopActive) {
        const trailOffset = pos.trailingStopDistancePips / quote.pipMultiplier;
        if (pos.side === 'BUY') {
          const prospectiveStop = Number((currentPrice - trailOffset).toFixed(quote.digits));
          if (prospectiveStop > pos.stopLossPrice) {
            pos.stopLossPrice = prospectiveStop;
            modified.push({ ...pos });
          }
        } else {
          const prospectiveStop = Number((currentPrice + trailOffset).toFixed(quote.digits));
          if (prospectiveStop < pos.stopLossPrice) {
            pos.stopLossPrice = prospectiveStop;
            modified.push({ ...pos });
          }
        }
      }

      // Check Stop Loss and Take Profit
      let hitSL = false;
      let hitTP = false;

      if (pos.side === 'BUY') {
        if (currentPrice <= pos.stopLossPrice) hitSL = true;
        else if (pos.takeProfitPrice > 0 && currentPrice >= pos.takeProfitPrice) hitTP = true;
      } else {
        if (currentPrice >= pos.stopLossPrice) hitSL = true;
        else if (pos.takeProfitPrice > 0 && currentPrice <= pos.takeProfitPrice) hitTP = true;
      }

      if (hitSL || hitTP) {
        const exitReason = hitTP
          ? 'TAKE_PROFIT'
          : pos.isTrailingStopActive || pos.isBreakEvenLocked
          ? 'TRAILING_STOP'
          : 'STOP_LOSS';

        const closedRecord: ClosedTradeRecord = {
          id: 'trade_' + Math.random().toString(36).substring(2, 9),
          positionId: pos.id,
          symbol: pos.symbol,
          side: pos.side,
          sizeLots: pos.sizeLots,
          entryPrice: pos.entryPrice,
          exitPrice: currentPrice,
          slippagePips: 0.1,
          grossPnl: Number(grossPnl.toFixed(2)),
          commission: pos.commission,
          swap: pos.swap,
          netPnl: Number((grossPnl - pos.commission - pos.swap).toFixed(2)),
          openedAt: pos.openedAt,
          closedAt: Date.now(),
          exitReason,
          strategyId: pos.strategyId
        };

        this.positions.delete(posId);
        this.closedTrades.push(closedRecord);
        closed.push(closedRecord);
      }
    }

    return { closedTrades: closed, modifiedPositions: modified };
  }

  public closePosition(positionId: string, quote: MarketQuote, reason: ClosedTradeRecord['exitReason'] = 'MANUAL_CLOSE'): ClosedTradeRecord | null {
    const pos = this.positions.get(positionId);
    if (!pos) return null;

    const spec = brokerGateway.getInstrumentSpec(pos.symbol);
    const currentPrice = pos.side === 'BUY' ? quote.bid : quote.ask;
    const priceDiff = pos.side === 'BUY' ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
    const grossPnl = priceDiff * spec.contractSize * pos.sizeLots;
    const netPnl = Number((grossPnl - pos.commission - pos.swap).toFixed(2));

    const closedRecord: ClosedTradeRecord = {
      id: 'trade_' + Math.random().toString(36).substring(2, 9),
      positionId: pos.id,
      symbol: pos.symbol,
      side: pos.side,
      sizeLots: pos.sizeLots,
      entryPrice: pos.entryPrice,
      exitPrice: currentPrice,
      slippagePips: 0.1,
      grossPnl: Number(grossPnl.toFixed(2)),
      commission: pos.commission,
      swap: pos.swap,
      netPnl,
      openedAt: pos.openedAt,
      closedAt: Date.now(),
      exitReason: reason,
      strategyId: pos.strategyId
    };

    this.positions.delete(positionId);
    this.closedTrades.push(closedRecord);
    return closedRecord;
  }

  public toggleTrailingStop(positionId: string, distancePips: number = 15): boolean {
    const pos = this.positions.get(positionId);
    if (!pos) return false;

    pos.isTrailingStopActive = !pos.isTrailingStopActive;
    pos.trailingStopDistancePips = distancePips;
    return true;
  }

  public closeAllPositions(getQuoteFn: (symbol: string) => MarketQuote | undefined): ClosedTradeRecord[] {
    const closedList: ClosedTradeRecord[] = [];
    for (const [id, pos] of Array.from(this.positions.entries())) {
      const q = getQuoteFn(pos.symbol);
      if (q) {
        const closed = this.closePosition(id, q, 'KILL_SWITCH');
        if (closed) closedList.push(closed);
      }
    }
    return closedList;
  }

  public setInitialState(positions: PositionRecord[], orders: OrderRecord[], closed: ClosedTradeRecord[]) {
    this.positions.clear();
    for (const p of positions) this.positions.set(p.id, p);

    this.orders.clear();
    for (const o of orders) this.orders.set(o.id, o);

    this.closedTrades = [...closed];
  }
}

export const orderManager = new OrderLifecycleManager();
