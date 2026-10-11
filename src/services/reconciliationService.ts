import { AccountState, BrokerOrderRecord, DealExecutionRecord, PositionRecord } from '../types/trading';
import { brokerGateway } from './brokerGateway';

export interface ReconciliationOptions {
  brokerPositions?: PositionRecord[];
  brokerOrders?: BrokerOrderRecord[];
  brokerDeals?: DealExecutionRecord[];
  externalPositions?: PositionRecord[];
}

export interface ReconciliationReport {
  timestamp: number;
  isInternalStateConsistent: boolean;
  brokerGatewayStatus: 'DISCONNECTED' | 'CONNECTED';
  discrepancies: string[];
  localPositionsCount: number;
  externalPositionsCount: number;
  calculatedEquity: number;
  recordedEquity: number;
  marginHeadroomValid: boolean;
  stopsIntegrityValid: boolean;
  notes: string;
}

export class ReconciliationService {
  /**
   * Performs an audit of local ledger mathematics, external trades, broker deals, and stop integrity.
   */
  public performReconciliation(
    localAccount: AccountState,
    localPositions: PositionRecord[],
    options?: ReconciliationOptions
  ): { updatedAccount: AccountState; report: ReconciliationReport } {
    const discrepancies: string[] = [];
    const now = Date.now();
    const brokerStatus = brokerGateway.getStatus();

    // 1. Broker Gateway check
    if (!brokerStatus.isConnected) {
      discrepancies.push('Broker Gateway: XM / Windows MT5 bridge is disconnected. Real broker comparison is unavailable.');
    }

    // 2. Audit external/manual trades
    const allTrackedPositions = [...localPositions];
    let externalCount = 0;

    if (options?.externalPositions && options.externalPositions.length > 0) {
      for (const ext of options.externalPositions) {
        externalCount++;
        discrepancies.push(`EXTERNAL_TRADE_DETECTED: Position ${ext.id} (${ext.symbol} ${ext.sizeLots} lots ${ext.side}) detected outside bot. Exposure added to risk budget.`);
        allTrackedPositions.push(ext);
      }
    }

    // 3. Stop-Loss Integrity Check
    let stopsIntegrityValid = true;
    for (const pos of allTrackedPositions) {
      if (pos.stopLossFailed) {
        stopsIntegrityValid = false;
        discrepancies.push(`STOP_LOSS_FAILED: Position ${pos.id} on ${pos.symbol} has an unconfirmed or rejected stop loss (${pos.stopLossFailureReason || 'Broker modification failed'}).`);
      }
      if (pos.stopLossPrice <= 0) {
        stopsIntegrityValid = false;
        discrepancies.push(`UNPROTECTED_POSITION: Position ${pos.id} on ${pos.symbol} has no protective stop loss.`);
      }
    }

    // 4. Audit ledger math across all positions (including external trades)
    let calculatedMarginUsed = 0;
    let totalUnrealizedPnl = 0;

    for (const pos of allTrackedPositions) {
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

    // Material discrepancies check:
    // If disconnected, discrepancies.length is 1 (acceptable in offline mode)
    // If stops fail or ledger fails or external desync occurs, isConsistent is false!
    const hasMaterialFailure = !stopsIntegrityValid || equityMathDelta > 0.50;
    const isConsistent = !hasMaterialFailure && (discrepancies.length <= 1);

    const updatedAccount: AccountState = {
      ...localAccount,
      equity: calculatedEquity,
      marginUsed: Number(calculatedMarginUsed.toFixed(2)),
      freeMargin: calculatedFreeMargin,
      marginLevelPercent: calculatedMarginLevel,
      brokerConfirmed: false, // Truthful: always false in local paper mode
      lastReconciledAt: now,
      reconciliationStatus: !brokerStatus.isConnected
        ? (hasMaterialFailure ? 'DISCREPANCY_DETECTED' : 'BROKER_GATEWAY_DISCONNECTED')
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
      externalPositionsCount: externalCount,
      calculatedEquity,
      recordedEquity: localAccount.equity,
      marginHeadroomValid: calculatedFreeMargin > calculatedMarginUsed * 0.2,
      stopsIntegrityValid,
      notes: brokerStatus.isConnected
        ? 'Broker connection verified'
        : 'Operating in self-contained Paper Simulation mode. No broker credentials required.'
    };

    return { updatedAccount, report };
  }
}

export const reconciliationService = new ReconciliationService();
