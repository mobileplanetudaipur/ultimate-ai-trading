import React, { useState, useEffect, useCallback } from 'react';
import {
  AccountState,
  AuditLogEntry,
  ClosedTradeRecord,
  EconomicEvent,
  FeedFreshness,
  MarketQuote,
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
import { brokerGateway } from './services/brokerGateway';

import { NavigationSidebar, ActiveNavTab } from './components/NavigationSidebar';
import { TopBar } from './components/TopBar';
import { OverviewView } from './views/OverviewView';
import { MarketsView } from './views/MarketsView';
import { StrategiesView } from './views/StrategiesView';
import { PortfolioView } from './views/PortfolioView';
import { RiskCenterView } from './views/RiskCenterView';
import { ResearchBacktestsView } from './views/ResearchBacktestsView';
import { ShadowDemoView } from './views/ShadowDemoView';
import { CalendarContextView } from './views/CalendarContextView';
import { AuditRecoveryView } from './views/AuditRecoveryView';
import { ConnectionsSettingsView } from './views/ConnectionsSettingsView';

import { ModeSelectorModal } from './components/ModeSelectorModal';
import { KillSwitchModal } from './components/KillSwitchModal';
import { CheckpointModal } from './components/CheckpointModal';
import { AlertCircle, CheckCircle, Info, ShieldAlert } from 'lucide-react';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error.';

export const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('overview');
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  // Operating State
  const [operatingMode, setOperatingMode] = useState<OperatingMode>('simulated');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('EUR/USD');
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [isFeedDegraded, setIsFeedDegraded] = useState<boolean>(false);

  // Account State (Truthful: strictly unconfirmed paper balance)
  const [account, setAccount] = useState<AccountState>({
    currency: 'USD',
    balance: 10000.0,
    equity: 10000.0,
    marginUsed: 0.0,
    freeMargin: 10000.0,
    marginLevelPercent: 9999.0,
    leverage: 100,
    brokerConfirmed: false, // Strictly false in paper mode
    lastReconciledAt: Date.now(),
    reconciliationStatus: 'BROKER_GATEWAY_DISCONNECTED',
    discrepancies: []
  });

  // Risk State
  const [riskLimits, setRiskLimits] = useState<RiskLimits>(riskEngine.getLimits());
  const [riskStatus, setRiskStatus] = useState<RiskStatus>(riskEngine.getStatus());

  // Orders, Positions, and History
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTradeRecord[]>([]);

  // Macro Events & Audit Trail
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>(
    economicCalendarService.getUpcomingEvents()
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [savedCheckpoint, setSavedCheckpoint] = useState<DurableCheckpoint | null>(null);

  // Modals & Notifications
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [isKillSwitchModalOpen, setIsKillSwitchModalOpen] = useState(false);
  const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);

  // Helper to log audit event
  const logAudit = useCallback((
    category: AuditLogEntry['category'],
    level: AuditLogEntry['level'],
    message: string,
    details?: any,
    actor: AuditLogEntry['actor'] = 'LOCAL_SIMULATOR'
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

    let chk: DurableCheckpoint | null = null;
    try {
      chk = checkpointService.loadCheckpoint();
    } catch (error) {
      const message = getErrorMessage(error);
      logAudit('SYSTEM', 'ERROR', 'Saved local checkpoint could not be loaded.', { error: message }, 'OPERATOR');
      showNotice(`Saved checkpoint could not be loaded: ${message}`, 'error');
    }

    if (chk) {
      setSavedCheckpoint(chk);
      logAudit('SYSTEM', 'INFO', `Local checkpoint ${chk.checkpointId} discovered in browser storage.`, undefined, 'OPERATOR');
    } else {
      logAudit('SYSTEM', 'INFO', 'System initialized in Local Paper Simulation Mode. Strict 0.20% risk gate active.', {
        equity: 10000,
        mode: 'simulated'
      });
    }

    const unsubscribe = marketDataService.subscribe(updatedQuote => {
      setQuotes(marketDataService.getAllQuotes());

      const { closedTrades: newlyClosed } = orderManager.updatePositionsWithQuote(updatedQuote);

      if (newlyClosed.length > 0) {
        for (const t of newlyClosed) {
          riskEngine.recordCompletedTrade(t.netPnl);
          logAudit(
            'ORDER',
            t.netPnl >= 0 ? 'INFO' : 'WARN',
            `Paper position ${t.positionId} closed via ${t.exitReason}. Realized: $${t.netPnl.toFixed(2)}`,
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

  useEffect(() => {
    if (!isNavigationOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsNavigationOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isNavigationOpen]);

  // Recalculate equity and margins when positions change
  useEffect(() => {
    let marginUsed = 0;
    let totalUnrealized = 0;

    for (const pos of positions) {
      const spec = brokerGateway.getInstrumentSpec(pos.symbol);
      marginUsed += (pos.sizeLots * spec.contractSize * pos.entryPrice) / account.leverage;
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

  const activeQuote = quotes.find(q => q.symbol === selectedSymbol) || quotes[0] || {
    symbol: 'EUR/USD',
    bid: 1.0850,
    ask: 1.0851,
    spreadPips: 1.2,
    last: 1.08505,
    high24h: 1.0880,
    low24h: 1.0820,
    volume24h: 4200,
    change24hPercent: 0.12,
    digits: 5,
    pipMultiplier: 10000,
    provider: 'Local In-Memory Simulation',
    timestamp: Date.now(),
    freshness: 'simulated',
    latencyMs: 14,
    isStale: false
  };

  const activeCandles = marketDataService.getCandles(activeQuote.symbol);

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

  // Execute Signal proposal through Deterministic Risk Gate
  const handleExecuteSignal = async (evaluation: StrategyEvaluation) => {
    if (evaluation.signal === 'NO_TRADE') {
      showNotice(`Cannot execute: Strategy returned NO TRADE: ${evaluation.noTradeReason}`, 'error');
      return;
    }

    const proposedSide = evaluation.signal;
    const proposedStop = evaluation.proposedStopLoss || (proposedSide === 'BUY' ? activeQuote.bid - 0.0030 : activeQuote.ask + 0.0030);
    const proposedTp = evaluation.proposedTakeProfit || (proposedSide === 'BUY' ? activeQuote.ask + 0.0050 : activeQuote.bid - 0.0050);
    const entryEstimate = proposedSide === 'BUY' ? activeQuote.ask : activeQuote.bid;

    // Phase 3 Deterministic Risk Gate Check
    const validation = riskEngine.validateOrderProposal(
      activeQuote,
      account,
      positions,
      orders,
      proposedSide,
      proposedStop,
      entryEstimate
    );

    if (!validation.isApproved) {
      logAudit('RISK', 'WARN', `Phase 3 Risk Gate Blocked Order [${validation.ruleBlocked}]`, {
        reason: validation.rejectionMessage,
        strategy: evaluation.strategyName
      }, 'RISK_ENGINE');
      showNotice(`Order Blocked by Risk Gate: ${validation.rejectionMessage}`, 'error');
      return;
    }

    // Phase 4 Local Paper Order Submission
    const clientOrderId = 'paper_cli_' + Math.random().toString(36).substring(2, 8);
    const idempotencyKey = 'idem_' + Date.now().toString(36) + '_' + evaluation.strategyId;

    try {
      const { order } = await orderManager.submitOrder({
        clientOrderId,
        idempotencyKey,
        symbol: activeQuote.symbol,
        side: proposedSide,
        sizeLots: validation.calculatedLotSize || 0.01,
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

      logAudit('ORDER', 'INFO', `Paper Order ${order.id} executed for ${order.requestedSizeLots} lots ${order.side} ${order.symbol} @ ${order.executedPrice}`, {
        orderId: order.id,
        idempotencyKey,
        stopLoss: proposedStop,
        takeProfit: proposedTp,
        riskAllocatedUsd: validation.calculatedRiskAmount
      });

      showNotice(`Paper Order ${order.id} executed. ${order.requestedSizeLots}L ${order.symbol} @ ${order.executedPrice}.`, 'success');
    } catch (err: any) {
      logAudit('ORDER', 'ERROR', `Order submission failed: ${err.message}`, { clientOrderId });
      showNotice(`Order submission error: ${err.message}`, 'error');
    }
  };

  const handleClosePosition = (positionId: string) => {
    const closed = orderManager.closePosition(positionId, activeQuote, 'MANUAL_CLOSE');
    if (closed) {
      riskEngine.recordCompletedTrade(closed.netPnl);
      setClosedTrades([...orderManager.getClosedTrades()]);
      setPositions([...orderManager.getPositions()]);
      setRiskStatus(riskEngine.getStatus());
      logAudit('ORDER', 'INFO', `Paper position ${positionId} manually closed. Realized P&L: $${closed.netPnl.toFixed(2)}`, { trade: closed }, 'OPERATOR');
      showNotice(`Position ${positionId} closed. Realized: $${closed.netPnl.toFixed(2)}`, 'info');
    }
  };

  const handleToggleTrailingStop = (positionId: string) => {
    const ok = orderManager.toggleTrailingStop(positionId, 20);
    if (ok) {
      setPositions([...orderManager.getPositions()]);
      logAudit('ORDER', 'INFO', `Stop Policy updated for position ${positionId}: Trailing Stop toggled.`, undefined, 'OPERATOR');
    }
  };

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

    logAudit('KILL_SWITCH', 'SECURITY', `Emergency Halt Triggered. All automated entries blocked. ${closedCount} positions closed.`, {
      closedPositionsCount: closedCount
    }, 'OPERATOR');

    showNotice(`EMERGENCY HALT ACTIVATED. System locked. ${closedCount} position(s) closed.`, 'error');
  };

  const handleResetKillSwitch = () => {
    riskEngine.resetKillSwitch();
    setRiskStatus(riskEngine.getStatus());
    logAudit('KILL_SWITCH', 'INFO', 'Emergency Halt reset by authorized operator. Trading eligible.', undefined, 'OPERATOR');
    showNotice('Emergency Halt has been reset. Automated trading eligible.', 'success');
  };

  const handleTogglePause = () => {
    const nextPaused = !riskStatus.isTradingPaused;
    riskEngine.setTradingPaused(nextPaused, nextPaused ? 'Paused by Operator' : undefined);
    setRiskStatus(riskEngine.getStatus());
    logAudit('SYSTEM', 'INFO', nextPaused ? 'Automated entries paused by operator.' : 'Automated entries resumed.', undefined, 'OPERATOR');
  };

  const handleSimulateLoss = () => {
    riskEngine.recordCompletedTrade(-20.0); // 0.20% loss test
    setRiskStatus(riskEngine.getStatus());
    logAudit('RISK', 'WARN', 'Test simulated loss recorded (-$20.00) to test 5-loss lockout counter.', undefined, 'OPERATOR');
  };

  const handleToggleDataDegradation = () => {
    const nextDegraded = !isFeedDegraded;
    setIsFeedDegraded(nextDegraded);
    marketDataService.setDegradedState(nextDegraded);
    logAudit('SYSTEM', nextDegraded ? 'WARN' : 'INFO', nextDegraded ? 'Data feed degradation SIMULATED (stale quotes).' : 'Data feed restored to normal.', undefined, 'OPERATOR');
  };

  const handleSaveCurrentCheckpoint = () => {
    try {
      const currentRiskStatus = riskEngine.getStatus();
      const chk = checkpointService.saveCheckpoint({
        operatingMode,
        account,
        positions,
        orders,
        closedTrades,
        riskLimits,
        riskStatus: currentRiskStatus,
        auditLogs
      });
      setRiskStatus(currentRiskStatus);
      setSavedCheckpoint(chk);
      logAudit('SYSTEM', 'INFO', `Local checkpoint saved: ${chk.checkpointId}`, { timestamp: chk.timestamp }, 'OPERATOR');
      showNotice(`Local checkpoint ${chk.checkpointId} saved to browser storage.`, 'success');
    } catch (error) {
      const message = getErrorMessage(error);
      logAudit('SYSTEM', 'ERROR', 'Local checkpoint save failed.', { error: message }, 'OPERATOR');
      showNotice(`Checkpoint was not saved: ${message}`, 'error');
    }
  };

  const handleRestoreCheckpoint = () => {
    if (!savedCheckpoint) return;
    setOperatingMode(savedCheckpoint.operatingMode);
    marketDataService.setOperatingMode(savedCheckpoint.operatingMode);
    setAccount(savedCheckpoint.account);
    riskEngine.restoreStatus(savedCheckpoint.riskStatus);
    setRiskStatus(riskEngine.getStatus());
    orderManager.setInitialState(savedCheckpoint.positions, savedCheckpoint.orders, savedCheckpoint.closedTrades);
    setPositions([...orderManager.getPositions()]);
    setOrders([...orderManager.getOrders()]);
    setClosedTrades([...orderManager.getClosedTrades()]);
    setIsCheckpointModalOpen(false);
    logAudit('SYSTEM', 'INFO', `Checkpoint ${savedCheckpoint.checkpointId} restored successfully.`, undefined, 'OPERATOR');
    showNotice('System restored from checkpoint.', 'success');
  };

  const executionMetrics = calculateExecutionMetrics(closedTrades, orders);

  const getViewTitle = () => {
    switch (activeTab) {
      case 'overview': return 'Executive Overview';
      case 'markets': return 'Markets & Live Telemetry';
      case 'strategies': return 'Strategies & Multi-Regime Signals';
      case 'portfolio': return 'Portfolio & Order Lifecycle';
      case 'risk': return 'Deterministic Risk Center';
      case 'research': return 'Research & Backtest Governance';
      case 'shadow': return 'Shadow Mode & MT5 Bridge';
      case 'calendar': return 'Macroeconomic Blackout Calendar';
      case 'audit': return 'Operational Audit & Checkpoints';
      case 'settings': return 'Bridge Connections & Settings';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased">
      {/* Sleek Apple-inspired Navigation Sidebar */}
      <NavigationSidebar
        activeTab={activeTab}
        onSelectTab={tab => {
          setActiveTab(tab);
          setIsNavigationOpen(false);
        }}
        isOpen={isNavigationOpen}
        onClose={() => setIsNavigationOpen(false)}
        operatingMode={operatingMode}
        riskStatus={riskStatus}
        openPositionsCount={positions.length}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <TopBar
          activeViewTitle={getViewTitle()}
          account={account}
          riskStatus={riskStatus}
          riskLimits={riskLimits}
          isNavigationOpen={isNavigationOpen}
          onToggleNavigation={() => setIsNavigationOpen(open => !open)}
          feedLatencyMs={activeQuote.latencyMs}
          onTriggerKillSwitch={() => setIsKillSwitchModalOpen(true)}
          onTogglePause={handleTogglePause}
        />

        {/* Floating Notification Toast */}
        {bannerNotice && (
          <div className={`fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-xl shadow-2xl border text-xs font-medium flex items-start gap-2.5 backdrop-blur-md transition-all ${
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

        {/* View Routing */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
          {activeTab === 'overview' && (
            <OverviewView
              account={account}
              riskStatus={riskStatus}
              riskLimits={riskLimits}
              positions={positions}
              strategyEvaluations={strategyEvaluations}
              auditLogs={auditLogs}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'markets' && (
            <MarketsView
              quotes={quotes}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
              candles={activeCandles}
              positions={positions}
              regime={marketRegime}
              feedFreshness={activeQuote.freshness}
              onToggleDataDegradation={handleToggleDataDegradation}
              isDegraded={isFeedDegraded}
            />
          )}

          {activeTab === 'strategies' && (
            <StrategiesView
              strategyEvaluations={strategyEvaluations}
              onExecuteSignal={handleExecuteSignal}
              isTradingPaused={riskStatus.isTradingPaused}
              isCooldownActive={riskStatus.isCooldownActive}
              killSwitchActive={riskStatus.killSwitchTriggered}
            />
          )}

          {activeTab === 'portfolio' && (
            <PortfolioView
              positions={positions}
              orders={orders}
              closedTrades={closedTrades}
              onClosePosition={handleClosePosition}
              onToggleTrailingStop={handleToggleTrailingStop}
            />
          )}

          {activeTab === 'risk' && (
            <RiskCenterView
              limits={riskLimits}
              status={riskStatus}
              account={account}
              quotes={quotes}
              positions={positions}
              onSimulateLoss={handleSimulateLoss}
            />
          )}

          {activeTab === 'research' && (
            <ResearchBacktestsView
              metrics={executionMetrics}
            />
          )}

          {activeTab === 'shadow' && (
            <ShadowDemoView />
          )}

          {activeTab === 'calendar' && (
            <CalendarContextView
              events={economicEvents}
            />
          )}

          {activeTab === 'audit' && (
            <AuditRecoveryView
              logs={auditLogs}
              checkpoint={savedCheckpoint}
              onSaveCheckpoint={handleSaveCurrentCheckpoint}
              onRestoreCheckpoint={handleRestoreCheckpoint}
            />
          )}

          {activeTab === 'settings' && (
            <ConnectionsSettingsView />
          )}
        </main>

        {/* Quiet Professional Footer */}
        <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-[11px] text-slate-500 font-mono">
          Ultimate AI Trading Platform • Truthful In-Memory Paper Simulation • No Real Capital At Risk • Rule 1 Live Trading Locked
        </footer>
      </div>

      {/* Modals */}
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
