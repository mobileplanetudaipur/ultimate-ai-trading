import {
  ClosedTradeRecord,
  MarketQuote,
  OrderRecord,
  PositionRecord
} from '../types/trading';
import { brokerGateway } from './brokerGateway';

export class OrderLifecycleManager {
  private orders: Map<string, OrderRecord> = new Map();
  private positions: Map<string, PositionRecord> = new Map();
  private closedTrades: ClosedTradeRecord[] = [];
  private idempotencyKeys: Set<string> = new Set();

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
   * Submits a paper order through local lifecycle simulation (Phase 4)
   */
  public submitOrder(params: {
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
    simulateSlippagePips?: number;
  }): { order: OrderRecord; position?: PositionRecord } {
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
      simulateSlippagePips = 0.2
    } = params;

    // Idempotency Check
    if (this.idempotencyKeys.has(idempotencyKey)) {
      throw new Error(`Duplicate submission detected. Idempotency key '${idempotencyKey}' already processed.`);
    }
    const spec = brokerGateway.getInstrumentSpec(symbol);
    if (!spec) {
      throw new Error(`Unsupported simulated instrument '${symbol}'. No contract assumptions are configured.`);
    }
    this.idempotencyKeys.add(idempotencyKey);

    const orderId = 'paper_ord_' + Math.random().toString(36).substring(2, 9);
    const now = Date.now();

    // 1. Lifecycle state: PREPARED
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

    // 2. Transition: RISK_APPROVED -> SUBMITTED_LOCAL
    order.status = 'SUBMITTED_LOCAL';
    order.updatedAt = Date.now();

    if (simulateBrokerFailure) {
      order.status = 'REJECTED';
      order.rejectionReason = 'Simulation rejection: Volatility spread expansion out of tolerance.';
      order.updatedAt = Date.now();
      return { order };
    }

    // 3. Execution simulation with instrument-aware slippage and realistic commission
    const slippageUnits = (simulateSlippagePips / quote.pipMultiplier);
    const executedPrice = side === 'BUY'
      ? Number((quote.ask + slippageUnits).toFixed(quote.digits))
      : Number((quote.bid - slippageUnits).toFixed(quote.digits));

    const commission = Number((sizeLots * 7.0).toFixed(2)); // Standard $7 / lot round-turn commission model

    order.filledSizeLots = sizeLots;
    order.executedPrice = executedPrice;
    order.slippagePips = simulateSlippagePips;
    order.commissionPaid = commission;
    order.status = 'SIMULATED_FILL';
    order.updatedAt = Date.now();

    // 4. Create Position Record (distinct from order, explicitly marked brokerConfirmed: false)
    const positionId = 'paper_pos_' + Math.random().toString(36).substring(2, 9);
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
      brokerConfirmed: false, // Truthful: local paper position
      openedAt: Date.now(),
      strategyId
    };

    this.positions.set(positionId, position);
    return { order, position };
  }

  /**
   * Updates positions marks, trailing stops, and evaluates TP/SL hits
   */
  public updatePositionsWithQuote(quote: MarketQuote): { closedTrades: ClosedTradeRecord[]; modifiedPositions: PositionRecord[] } {
    const closed: ClosedTradeRecord[] = [];
    const modified: PositionRecord[] = [];
    const spec = brokerGateway.getInstrumentSpec(quote.symbol);
    if (!spec) return { closedTrades: closed, modifiedPositions: modified };

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
    if (quote.symbol !== pos.symbol) return null;

    const spec = brokerGateway.getInstrumentSpec(pos.symbol);
    if (!spec) return null;
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
    this.idempotencyKeys.clear();
    for (const o of orders) this.orders.set(o.id, o);
    for (const o of orders) this.idempotencyKeys.add(o.idempotencyKey);

    this.closedTrades = [...closed];
  }
}

export const orderManager = new OrderLifecycleManager();
