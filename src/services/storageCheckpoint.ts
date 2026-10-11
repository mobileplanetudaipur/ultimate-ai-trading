import {
  AccountState,
  AuditLogEntry,
  ClosedTradeRecord,
  OperatingMode,
  OrderRecord,
  PositionRecord,
  RiskLimits,
  RiskStatus
} from '../types/trading';

export interface DurableCheckpoint {
  schemaVersion: 4;
  checkpointId: string;
  timestamp: number;
  operatingMode: OperatingMode;
  account: AccountState;
  positions: PositionRecord[];
  orders: OrderRecord[];
  closedTrades: ClosedTradeRecord[];
  riskLimits: RiskLimits;
  riskStatus: RiskStatus;
  auditLogs: AuditLogEntry[];
  storageType: 'BROWSER_LOCAL_STORAGE';
  verifiedStatusNote: string;
}

interface CheckpointStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = 'ultimate_ai_trading_checkpoint_v2';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isArrayOf = <T>(value: unknown, guard: (item: unknown) => item is T): value is T[] =>
  Array.isArray(value) && value.every(guard);

const isRiskStatus = (value: unknown): value is RiskStatus => {
  if (!isRecord(value)) return false;

  const booleanKeys: (keyof RiskStatus)[] = [
    'isTradingPaused',
    'isCooldownActive',
    'dailyLossLimitBreached',
    'dailyTradeCapBreached',
    'killSwitchTriggered'
  ];
  const numberKeys: (keyof RiskStatus)[] = [
    'consecutiveLossCount',
    'dailyStartingEquity',
    'todayRealizedPnl',
    'todayTradesCount',
    'todayDrawdownPercent'
  ];

  return booleanKeys.every(key => typeof value[key] === 'boolean')
    && numberKeys.every(key => isFiniteNumber(value[key]))
    && isFiniteNumber(value.consecutiveLossCount)
    && Number.isInteger(value.consecutiveLossCount)
    && value.consecutiveLossCount >= 0
    && isFiniteNumber(value.todayTradesCount)
    && Number.isInteger(value.todayTradesCount)
    && value.todayTradesCount >= 0
    && isFiniteNumber(value.dailyStartingEquity)
    && value.dailyStartingEquity > 0
    && (value.sessionStartingEquity === undefined
      || (isFiniteNumber(value.sessionStartingEquity) && value.sessionStartingEquity > 0))
    && isFiniteNumber(value.todayDrawdownPercent)
    && value.todayDrawdownPercent >= 0
    && (value.pauseReason === undefined || typeof value.pauseReason === 'string')
    && (value.dailyPeriodKey === undefined || typeof value.dailyPeriodKey === 'string')
    && (value.cooldownEndsAt === undefined || isFiniteNumber(value.cooldownEndsAt))
    && (!value.isCooldownActive || isFiniteNumber(value.cooldownEndsAt))
    && (value.killSwitchTriggeredAt === undefined || isFiniteNumber(value.killSwitchTriggeredAt));
};

const isAccountState = (value: unknown): value is AccountState =>
  isRecord(value)
  && typeof value.currency === 'string'
  && ['balance', 'equity', 'marginUsed', 'freeMargin', 'marginLevelPercent', 'leverage', 'lastReconciledAt']
    .every(key => isFiniteNumber(value[key]))
  && value.brokerConfirmed === false
  && ['LOCAL_CONSISTENT', 'DISCREPANCY_DETECTED', 'BROKER_GATEWAY_DISCONNECTED'].includes(String(value.reconciliationStatus))
  && Array.isArray(value.discrepancies)
  && value.discrepancies.every(item => typeof item === 'string');

const isRiskLimits = (value: unknown): value is RiskLimits => {
  if (!isRecord(value)) return false;

  const numericKeys: (keyof RiskLimits)[] = [
    'maxRiskPerTradePercent',
    'dailyLossLimitPercent',
    'maxOverallDrawdownPercent',
    'maxOpenPositions',
    'maxDailyTrades',
    'consecutiveLossLockoutThreshold',
    'cooldownPeriodMinutes',
    'maxEffectiveLeverage'
  ];
  return numericKeys.every(key => isFiniteNumber(value[key]))
    && typeof value.enforceWeekendClosure === 'boolean'
    && typeof value.enforceNewsBlackout === 'boolean';
};

const isPositionRecord = (value: unknown): value is PositionRecord =>
  isRecord(value)
  && ['id', 'symbol', 'strategyId'].every(key => typeof value[key] === 'string')
  && ['sizeLots', 'entryPrice', 'currentPrice', 'stopLossPrice', 'takeProfitPrice', 'trailingStopDistancePips', 'unrealizedPnl', 'realizedPnl', 'commission', 'swap', 'openedAt']
    .every(key => isFiniteNumber(value[key]))
  && ['BUY', 'SELL'].includes(String(value.side))
  && typeof value.isTrailingStopActive === 'boolean'
  && typeof value.isBreakEvenLocked === 'boolean'
  && value.brokerConfirmed === false;

const isOrderRecord = (value: unknown): value is OrderRecord =>
  isRecord(value)
  && ['id', 'clientOrderId', 'idempotencyKey', 'symbol', 'strategyId'].every(key => typeof value[key] === 'string')
  && ['requestedSizeLots', 'filledSizeLots', 'requestedPrice', 'commissionPaid', 'createdAt', 'updatedAt']
    .every(key => isFiniteNumber(value[key]))
  && ['BUY', 'SELL'].includes(String(value.side))
  && ['MARKET', 'LIMIT', 'STOP'].includes(String(value.orderType))
  && ['PREPARED', 'RISK_APPROVED', 'SUBMITTED_LOCAL', 'SIMULATED_FILL', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(String(value.status))
  && ['executedPrice', 'slippagePips', 'stopLossPrice', 'takeProfitPrice']
    .every(key => value[key] === undefined || isFiniteNumber(value[key]))
  && (value.rejectionReason === undefined || typeof value.rejectionReason === 'string')
  && typeof value.isSimulatedOrder === 'boolean';

const isClosedTradeRecord = (value: unknown): value is ClosedTradeRecord =>
  isRecord(value)
  && ['id', 'positionId', 'symbol', 'strategyId'].every(key => typeof value[key] === 'string')
  && ['sizeLots', 'entryPrice', 'exitPrice', 'slippagePips', 'grossPnl', 'commission', 'swap', 'netPnl', 'openedAt', 'closedAt']
    .every(key => isFiniteNumber(value[key]))
  && ['BUY', 'SELL'].includes(String(value.side))
  && ['TAKE_PROFIT', 'STOP_LOSS', 'TRAILING_STOP', 'MANUAL_CLOSE', 'KILL_SWITCH', 'TIME_EXPIRY'].includes(String(value.exitReason));

const isAuditLogEntry = (value: unknown): value is AuditLogEntry =>
  isRecord(value)
  && typeof value.id === 'string'
  && isFiniteNumber(value.timestamp)
  && ['SYSTEM', 'STRATEGY', 'RISK', 'ORDER', 'RECONCILIATION', 'KILL_SWITCH'].includes(String(value.category))
  && ['INFO', 'WARN', 'ERROR', 'SECURITY'].includes(String(value.level))
  && typeof value.message === 'string'
  && (value.details === undefined || isRecord(value.details))
  && ['LOCAL_SIMULATOR', 'OPERATOR', 'RISK_ENGINE', 'STRATEGY_ENGINE'].includes(String(value.actor));

type CheckpointBase = {
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
  schemaVersion?: unknown;
  riskStatus?: unknown;
} & Record<string, unknown>;

const isCheckpointBase = (value: unknown): value is CheckpointBase =>
  isRecord(value)
  && typeof value.checkpointId === 'string'
  && isFiniteNumber(value.timestamp)
  && ['simulated', 'read_only', 'demo_pending', 'disconnected'].includes(String(value.operatingMode))
  && isAccountState(value.account)
  && isArrayOf(value.positions, isPositionRecord)
  && isArrayOf(value.orders, isOrderRecord)
  && isArrayOf(value.closedTrades, isClosedTradeRecord)
  && isRiskLimits(value.riskLimits)
  && isArrayOf(value.auditLogs, isAuditLogEntry)
  && value.storageType === 'BROWSER_LOCAL_STORAGE'
  && typeof value.verifiedStatusNote === 'string';

const createLegacyRiskStatus = (equity: number): RiskStatus => ({
  isTradingPaused: true,
  pauseReason: 'Legacy checkpoint did not save risk state; review before resuming.',
  consecutiveLossCount: 0,
  isCooldownActive: false,
  dailyStartingEquity: Math.max(1, equity),
  sessionStartingEquity: Math.max(1, equity),
  dailyPeriodKey: new Date().toISOString().slice(0, 10),
  todayRealizedPnl: 0,
  todayTradesCount: 0,
  todayDrawdownPercent: 0,
  dailyLossLimitBreached: false,
  dailyTradeCapBreached: false,
  killSwitchTriggered: true,
  killSwitchTriggeredAt: Date.now()
});

export class StorageCheckpointService {
  constructor(private readonly storage?: CheckpointStorage) {}

  private getStorage(): CheckpointStorage {
    if (this.storage) return this.storage;
    if (typeof window === 'undefined') {
      throw new Error('Browser local storage is unavailable in this environment.');
    }

    try {
      return window.localStorage;
    } catch (error) {
      throw new Error('Browser local storage is unavailable.', { cause: error });
    }
  }

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
    riskStatus: RiskStatus;
    auditLogs: AuditLogEntry[];
  }): DurableCheckpoint {
    const checkpoint: DurableCheckpoint = {
      schemaVersion: 4,
      checkpointId: 'chk_local_' + Date.now().toString(36),
      timestamp: Date.now(),
      operatingMode: data.operatingMode,
      account: data.account,
      positions: data.positions,
      orders: data.orders,
      closedTrades: data.closedTrades,
      riskLimits: data.riskLimits,
      riskStatus: data.riskStatus,
      auditLogs: data.auditLogs.slice(-100),
      storageType: 'BROWSER_LOCAL_STORAGE',
      verifiedStatusNote: 'Local browser storage snapshot. Paper risk state is saved; no broker state is confirmed.'
    };

    this.getStorage().setItem(STORAGE_KEY, JSON.stringify(checkpoint));

    return checkpoint;
  }

  public loadCheckpoint(): DurableCheckpoint | null {
    const raw = this.getStorage().getItem(STORAGE_KEY);
    if (raw === null) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error('Saved checkpoint is not valid JSON.', { cause: error });
    }

    if (!isCheckpointBase(parsed)) {
      throw new Error('Saved checkpoint is incomplete or has an unsupported format.');
    }

    const riskStatus = parsed.riskStatus;
    if ((parsed.schemaVersion === 3 || parsed.schemaVersion === 4) && isRiskStatus(riskStatus)) {
      const migratedRiskStatus = {
        ...riskStatus,
        dailyPeriodKey: riskStatus.dailyPeriodKey || new Date(parsed.timestamp).toISOString().slice(0, 10),
        sessionStartingEquity: riskStatus.sessionStartingEquity ?? riskStatus.dailyStartingEquity
      };
      return {
        ...parsed,
        schemaVersion: 4,
        riskStatus: migratedRiskStatus
      };
    }

    if (parsed.schemaVersion === undefined && parsed.riskStatus === undefined) {
      const legacyAccount = parsed.account;
      if (!isAccountState(legacyAccount)) {
        throw new Error('Legacy checkpoint has invalid account state.');
      }

      return {
        ...parsed,
        schemaVersion: 4,
        riskStatus: createLegacyRiskStatus(legacyAccount.equity),
        verifiedStatusNote: 'Legacy local checkpoint restored with entries locked because prior risk state was not saved.'
      };
    }

    throw new Error('Saved checkpoint has invalid risk state or an unsupported version.');
  }

  public clearCheckpoint() {
    this.getStorage().removeItem(STORAGE_KEY);
  }
}

export const checkpointService = new StorageCheckpointService();
