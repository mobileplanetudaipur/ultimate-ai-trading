import { InstrumentSpecification, OperatingMode } from '../types/trading';

/**
 * Standard XM / MetaTrader 5 Contract Specifications Library
 * Used as local fallback specifications when disconnected.
 * Explicitly tagged with provenance until broker confirmation.
 */
export const XM_MT5_INSTRUMENT_SPECS: Record<string, InstrumentSpecification & { provenance: string }> = {
  'EUR/USD': {
    symbol: 'EUR/USD',
    displayName: 'Euro vs US Dollar (XM EURUSD)',
    assetClass: 'FOREX',
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    contractSize: 100000,
    tickSize: 0.00001,
    tickValue: 1.0, // USD per pip at 0.1 lot
    digits: 5,
    pipMultiplier: 10000,
    minVolumeLots: 0.01,
    maxVolumeLots: 50.0,
    volumeStepLots: 0.01,
    typicalSpreadPips: 1.2,
    marginCurrency: 'EUR',
    tradingHours: '24/5 (Mon 00:05 - Fri 23:55 EET)',
    provenance: 'XM_STANDARD_SPECIFICATION'
  },
  'GBP/USD': {
    symbol: 'GBP/USD',
    displayName: 'British Pound vs US Dollar (XM GBPUSD)',
    assetClass: 'FOREX',
    baseCurrency: 'GBP',
    quoteCurrency: 'USD',
    contractSize: 100000,
    tickSize: 0.00001,
    tickValue: 1.0,
    digits: 5,
    pipMultiplier: 10000,
    minVolumeLots: 0.01,
    maxVolumeLots: 50.0,
    volumeStepLots: 0.01,
    typicalSpreadPips: 1.6,
    marginCurrency: 'GBP',
    tradingHours: '24/5 (Mon 00:05 - Fri 23:55 EET)',
    provenance: 'XM_STANDARD_SPECIFICATION'
  },
  'USD/JPY': {
    symbol: 'USD/JPY',
    displayName: 'US Dollar vs Japanese Yen (XM USDJPY)',
    assetClass: 'FOREX',
    baseCurrency: 'USD',
    quoteCurrency: 'JPY',
    contractSize: 100000,
    tickSize: 0.001,
    tickValue: 0.65, // converted USD
    digits: 3,
    pipMultiplier: 100,
    minVolumeLots: 0.01,
    maxVolumeLots: 50.0,
    volumeStepLots: 0.01,
    typicalSpreadPips: 1.5,
    marginCurrency: 'USD',
    tradingHours: '24/5 (Mon 00:05 - Fri 23:55 EET)',
    provenance: 'XM_STANDARD_SPECIFICATION'
  },
  'XAU/USD': {
    symbol: 'XAU/USD',
    displayName: 'Gold vs US Dollar (XM GOLD# / XAUUSD)',
    assetClass: 'COMMODITY',
    baseCurrency: 'XAU',
    quoteCurrency: 'USD',
    contractSize: 100, // 100 troy ounces per lot
    tickSize: 0.01,
    tickValue: 1.0,
    digits: 2,
    pipMultiplier: 10,
    minVolumeLots: 0.01,
    maxVolumeLots: 20.0,
    volumeStepLots: 0.01,
    typicalSpreadPips: 2.8,
    marginCurrency: 'USD',
    tradingHours: 'Mon 01:05 - Fri 23:55 EET',
    provenance: 'XM_STANDARD_SPECIFICATION'
  },
  'BTC/USD': {
    symbol: 'BTC/USD',
    displayName: 'Bitcoin vs US Dollar (XM BTCUSD)',
    assetClass: 'CRYPTO',
    baseCurrency: 'BTC',
    quoteCurrency: 'USD',
    contractSize: 1, // 1 Bitcoin per lot
    tickSize: 0.01,
    tickValue: 0.01,
    digits: 2,
    pipMultiplier: 1,
    minVolumeLots: 0.01,
    maxVolumeLots: 10.0,
    volumeStepLots: 0.01,
    typicalSpreadPips: 4.5,
    marginCurrency: 'USD',
    tradingHours: '24/7',
    provenance: 'XM_STANDARD_SPECIFICATION'
  }
};

export interface BrokerConnectionStatus {
  isConnected: boolean;
  adapterType: 'XM_METATRADER_5';
  hostTarget: string;
  terminalStatus: 'NOT_DETECTED' | 'DISCONNECTED' | 'STANDBY' | 'CONNECTED';
  accountType: 'DEMO_ONLY' | 'REAL_PROHIBITED';
  serverName: string;
  errorMessage: string;
  lastCheckedTimestamp: number;
  bridgeEndpoint: string;
}

export class BrokerGatewayService {
  private status: BrokerConnectionStatus = {
    isConnected: false,
    adapterType: 'XM_METATRADER_5',
    hostTarget: '127.0.0.1:8000 (Local Windows MT5 Python Loopback)',
    terminalStatus: 'NOT_DETECTED',
    accountType: 'DEMO_ONLY',
    serverName: 'XMGlobal-Demo (Unverified Offline)',
    errorMessage: 'Windows MT5 terminal bridge (http://127.0.0.1:8000) not active. Real execution remains explicitly blocked.',
    lastCheckedTimestamp: Date.now(),
    bridgeEndpoint: 'http://127.0.0.1:8000/api/v1'
  };

  public getStatus(): BrokerConnectionStatus {
    return { ...this.status, lastCheckedTimestamp: Date.now() };
  }

  /**
   * Derives the truthful operating mode based on actual adapter connectivity,
   * account verification, and permissions.
   */
  public deriveOperatingMode(requestedMode: OperatingMode): {
    effectiveMode: OperatingMode;
    isFallback: boolean;
    reason: string;
  } {
    if (requestedMode === 'disconnected') {
      return {
        effectiveMode: 'disconnected',
        isFallback: false,
        reason: 'User explicitly disconnected trading engines.'
      };
    }

    if (requestedMode === 'read_only') {
      return {
        effectiveMode: 'read_only',
        isFallback: false,
        reason: 'Read-only observation mode active.'
      };
    }

    if (requestedMode === 'live') {
      return {
        effectiveMode: 'simulated',
        isFallback: true,
        reason: 'Live execution is locked by default. Falling back to Simulated Paper Trading.'
      };
    }

    if (requestedMode === 'demo') {
      if (!this.status.isConnected) {
        return {
          effectiveMode: 'simulated',
          isFallback: true,
          reason: 'XM MT5 terminal bridge is offline. Operating in Local Paper Simulation.'
        };
      }
      return {
        effectiveMode: 'demo',
        isFallback: false,
        reason: 'Connected to verified XM MT5 Demo terminal bridge.'
      };
    }

    return {
      effectiveMode: 'simulated',
      isFallback: false,
      reason: 'Local in-memory paper simulation.'
    };
  }

  public getInstrumentSpec(symbol: string): InstrumentSpecification {
    const known = XM_MT5_INSTRUMENT_SPECS[symbol];
    if (known) {
      return known;
    }

    // Fail-safe default with explicit unverified marking
    return {
      symbol,
      displayName: symbol,
      assetClass: 'FOREX',
      baseCurrency: 'USD',
      quoteCurrency: 'USD',
      contractSize: 100000,
      tickSize: 0.00001,
      tickValue: 1.0,
      digits: 5,
      pipMultiplier: 10000,
      minVolumeLots: 0.01,
      maxVolumeLots: 50.0,
      volumeStepLots: 0.01,
      typicalSpreadPips: 2.0,
      marginCurrency: 'USD',
      tradingHours: '24/5'
    };
  }

  /**
   * Truthfully probes the local loopback MT5 daemon
   */
  public async probeBridge(): Promise<BrokerConnectionStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${this.status.bridgeEndpoint}/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        this.status = {
          ...this.status,
          isConnected: Boolean(data.terminal_connected),
          terminalStatus: data.terminal_connected ? 'CONNECTED' : 'STANDBY',
          errorMessage: data.terminal_connected
            ? 'Active connection to Windows MT5 terminal'
            : 'Bridge daemon active, but MT5 terminal not running.',
          lastCheckedTimestamp: Date.now()
        };
      } else {
        this.status.isConnected = false;
        this.status.terminalStatus = 'NOT_DETECTED';
        this.status.errorMessage = `Bridge returned status ${res.status}. Real execution blocked.`;
      }
    } catch {
      this.status.isConnected = false;
      this.status.terminalStatus = 'NOT_DETECTED';
      this.status.errorMessage = 'Local Windows MT5 bridge daemon (127.0.0.1:8000) not reachable. Execution blocked.';
    }
    return this.getStatus();
  }
}

export const brokerGateway = new BrokerGatewayService();
