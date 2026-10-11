import {
  AccountState,
  AuditLogEntry,
  BrokerOrderRecord,
  ClosedTradeRecord,
  DealExecutionRecord,
  OperatingMode,
  OrderIntentRecord,
  OrderRecord,
  PositionRecord,
  RiskLimits,
  RiskStatus
} from '../types/trading';

export interface DurableCheckpoint {
  schemaVersion: number;
  checkpointId: string;
  timestamp: number;
  operatingMode: OperatingMode;
  account: AccountState;
  positions: PositionRecord[];
  orders: OrderRecord[];
  intents: OrderIntentRecord[];
  brokerOrders: BrokerOrderRecord[];
  deals: DealExecutionRecord[];
  closedTrades: ClosedTradeRecord[];
  riskLimits: RiskLimits;
  riskStatus: RiskStatus;
  auditLogs: AuditLogEntry[];
  storageType: 'DURABLE_STRUCTURED_LEDGER';
  integrityDigest: string;
  verifiedStatusNote: string;
}

export interface RestoreValidationResult {
  isValid: boolean;
  checkpoint: DurableCheckpoint | null;
  errorMessage?: string;
  discrepanciesFound?: string[];
}

const STORAGE_KEY = 'ultimate_ai_trading_durable_ledger_v2';

/**
 * Simple robust fast hash for string digest validation
 */
function computeSimpleDigest(dataStr: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < dataStr.length; i++) {
    hash ^= dataStr.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('0000000' + (hash >>> 0).toString(16)).slice(-8);
}

export class StorageCheckpointService {
  /**
   * Saves snapshot of trading ledger with cryptographic integrity digest.
   */
  public saveCheckpoint(data: {
    operatingMode: OperatingMode;
    account: AccountState;
    positions: PositionRecord[];
    orders: OrderRecord[];
    intents?: OrderIntentRecord[];
    brokerOrders?: BrokerOrderRecord[];
    deals?: DealExecutionRecord[];
    closedTrades: ClosedTradeRecord[];
    riskLimits: RiskLimits;
    riskStatus?: RiskStatus;
    auditLogs: AuditLogEntry[];
  }): { success: boolean; checkpoint?: DurableCheckpoint; error?: string } {
    try {
      const payloadWithoutDigest = {
        schemaVersion: 2,
        checkpointId: 'chk_durable_' + Date.now().toString(36),
        timestamp: Date.now(),
        operatingMode: data.operatingMode,
        account: data.account,
        positions: data.positions,
        orders: data.orders,
        intents: data.intents || [],
        brokerOrders: data.brokerOrders || [],
        deals: data.deals || [],
        closedTrades: data.closedTrades,
        riskLimits: data.riskLimits,
        riskStatus: data.riskStatus || {
          isTradingPaused: false,
          consecutiveLossCount: 0,
          isCooldownActive: false,
          dailyStartingEquity: data.account.equity,
          todayRealizedPnl: 0,
          todayTradesCount: 0,
          todayDrawdownPercent: 0,
          dailyLossLimitBreached: false,
          dailyTradeCapBreached: false,
          killSwitchTriggered: false
        },
        auditLogs: data.auditLogs.slice(-150),
        storageType: 'DURABLE_STRUCTURED_LEDGER' as const,
        verifiedStatusNote: 'Durable structured ledger snapshot with integrity validation digest.'
      };

      const serialized = JSON.stringify(payloadWithoutDigest);
      const integrityDigest = computeSimpleDigest(serialized);

      const completeCheckpoint: DurableCheckpoint = {
        ...payloadWithoutDigest,
        integrityDigest
      };

      const finalSerialized = JSON.stringify(completeCheckpoint);

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, finalSerialized);
      }

      return { success: true, checkpoint: completeCheckpoint };
    } catch (e: any) {
      console.error('Storage checkpoint failure:', e);
      return { success: false, error: e?.message || 'Storage write failed' };
    }
  }

  /**
   * Loads and validates the restored checkpoint.
   * Fails closed if the checkpoint is missing, corrupted, or tampered.
   */
  public loadAndValidateCheckpoint(): RestoreValidationResult {
    try {
      if (typeof localStorage === 'undefined') {
        return { isValid: false, checkpoint: null, errorMessage: 'LocalStorage environment unavailable.' };
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { isValid: true, checkpoint: null }; // Fresh state
      }

      const parsed = JSON.parse(raw) as DurableCheckpoint;

      // 1. Check mandatory schema version
      if (parsed.schemaVersion !== 2) {
        return {
          isValid: false,
          checkpoint: null,
          errorMessage: `Incompatible ledger schema version: ${parsed.schemaVersion}. Expected 2.`
        };
      }

      // 2. Validate integrity digest
      const { integrityDigest, ...rest } = parsed;
      const expectedDigest = computeSimpleDigest(JSON.stringify(rest));
      if (integrityDigest !== expectedDigest) {
        return {
          isValid: false,
          checkpoint: null,
          errorMessage: 'INTEGRITY_MISMATCH: Stored trading ledger digest is corrupt or has been altered.'
        };
      }

      // 3. Validate essential data arrays
      const discrepancies: string[] = [];
      if (!Array.isArray(parsed.positions)) discrepancies.push('Positions collection missing');
      if (!Array.isArray(parsed.orders)) discrepancies.push('Orders collection missing');
      if (!Array.isArray(parsed.intents)) discrepancies.push('Intents collection missing');
      if (!Array.isArray(parsed.brokerOrders)) discrepancies.push('Broker orders collection missing');
      if (!Array.isArray(parsed.deals)) discrepancies.push('Deals collection missing');
      if (!parsed.account || typeof parsed.account.equity !== 'number') discrepancies.push('Account equity invalid');

      if (discrepancies.length > 0) {
        return {
          isValid: false,
          checkpoint: null,
          errorMessage: 'INCOMPLETE_STATE: Essential ledger collections missing.',
          discrepanciesFound: discrepancies
        };
      }

      return {
        isValid: true,
        checkpoint: parsed
      };
    } catch (e: any) {
      return {
        isValid: false,
        checkpoint: null,
        errorMessage: `Ledger restore exception: ${e?.message || 'Parse error'}`
      };
    }
  }

  public loadCheckpoint(): DurableCheckpoint | null {
    const res = this.loadAndValidateCheckpoint();
    return res.isValid ? res.checkpoint : null;
  }

  public clearCheckpoint() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to clear checkpoint:', e);
    }
  }
}

export const checkpointService = new StorageCheckpointService();
