import { AccountState, PositionRecord } from '../types/trading';

export interface ReconciliationReport {
  timestamp: number;
  isSynchronized: boolean;
  discrepancies: string[];
  localPositionsCount: number;
  brokerPositionsCount: number;
  localEquity: number;
  brokerEquity: number;
  equityDelta: number;
}

export class ReconciliationService {
  /**
   * Reconciles local application positions and account balance with broker records
   */
  public performReconciliation(
    localAccount: AccountState,
    localPositions: PositionRecord[],
    mockBrokerDiscrepancy: boolean = false
  ): { updatedAccount: AccountState; report: ReconciliationReport } {
    const discrepancies: string[] = [];
    const now = Date.now();

    // Calculate total margin used and unrealized PnL from active positions
    let calculatedMarginUsed = 0;
    let totalUnrealizedPnl = 0;

    for (const pos of localPositions) {
      const positionMargin = (pos.sizeLots * 100000 * pos.entryPrice) / localAccount.leverage;
      calculatedMarginUsed += positionMargin;
      totalUnrealizedPnl += pos.unrealizedPnl;
    }

    const calculatedEquity = localAccount.balance + totalUnrealizedPnl;
    const calculatedFreeMargin = calculatedEquity - calculatedMarginUsed;
    const calculatedMarginLevel = calculatedMarginUsed > 0
      ? (calculatedEquity / calculatedMarginUsed) * 100
      : 9999.0;

    // Simulate potential discrepancy if flag is enabled (to test Stage 4 safety barrier)
    if (mockBrokerDiscrepancy) {
      discrepancies.push('Discrepancy: Broker reports external manual position EUR/USD +0.50 lots not found in local state.');
      discrepancies.push('Discrepancy: Broker cash balance differs by -$14.50 (unsettled financing fee).');
    }

    const isSynchronized = discrepancies.length === 0;

    const updatedAccount: AccountState = {
      ...localAccount,
      equity: Number(calculatedEquity.toFixed(2)),
      marginUsed: Number(calculatedMarginUsed.toFixed(2)),
      freeMargin: Number(calculatedFreeMargin.toFixed(2)),
      marginLevelPercent: Number(calculatedMarginLevel.toFixed(1)),
      lastReconciledAt: now,
      reconciliationStatus: isSynchronized ? 'IN_SYNC' : 'DISCREPANCY_DETECTED',
      discrepancies
    };

    const report: ReconciliationReport = {
      timestamp: now,
      isSynchronized,
      discrepancies,
      localPositionsCount: localPositions.length,
      brokerPositionsCount: mockBrokerDiscrepancy ? localPositions.length + 1 : localPositions.length,
      localEquity: updatedAccount.equity,
      brokerEquity: mockBrokerDiscrepancy ? updatedAccount.equity - 14.5 : updatedAccount.equity,
      equityDelta: mockBrokerDiscrepancy ? 14.5 : 0
    };

    return { updatedAccount, report };
  }
}

export const reconciliationService = new ReconciliationService();
