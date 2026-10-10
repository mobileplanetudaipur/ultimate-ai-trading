// Domain types for Ultimate AI Trading Platform

export type OperatingMode = 'disconnected' | 'read_only' | 'simulated' | 'demo' | 'live';

export type FeedFreshness = 'broker-confirmed' | 'simulated' | 'delayed' | 'stale' | 'unavailable';

export interface MarketQuote {
  symbol: string;
  bid: number;
  ask: number;
  spreadPips: number;
  last: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  change24hPercent: number;
  digits: number;
  pipMultiplier: number;
  provider: string;
  timestamp: number;
  freshness: FeedFreshness;
  latencyMs: number;
  isStale: boolean;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketRegime {
  trendDirection: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  trendStrengthAdx: number; // 0-100
  volatilityAtr: number;
  volatilityRegime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
  sessionName: 'SYDNEY' | 'TOKYO' | 'LONDON' | 'NEW_YORK' | 'WEEKEND_CLOSED';
  isPreCloseExclusion: boolean;
  spreadCondition: 'NORMAL' | 'ELEVATED' | 'BLOWOUT';
  scheduledEventRisk: 'NONE' | 'LOW' | 'HIGH_IMPACT_APPROACHING';
  nextEventMinutesAway?: number;
}

export interface StrategyDefinition {
  id: string;
  name: string;
  category: 'Trend Following' | 'Mean Reversion' | 'Volatility Breakout' | 'Liquidity Sweep';
  targetSymbol: string;
  timeframe: 'M5' | 'M15' | 'H1' | 'H4';
  description: string;
  invalidationRules: string;
  holdingTimeExpected: string;
  historicalSampleSize: number;
  outOfSampleSharpe: number;
  winRate: number;
  profitFactor: number;
  maxHistoricalDrawdown: number;
}

export interface StrategyEvaluation {
  strategyId: string;
  strategyName: string;
  symbol: string;
  suitabilityScore: number; // 0 - 100
  suitabilityThreshold: number; // min required
  marketRegimeFit: string;
  signal: 'BUY' | 'SELL' | 'NO_TRADE';
  signalConfidence: number; // 0 - 100%
  noTradeReason?: string;
  entryPriceEstimate?: number;
  proposedStopLoss?: number;
  proposedTakeProfit?: number;
  riskRewardRatio?: number;
  evaluatedAt: number;
}

export type OrderStatus =
  | 'PREPARED'
  | 'RISK_APPROVED'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'OUTCOME_UNKNOWN';

export interface OrderRecord {
  id: string;
  clientOrderId: string;
  idempotencyKey: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  requestedSize: number; // lots
  filledSize: number;
  requestedPrice: number;
  executedPrice?: number;
  slippagePips?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  commissionPaid: number;
  status: OrderStatus;
  rejectionReason?: string;
  strategyId: string;
  createdAt: number;
  updatedAt: number;
  brokerConfirmationToken?: string;
}

export interface PositionRecord {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  sizeLots: number;
  entryPrice: number;
  currentPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  isTrailingStopActive: boolean;
  trailingStopDistancePips: number;
  isBreakEvenLocked: boolean;
  unrealizedPnl: number;
  realizedPnl: number;
  commission: number;
  swap: number;
  brokerConfirmed: boolean;
  openedAt: number;
  strategyId: string;
}

export interface ClosedTradeRecord {
  id: string;
  positionId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  sizeLots: number;
  entryPrice: number;
  exitPrice: number;
  slippagePips: number;
  grossPnl: number;
  commission: number;
  swap: number;
  netPnl: number;
  openedAt: number;
  closedAt: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'MANUAL_CLOSE' | 'KILL_SWITCH' | 'TIME_EXPIRY';
  strategyId: string;
}

export interface AccountState {
  currency: string;
  balance: number;
  equity: number;
  marginUsed: number;
  freeMargin: number;
  marginLevelPercent: number;
  leverage: number;
  brokerConfirmed: boolean;
  lastReconciledAt: number;
  reconciliationStatus: 'IN_SYNC' | 'DISCREPANCY_DETECTED' | 'RECONCILING';
  discrepancies: string[];
}

export interface RiskLimits {
  maxRiskPerTradePercent: number; // Default 1.0%
  maxTotalExposurePercent: number; // Default 5.0%
  dailyLossLimitPercent: number; // Default 3.0%
  maxDrawdownPercent: number; // Default 6.0%
  maxOpenPositions: number; // Default 3
  consecutiveLossLockoutThreshold: number; // Default 5 losses -> 30m lock
  cooldownPeriodMinutes: number; // 30m
  enforceWeekendClosure: boolean;
  enforceNewsBlackout: boolean;
}

export interface RiskStatus {
  isTradingPaused: boolean;
  pauseReason?: string;
  consecutiveLossCount: number;
  isCooldownActive: boolean;
  cooldownEndsAt?: number;
  dailyStartingEquity: number;
  todayRealizedPnl: number;
  todayDrawdownPercent: number;
  dailyLossLimitBreached: boolean;
  overallMaxDrawdownBreached: boolean;
  killSwitchTriggered: boolean;
  killSwitchTriggeredAt?: number;
}

export interface EconomicEvent {
  id: string;
  title: string;
  currency: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  scheduledTime: number; // timestamp
  forecast?: string;
  previous?: string;
  actual?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  category: 'SYSTEM' | 'STRATEGY' | 'RISK' | 'ORDER' | 'RECONCILIATION' | 'KILL_SWITCH';
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';
  message: string;
  details?: Record<string, any>;
  actor: 'AUTOMATED_AGENT' | 'OPERATOR' | 'RISK_ENGINE' | 'BROKER_GATEWAY';
}

export interface ExecutionMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePercent: number;
  profitFactor: number;
  netPnl: number;
  avgSlippagePips: number;
  orderFillRatePercent: number;
  rejectedOrdersCount: number;
  sharpeRatioEstimate: number;
  sampleConfidenceReliable: boolean; // false if trades < 30
}
