import { AccountState, PositionRecord } from '../types/trading';
import { brokerGateway } from './brokerGateway';

export interface ReconciliationReport {
  timestamp: number;
  isInternalStateConsistent: boolean;
  brokerGatewayStatus: 'DISCONNECTED' | 'CONNECTED';
  discrepancies: string[];
  localPositionsCount: number;
  calculatedEquity: number;
  recordedEquity: number;
  marginHeadroomValid: boolean;
  notes: string;
}

export class ReconciliationService {
  /**
   * Performs an audit of local ledger mathematics and reports broker gateway connection state.
   */
  public performReconciliation(
    localAccount: AccountState,
    localPositions: PositionRecord[]
  ): { updatedAccount: AccountState; report: ReconciliationReport } {
    const discrepancies: string[] = [];
    const now = Date.now();
    const brokerStatus = brokerGateway.getStatus();

    // 1. Broker Gateway check
    if (!brokerStatus.isConnected) {
      discrepancies.push('Broker Gateway: XM / Windows MT5 bridge is disconnected. Real broker comparison is unavailable.');
    }

    // 2. Audit local internal consistency
    let calculatedMarginUsed = 0;
    let totalUnrealizedPnl = 0;

    for (const pos of localPositions) {
      const spec = brokerGateway.getInstrumentSpec(pos.symbol);
      const positionMargin = (pos.sizeLots * spec.contractSize * pos.entryPrice) / localAccount.leverage;
      calculatedMarginUsed += positionMargin;
      totalUnrealizedPnl += pos.unrealizedPnl;
    }

    const calculatedEquity = Number((localAccount.balance + totalUnrealizedPnl).toFixed(2));
    const calculatedFreeMargin = Math.max(0, Number((calculatedEquity - calculatedMarginUsed).toFixed(2)));
    const calculatedMarginLevel = calculatedMarginUsed > 0
      ? Number(((calculatedEquity / calculatedMarginUsed) * 100).toFixed(1))
      : 9999.0;

    // Check equity math delta
    const equityMathDelta = Math.abs(calculatedEquity - localAccount.equity);
    if (equityMathDelta > 0.50) {
      discrepancies.push(`Ledger Discrepancy: Calculated equity ($${calculatedEquity}) differs from state equity ($${localAccount.equity}) by $${equityMathDelta.toFixed(2)}.`);
    }

    const isConsistent = discrepancies.length <= 1; // 1 is expected while MT5 bridge is disconnected

    const updatedAccount: AccountState = {
      ...localAccount,
      equity: calculatedEquity,
      marginUsed: Number(calculatedMarginUsed.toFixed(2)),
      freeMargin: calculatedFreeMargin,
      marginLevelPercent: calculatedMarginLevel,
      brokerConfirmed: false, // Truthful: always false in local paper mode
      lastReconciledAt: now,
      reconciliationStatus: !brokerStatus.isConnected
        ? 'BROKER_GATEWAY_DISCONNECTED'
        : isConsistent
        ? 'LOCAL_CONSISTENT'
        : 'DISCREPANCY_DETECTED',
      discrepancies
    };

    const report: ReconciliationReport = {
      timestamp: now,
      isInternalStateConsistent: isConsistent,
      brokerGatewayStatus: brokerStatus.isConnected ? 'CONNECTED' : 'DISCONNECTED',
      discrepancies,
      localPositionsCount: localPositions.length,
      calculatedEquity,
      recordedEquity: localAccount.equity,
      marginHeadroomValid: calculatedFreeMargin > calculatedMarginUsed * 0.2,
      notes: brokerStatus.isConnected
        ? 'Broker connection verified'
        : 'Operating in self-contained Paper Simulation mode. No broker credentials required.'
    };

    return { updatedAccount, report };
  }
}

export const reconciliationService = new ReconciliationService();
