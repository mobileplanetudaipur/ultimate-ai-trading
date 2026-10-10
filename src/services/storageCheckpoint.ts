import {
  AccountState,
  AuditLogEntry,
  ClosedTradeRecord,
  OperatingMode,
  OrderRecord,
  PositionRecord,
  RiskLimits
} from '../types/trading';

export interface DurableCheckpoint {
  checkpointId: string;
  timestamp: number;
  operatingMode: OperatingMode;
  account: AccountState;
  positions: PositionRecord[];
  orders: OrderRecord[];
  closedTrades: ClosedTradeRecord[];
  riskLimits: RiskLimits;
  auditLogs: AuditLogEntry[];
  storageType: 'BROWSER_LOCAL_STORAGE';
  verifiedStatusNote: string;
}

const STORAGE_KEY = 'ultimate_ai_trading_checkpoint_v2';

export class StorageCheckpointService {
  /**
   * Saves snapshot of local session state to browser LocalStorage.
   */
  public saveCheckpoint(data: {
    operatingMode: OperatingMode;
    account: AccountState;
    positions: PositionRecord[];
    orders: OrderRecord[];
    closedTrades: ClosedTradeRecord[];
    riskLimits: RiskLimits;
    auditLogs: AuditLogEntry[];
  }): DurableCheckpoint {
    const checkpoint: DurableCheckpoint = {
      checkpointId: 'chk_local_' + Date.now().toString(36),
      timestamp: Date.now(),
      operatingMode: data.operatingMode,
      account: data.account,
      positions: data.positions,
      orders: data.orders,
      closedTrades: data.closedTrades,
      riskLimits: data.riskLimits,
      auditLogs: data.auditLogs.slice(-100),
      storageType: 'BROWSER_LOCAL_STORAGE',
      verifiedStatusNote: 'Local browser storage snapshot. Broker-confirmed state requires active MT5 desktop bridge.'
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checkpoint));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }

    return checkpoint;
  }

  public loadCheckpoint(): DurableCheckpoint | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as DurableCheckpoint;
    } catch (e) {
      console.warn('Failed to parse checkpoint:', e);
      return null;
    }
  }

  public clearCheckpoint() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear checkpoint:', e);
    }
  }
}

export const checkpointService = new StorageCheckpointService();
