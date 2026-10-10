import React, { useState, useEffect, useCallback } from 'react';
import {
  AccountState,
  AuditLogEntry,
  ClosedTradeRecord,
  EconomicEvent,
  FeedFreshness,
  MarketQuote,
  MarketRegime,
  OperatingMode,
  OrderRecord,
  PositionRecord,
  RiskLimits,
  RiskStatus,
  StrategyEvaluation
} from './types/trading';
import { marketDataService } from './services/marketDataService';
import { strategyEngine } from './services/strategyEngine';
import { riskEngine } from './services/riskEngine';
import { orderManager } from './services/orderLifecycleManager';
import { economicCalendarService } from './services/economicCalendarService';
import { calculateExecutionMetrics } from './services/metricsCalculator';
import { checkpointService, DurableCheckpoint } from './services/storageCheckpoint';

import { Header } from './components/Header';
import { MarketOverview } from './components/MarketOverview';
import { MarketChart } from './components/MarketChart';
import { StrategySelectorPanel } from './components/StrategySelectorPanel';
import { RiskControllerPanel } from './components/RiskControllerPanel';
import { PositionsOrdersTable } from './components/PositionsOrdersTable';
import { ModeSelectorModal } from './components/ModeSelectorModal';
import { ReconciliationModal } from './components/ReconciliationModal';
import { ExecutionQualityModal } from './components/ExecutionQualityModal';
import { EconomicCalendarModal } from './components/EconomicCalendarModal';
import { AuditLogDrawer } from './components/AuditLogDrawer';
import { KillSwitchModal } from './components/KillSwitchModal';
import { CheckpointModal } from './components/CheckpointModal';
import { AlertCircle, CheckCircle, Info, ShieldAlert } from 'lucide-react';

export const App: React.FC = () => {
  // 1. Operating State
  const [operatingMode, setOperatingMode] = useState<OperatingMode>('simulated');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('EUR/USD');
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [isFeedDegraded, setIsFeedDegraded] = useState<boolean>(false);

  // 2. Account & Portfolio State
  const [account, setAccount] = useState<AccountState>({
    currency: 'USD',
    balance: 10000.0,
    equity: 10000.0,
    marginUsed: 0.0,
    freeMargin: 10000.0,
    marginLevelPercent: 9999.0,
    leverage: 100,
    brokerConfirmed: true,
    lastReconciledAt: Date.now(),
    reconciliationStatus: 'IN_SYNC',
    discrepancies: []
  });

  // 3. Risk State
  const [riskLimits, setRiskLimits] = useState<RiskLimits>(riskEngine.getLimits());
  const [riskStatus, setRiskStatus] = useState<RiskStatus>(riskEngine.getStatus());

  // 4. Orders, Positions, and History
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTradeRecord[]>([]);

  // 5. Macro Events & Audit Trail
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>(
    economicCalendarService.getUpcomingEvents()
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [savedCheckpoint, setSavedCheckpoint] = useState<DurableCheckpoint | null>(null);

  // 6. UI Modals
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [isReconModalOpen, setIsReconModalOpen] = useState(false);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [isKillSwitchModalOpen, setIsKillSwitchModalOpen] = useState(false);
  const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);

  // Helper to log audit event
  const logAudit = useCallback((
    category: AuditLogEntry['category'],
    level: AuditLogEntry['level'],
    message: string,
    details?: any,
    actor: AuditLogEntry['actor'] = 'AUTOMATED_AGENT'
  ) => {
    const entry: AuditLogEntry = {
      id: 'log_' + Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      category,
      level,
      message,
      details,
      actor
    };
    setAuditLogs(prev => [...prev.slice(-150), entry]);
  }, []);

  // Show auto-expiring notification banner
  const showNotice = (text: string, type: 'error' | 'success' | 'info' = 'info') => {
    setBannerNotice({ text, type });
    setTimeout(() => {
      setBannerNotice(prev => (prev?.text === text ? null : prev));
    }, 6000);
  };

  // Initialize service ticks & load checkpoint on mount
  useEffect(() => {
    marketDataService.startTickStream();
    setQuotes(marketDataService.getAllQuotes());

    // Load any existing durable checkpoint
    const chk = checkpointService.loadCheckpoint();
    if (chk) {
      setSavedCheckpoint(chk);
      logAudit('SYSTEM', 'INFO', `Durable checkpoint ${chk.checkpointId} discovered in persistent storage.`, {
        milestone: chk.milestonePhase
      });
    } else {
      logAudit('SYSTEM', 'INFO', 'System initialized in Simulated / Paper mode. All deterministic safety gates active.', {
        equity: 10000,
        mode: 'simulated'
      });
    }

    // Subscribe to market ticks
    const unsubscribe = marketDataService.subscribe(updatedQuote => {
      setQuotes(marketDataService.getAllQuotes());

      // Update positions with incoming price tick
      const { closedTrades: newlyClosed, modifiedPositions } = orderManager.updatePositionsWithQuote(updatedQuote);

      if (newlyClosed.length > 0) {
        for (const t of newlyClosed) {
          riskEngine.recordCompletedTrade(t.netPnl);
          logAudit(
            'ORDER',
            t.netPnl >= 0 ? 'INFO' : 'WARN',
            `Position ${t.positionId} closed via ${t.exitReason}. Realized P&L: $${t.netPnl.toFixed(2)}`,
            { trade: t }
          );
        }
        setClosedTrades([...orderManager.getClosedTrades()]);
        setRiskStatus(riskEngine.getStatus());
      }

      setPositions([...orderManager.getPositions()]);
    });

    return () => {
      unsubscribe();
      marketDataService.stopTickStream();
    };
  }, [logAudit]);

  // Recalculate equity and margins whenever positions update
  useEffect(() => {
    let marginUsed = 0;
    let totalUnrealized = 0;

    for (const pos of positions) {
      marginUsed += (pos.sizeLots * 100000 * pos.entryPrice) / account.leverage;
      totalUnrealized += pos.unrealizedPnl;
    }

    const calculatedEquity = account.balance + totalUnrealized;
    const calculatedFree = Math.max(0, calculatedEquity - marginUsed);
    const calculatedMarginLevel = marginUsed > 0 ? (calculatedEquity / marginUsed) * 100 : 9999;

    setAccount(prev => ({
      ...prev,
      equity: Number(calculatedEquity.toFixed(2)),
      marginUsed: Number(marginUsed.toFixed(2)),
      freeMargin: Number(calculatedFree.toFixed(2)),
      marginLevelPercent: Number(calculatedMarginLevel.toFixed(1))
    }));
  }, [positions, account.balance, account.leverage]);

  // Current quote and candles for selected symbol
  const activeQuote = quotes.find(q => q.symbol === selectedSymbol) || quotes[0] || {
    symbol: 'EUR/USD',
    bid: 1.0850,
    ask: 1.0851,
    spreadPips: 1.1,
    last: 1.08505,
    high24h: 1.0880,
    low24h: 1.0820,
    volume24h: 4200,
    change24hPercent: 0.12,
    digits: 5,
    pipMultiplier: 10000,
    provider: 'LMAX / FastMatch Gateway',
    timestamp: Date.now(),
    freshness: 'simulated',
    latencyMs: 18,
    isStale: false
  };

  const activeCandles = marketDataService.getCandles(activeQuote.symbol);

  // Evaluate Market Regime and Strategies
  const marketRegime = strategyEngine.evaluateMarketRegime(
    activeQuote,
    activeCandles,
    economicEvents
  );

  const strategyEvaluations = strategyEngine.evaluateStrategies(
    activeQuote,
    activeCandles,
    marketRegime
  );

  // Execute Signal proposal via Risk Engine
  const handleExecuteSignal = async (evaluation: StrategyEvaluation) => {
    if (evaluation.signal === 'NO_TRADE') {
      showNotice(`Cannot execute: Strategy returned NO TRADE: ${evaluation.noTradeReason}`, 'error');
      return;
    }

    const proposedSide = evaluation.signal;
    const proposedStop = evaluation.proposedStopLoss || (proposedSide === 'BUY' ? activeQuote.bid - 0.0030 : activeQuote.ask + 0.0030);
    const proposedTp = evaluation.proposedTakeProfit || (proposedSide === 'BUY' ? activeQuote.ask + 0.0050 : activeQuote.bid - 0.0050);
    const entryEstimate = proposedSide === 'BUY' ? activeQuote.ask : activeQuote.bid;

    // 1. Stage 8 Deterministic Risk Gate Check
    const validation = riskEngine.validateOrderProposal(
      activeQuote,
      account,
      positions,
      orders,
      proposedSide,
      proposedStop,
      entryEstimate,
      1.0
    );

    if (!validation.isApproved) {
      logAudit('RISK', 'WARN', `Stage 8 Deterministic Risk Block: Order rejected [${validation.ruleBlocked}]`, {
        reason: validation.rejectionMessage,
        strategy: evaluation.strategyName
      }, 'RISK_ENGINE');
      showNotice(`Order Blocked by Risk Gate: ${validation.rejectionMessage}`, 'error');
      return;
    }

    // 2. Stage 5 Multistage Order Submission
    const clientOrderId = 'cli_' + Math.random().toString(36).substring(2, 8);
    const idempotencyKey = 'idem_' + Date.now().toString(36) + '_' + evaluation.strategyId;

    try {
      const { order, position } = await orderManager.submitOrder({
        clientOrderId,
        idempotencyKey,
        symbol: activeQuote.symbol,
        side: proposedSide,
        sizeLots: validation.calculatedLotSize || 0.1,
        requestedPrice: entryEstimate,
        stopLossPrice: proposedStop,
        takeProfitPrice: proposedTp,
        strategyId: evaluation.strategyId,
        quote: activeQuote,
        simulateBrokerFailure: false,
        simulateSlippagePips: 0.2
      });

      setOrders([...orderManager.getOrders()]);
      setPositions([...orderManager.getPositions()]);

      logAudit('ORDER', 'INFO', `Order ${order.id} FILLED for ${order.requestedSize} lots ${order.side} ${order.symbol} @ ${order.executedPrice}`, {
        orderId: order.id,
        idempotencyKey,
        stopLoss: proposedStop,
        takeProfit: proposedTp,
        riskAllocated: validation.calculatedRiskAmount
      });

      showNotice(`Order ${order.id} executed successfully. Position opened at ${order.executedPrice}.`, 'success');
    } catch (err: any) {
      logAudit('ORDER', 'ERROR', `Order submission failed: ${err.message}`, { clientOrderId });
      showNotice(`Order submission error: ${err.message}`, 'error');
    }
  };

  // Close single position manually
  const handleClosePosition = (positionId: string) => {
    const closed = orderManager.closePosition(positionId, activeQuote, 'MANUAL_CLOSE');
    if (closed) {
      riskEngine.recordCompletedTrade(closed.netPnl);
      setClosedTrades([...orderManager.getClosedTrades()]);
      setPositions([...orderManager.getPositions()]);
      setRiskStatus(riskEngine.getStatus());
      logAudit('ORDER', 'INFO', `Position ${positionId} manually closed by operator. Realized P&L: $${closed.netPnl.toFixed(2)}`, { trade: closed }, 'OPERATOR');
      showNotice(`Position ${positionId} closed. Realized: $${closed.netPnl.toFixed(2)}`, 'info');
    }
  };

  // Toggle Trailing Stop
  const handleToggleTrailingStop = (positionId: string) => {
    const ok = orderManager.toggleTrailingStop(positionId, 20);
    if (ok) {
      setPositions([...orderManager.getPositions()]);
      logAudit('ORDER', 'INFO', `Stage 10 Stop Policy updated for position ${positionId}: Trailing Stop toggled.`, undefined, 'OPERATOR');
    }
  };

  // Emergency Kill Switch
  const handleConfirmKillSwitch = (closePositionsImmediately: boolean) => {
    riskEngine.triggerKillSwitch();
    setRiskStatus(riskEngine.getStatus());

    let closedCount = 0;
    if (closePositionsImmediately) {
      const closedList = orderManager.closeAllPositions(sym => quotes.find(q => q.symbol === sym));
      for (const t of closedList) {
        riskEngine.recordCompletedTrade(t.netPnl);
      }
      closedCount = closedList.length;
      setPositions([...orderManager.getPositions()]);
      setClosedTrades([...orderManager.getClosedTrades()]);
    }

    logAudit('KILL_SWITCH', 'SECURITY', `Emergency Kill Switch Triggered. All automated entries halted. ${closedCount} positions closed at market.`, {
      closedPositionsCount: closedCount
    }, 'OPERATOR');

    showNotice(`EMERGENCY KILL SWITCH ACTIVATED. System locked. ${closedCount} position(s) closed.`, 'error');
  };

  // Reset Kill Switch
  const handleResetKillSwitch = () => {
    riskEngine.resetKillSwitch();
    setRiskStatus(riskEngine.getStatus());
    logAudit('KILL_SWITCH', 'INFO', 'Emergency Kill Switch reset by authorized operator. Automated trading allowed.', undefined, 'OPERATOR');
    showNotice('Emergency Kill Switch has been reset. Automated trading eligible.', 'success');
  };

  // Toggle Pause
  const handleTogglePause = () => {
    const nextPaused = !riskStatus.isTradingPaused;
    riskEngine.setTradingPaused(nextPaused, nextPaused ? 'Paused by Operator' : undefined);
    setRiskStatus(riskEngine.getStatus());
    logAudit('SYSTEM', 'INFO', nextPaused ? 'Automated entries paused by operator.' : 'Automated entries resumed.', undefined, 'OPERATOR');
  };

  // Simulate loss to test Stage 9 Consecutive Loss Rule
  const handleSimulateLoss = () => {
    riskEngine.recordCompletedTrade(-65.0);
    setRiskStatus(riskEngine.getStatus());
    logAudit('RISK', 'WARN', 'Test simulated loss recorded (-$65.00) to verify Stage 9 behavioral lockout threshold.', undefined, 'OPERATOR');
  };

  const handleResetCooldown = () => {
    riskEngine.recordCompletedTrade(10.0); // Reset consecutive counter
    setRiskStatus(riskEngine.getStatus());
    logAudit('RISK', 'INFO', 'Consecutive loss lockout reset by operator override.', undefined, 'OPERATOR');
  };

  // Toggle feed degradation
  const handleToggleDataDegradation = () => {
    const nextDegraded = !isFeedDegraded;
    setIsFeedDegraded(nextDegraded);
    marketDataService.setDegradedState(nextDegraded);
    logAudit('SYSTEM', nextDegraded ? 'WARN' : 'INFO', nextDegraded ? 'Data feed degradation SIMULATED (stale quotes, spread blowout).' : 'Data feed restored to normal telemetry.', undefined, 'OPERATOR');
  };

  // Save durable checkpoint
  const handleSaveCurrentCheckpoint = () => {
    const chk = checkpointService.saveCheckpoint({
      operatingMode,
      account,
      positions,
      orders,
      closedTrades,
      riskLimits,
      auditLogs
    });
    setSavedCheckpoint(chk);
    logAudit('SYSTEM', 'INFO', `Durable checkpoint saved: ${chk.checkpointId}`, { timestamp: chk.timestamp }, 'OPERATOR');
    showNotice(`Durable checkpoint ${chk.checkpointId} saved to persistent storage.`, 'success');
  };

  // Restore checkpoint
  const handleRestoreCheckpoint = () => {
    if (!savedCheckpoint) return;
    setOperatingMode(savedCheckpoint.operatingMode);
    setAccount(savedCheckpoint.account);
    orderManager.setInitialState(savedCheckpoint.positions, savedCheckpoint.orders, savedCheckpoint.closedTrades);
    setPositions([...orderManager.getPositions()]);
    setOrders([...orderManager.getOrders()]);
    setClosedTrades([...orderManager.getClosedTrades()]);
    setIsCheckpointModalOpen(false);
    logAudit('SYSTEM', 'INFO', `Durable checkpoint ${savedCheckpoint.checkpointId} restored successfully.`, undefined, 'OPERATOR');
    showNotice('System restored from durable checkpoint.', 'success');
  };

  const executionMetrics = calculateExecutionMetrics(closedTrades, orders);

  // Total exposure percent calculation
  const totalExposurePercent = positions.reduce((sum, p) => sum + 1.0, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        operatingMode={operatingMode}
        account={account}
        riskStatus={riskStatus}
        feedFreshness={activeQuote.freshness}
        feedLatencyMs={activeQuote.latencyMs}
        onOpenModeSelector={() => setIsModeModalOpen(true)}
        onOpenReconciliation={() => setIsReconModalOpen(true)}
        onOpenMetrics={() => setIsMetricsModalOpen(true)}
        onOpenCalendar={() => setIsCalendarModalOpen(true)}
        onOpenAuditLogs={() => setIsAuditDrawerOpen(true)}
        onTriggerKillSwitch={() => setIsKillSwitchModalOpen(true)}
        onTogglePause={handleTogglePause}
        onSaveCheckpoint={() => setIsCheckpointModalOpen(true)}
      />

      {/* Floating Notification Toast */}
      {bannerNotice && (
        <div className={`fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-lg shadow-2xl border text-xs font-medium flex items-start gap-2.5 backdrop-blur-md transition-all ${
          bannerNotice.type === 'error'
            ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
            : bannerNotice.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
            : 'bg-slate-900/90 border-slate-700 text-slate-200'
        }`}>
          {bannerNotice.type === 'error' ? (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          ) : bannerNotice.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 leading-snug">{bannerNotice.text}</div>
        </div>
      )}

      {/* Main Trading Cockpit */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Market Overview Ticker & Environmental Regime */}
        <MarketOverview
          quotes={quotes}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={setSelectedSymbol}
          regime={marketRegime}
          feedFreshness={activeQuote.freshness}
          onToggleDataDegradation={handleToggleDataDegradation}
          isDegraded={isFeedDegraded}
        />

        {/* Live Candlestick & Indicator Chart */}
        <MarketChart
          symbol={selectedSymbol}
          quote={activeQuote}
          candles={activeCandles}
          positions={positions}
        />

        {/* Strategy Selector with Transparent Abstention ("NO TRADE") */}
        <StrategySelectorPanel
          evaluations={strategyEvaluations}
          onExecuteSignal={handleExecuteSignal}
          isTradingPaused={riskStatus.isTradingPaused}
          isCooldownActive={riskStatus.isCooldownActive}
          killSwitchActive={riskStatus.killSwitchTriggered}
        />

        {/* Deterministic Portfolio Risk Engine & Behavioral Safeguards */}
        <RiskControllerPanel
          limits={riskLimits}
          status={riskStatus}
          openPositionsCount={positions.length}
          totalExposurePercent={totalExposurePercent}
          onSimulateLoss={handleSimulateLoss}
          onResetCooldown={handleResetCooldown}
        />

        {/* Positions, Order Lifecycle Tracker & Realized History */}
        <PositionsOrdersTable
          positions={positions}
          orders={orders}
          closedTrades={closedTrades}
          onClosePosition={handleClosePosition}
          onToggleTrailingStop={handleToggleTrailingStop}
        />
      </main>

      {/* Footer & Disclaimer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-600">
        <p className="max-w-4xl mx-auto leading-relaxed">
          <strong>Ultimate AI Trading — Evidence-Based Trading Architecture</strong>.
          No bot or algorithm can guarantee profitability or zero losses. The system is designed to say <span className="text-amber-500 font-semibold font-mono">NO TRADE</span> whenever market regime evidence, spread thresholds, news blackouts, or risk criteria are unmet.
        </p>
      </footer>

      {/* Modals & Drawers */}
      <ModeSelectorModal
        isOpen={isModeModalOpen}
        currentMode={operatingMode}
        onClose={() => setIsModeModalOpen(false)}
        onSelectMode={mode => {
          setOperatingMode(mode);
          marketDataService.setOperatingMode(mode);
          logAudit('SYSTEM', 'INFO', `Operating mode altered to ${mode.toUpperCase()}`, undefined, 'OPERATOR');
        }}
      />

      <ReconciliationModal
        isOpen={isReconModalOpen}
        account={account}
        positions={positions}
        onClose={() => setIsReconModalOpen(false)}
        onApplyReconciliation={updated => setAccount(updated)}
        onLogAudit={logAudit}
      />

      <ExecutionQualityModal
        isOpen={isMetricsModalOpen}
        metrics={executionMetrics}
        onClose={() => setIsMetricsModalOpen(false)}
      />

      <EconomicCalendarModal
        isOpen={isCalendarModalOpen}
        events={economicEvents}
        onClose={() => setIsCalendarModalOpen(false)}
      />

      <AuditLogDrawer
        isOpen={isAuditDrawerOpen}
        logs={auditLogs}
        onClose={() => setIsAuditDrawerOpen(false)}
      />

      <KillSwitchModal
        isOpen={isKillSwitchModalOpen}
        openPositionsCount={positions.length}
        isAlreadyActive={riskStatus.killSwitchTriggered}
        onClose={() => setIsKillSwitchModalOpen(false)}
        onConfirmKillSwitch={handleConfirmKillSwitch}
        onResetKillSwitch={handleResetKillSwitch}
      />

      <CheckpointModal
        isOpen={isCheckpointModalOpen}
        checkpoint={savedCheckpoint}
        onClose={() => setIsCheckpointModalOpen(false)}
        onSaveCurrentCheckpoint={handleSaveCurrentCheckpoint}
        onRestoreCheckpoint={handleRestoreCheckpoint}
      />
    </div>
  );
};

export default App;
