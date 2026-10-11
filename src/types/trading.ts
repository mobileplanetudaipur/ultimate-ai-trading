// Domain types for Ultimate AI Trading Platform (Truthful & Demo/Simulation Only)

export type OperatingMode = 'simulated' | 'read_only' | 'demo' | 'demo_pending' | 'disconnected' | 'live';

export type FeedFreshness = 'simulated' | 'stale' | 'unavailable';

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
  provider: string; // Truthful label e.g. "Local In-Memory Simulation"
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

export interface InstrumentSpecification {
  symbol: string;
  displayName: string;
  assetClass: 'FOREX' | 'COMMODITY' | 'CRYPTO';
  baseCurrency: string;
  quoteCurrency: string;
  contractSize: number; // e.g. 100,000 for FX, 100 for XAU/USD, 1 for BTC/USD
  tickSize: number;
  tickValue: number;
  digits: number;
  pipMultiplier: number;
  minVolumeLots: number;
  maxVolumeLots: number;
  volumeStepLots: number;
  typicalSpreadPips: number;
  marginCurrency: string;
  tradingHours: string;
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
  category: 'Trend Following' | 'Multi-Timeframe' | 'Breakout' | 'Liquidity Sweep' | 'Mean Reversion';
  targetSymbol: string;
  timeframes: string[];
  description: string;
  invalidationRules: string;
  holdingTimeExpected: string;
  researchStatus: 'HYPOTHESIS_PENDING_OUT_OF_SAMPLE' | 'WALK_FORWARD_VALIDATION' | 'RESEARCH_ONLY';
  baselineEvidenceNote: string;
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
  | 'SUBMITTED_LOCAL'
  | 'SIMULATED_FILL'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'TIMEOUT_UNKNOWN';

// Stage 4 & 5: Distinct separated models for Order Intent, Broker Order, Deal/Fill, and Position

export type OrderIntentStatus =
  | 'DRAFT'
  | 'RISK_APPROVED'
  | 'SUBMITTED'
  | 'TIMEOUT_UNKNOWN'
  | 'REJECTED'
  | 'COMPLETED';

export interface OrderIntentRecord {
  intentId: string;
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
  status: OrderIntentStatus;
  createdAt: number;
  updatedAt: number;
  rejectionReason?: string;
  blindRetryForbidden: boolean; // Strict safety: never blind retry an uncertain submission
  riskApprovalTicket?: string;
}

export type BrokerOrderStatus =
  | 'PLACED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'TIMEOUT_UNKNOWN';

export interface BrokerOrderRecord {
  brokerTicket: string;
  intentId: string;
  clientOrderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  requestedVolumeLots: number;
  filledVolumeLots: number;
  remainingVolumeLots: number;
  requestedPrice: number;
  averageFillPrice?: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  status: BrokerOrderStatus;
  isBrokerConfirmed: boolean;
  placedAt: number;
  updatedAt: number;
  rejectionReason?: string;
}

export type DealExecutionType =
  | 'ENTRY_FILL'
  | 'PARTIAL_FILL'
  | 'EXIT_CLOSE'
  | 'PARTIAL_CLOSE'
  | 'STOP_LOSS_CLOSE'
  | 'TAKE_PROFIT_CLOSE';

export interface DealExecutionRecord {
  dealTicket: string;
  brokerOrderTicket: string;
  positionTicket: string;
  intentId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  dealType: DealExecutionType;
  volumeLots: number;
  executionPrice: number;
  commission: number;
  fee: number;
  swap: number;
  slippagePips: number;
  timestamp: number;
  isBrokerConfirmed: boolean;
  isExternalOrManual: boolean;
  comment?: string;
}

export interface OrderRecord {
  id: string;
  clientOrderId: string;
  idempotencyKey: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  requestedSizeLots: number;
  filledSizeLots: number;
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
  isSimulatedOrder: boolean;
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
  brokerConfirmed: boolean; // Strictly false in simulation, true only with verified broker
  openedAt: number;
  strategyId: string;
  isExternalOrManual?: boolean; // Flagged if detected externally on broker
  stopLossFailed?: boolean; // Flagged if broker rejects stop modification
  stopLossFailureReason?: string;
  remainingVolumeLots?: number;
}

// Durable Shadow Observation with Genuine Provenance Tracking
export interface ShadowObservationRecord {
  observationId: string;
  timestamp: number;
  symbol: string;
  sourceProvider: string;
  isGenuineBrokerFeed: boolean;
  provenanceDigest: string;
  bid: number;
  ask: number;
  spreadPips: number;
  latencyMs: number;
  marketRegime: string;
  shadowSignal: 'BUY' | 'SELL' | 'NO_TRADE';
  shadowSignalConfidence: number;
  noTradeReason?: string;
}

export interface ShadowValidationMetrics {
  totalObservations: number;
  genuineObservationsCount: number;
  simulatedObservationsCount: number;
  minSampleRequired: number; // 100 genuine observations required before claiming evidence
  isProvenanceVerified: boolean;
  provenanceStatus: 'GENUINE_FEED_VERIFIED' | 'INSUFFICIENT_GENUINE_OBSERVATIONS' | 'SIMULATED_DATA_EXCLUDED';
  signalDistribution: {
    buyCount: number;
    sellCount: number;
    noTradeCount: number;
  };
  averageSpreadPips: number;
  maxSpreadPips: number;
  dataQualityRatingPercent: number;
  firstObservationTimestamp?: number;
  lastObservationTimestamp?: number;
}

// Phase 9 Readiness Gating
export interface Phase9GateResult {
  gateId: string;
  name: string;
  category: 'BROKER_ADAPTER' | 'RISK_GATE' | 'STATE_SEPARATION' | 'RECONCILIATION' | 'SHADOW_VALIDATION' | 'SECURITY_RECOVERY' | 'LOCAL_CONFIG';
  status: 'VERIFIED' | 'IMPLEMENTED_UNVERIFIED' | 'SIMULATED' | 'BLOCKED' | 'PENDING_USER_SETUP';
  evidence: string;
  isPassed: boolean;
  blockerDescription?: string;
}

export interface Phase9ReadinessReport {
  overallReadiness: 'BLOCKED_PENDING_BROKER_AND_SETUP' | 'READY_FOR_LOCAL_DEMO';
  generatedAt: number;
  gates: Phase9GateResult[];
  passedTestsCount: number;
  totalTestsCount: number;
  requiredUserActions: string[];
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
  brokerConfirmed: boolean; // false in local simulation, true when confirmed by broker
  isRealBrokerAccount?: boolean; // true if connected broker account is REAL (not demo)
  brokerServerName?: string;
  lastReconciledAt: number;
  reconciliationStatus: 'LOCAL_CONSISTENT' | 'DISCREPANCY_DETECTED' | 'BROKER_GATEWAY_DISCONNECTED';
  discrepancies: string[];
}

export interface RiskLimits {
  maxRiskPerTradePercent: number; // Baseline: 0.20% of reference equity
  dailyLossLimitPercent: number; // Baseline: 1.00% of daily reference equity
  maxOverallDrawdownPercent: number; // Baseline: 5.00% of account equity
  maxOpenPositions: number; // Baseline: 3 maximum simultaneous positions
  maxDailyTrades: number; // Baseline: 8 trades per day maximum
  consecutiveLossLockoutThreshold: number; // Baseline: 5 consecutive net losses
  cooldownPeriodMinutes: number; // Baseline: 30 minutes lockout
  maxEffectiveLeverage: number; // Baseline: 3x maximum effective portfolio leverage
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
  todayTradesCount: number;
  todayDrawdownPercent: number;
  dailyLossLimitBreached: boolean;
  dailyTradeCapBreached: boolean;
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
  isSyntheticTestScenario: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  category: 'SYSTEM' | 'STRATEGY' | 'RISK' | 'ORDER' | 'RECONCILIATION' | 'KILL_SWITCH';
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';
  message: string;
  details?: Record<string, any>;
  actor: 'LOCAL_SIMULATOR' | 'OPERATOR' | 'RISK_ENGINE' | 'STRATEGY_ENGINE';
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
