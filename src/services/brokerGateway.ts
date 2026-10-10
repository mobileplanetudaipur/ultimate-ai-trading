import { InstrumentSpecification } from '../types/trading';

/**
 * Standard XM / MetaTrader 5 Contract Specifications
 * Verified against XM MT5 standard contract specifications for FX, Commodities, and Crypto.
 */
export const XM_MT5_INSTRUMENT_SPECS: Record<string, InstrumentSpecification> = {
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
    tradingHours: '24/5 (Mon 00:05 - Fri 23:55 EET)'
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
    tradingHours: '24/5 (Mon 00:05 - Fri 23:55 EET)'
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
    tradingHours: '24/5 (Mon 00:05 - Fri 23:55 EET)'
  },
  'XAU/USD': {
    symbol: 'XAU/USD',
    displayName: 'Gold vs US Dollar (XM GOLD# / XAUUSD)',
    assetClass: 'COMMODITY',
    baseCurrency: 'XAU',
    quoteCurrency: 'USD',
    contractSize: 100, // 100 troy ounces per lot
    tickSize: 0.01,
    tickValue: 1.0, // $1 per 0.01 move per standard lot
    digits: 2,
    pipMultiplier: 10,
    minVolumeLots: 0.01,
    maxVolumeLots: 20.0,
    volumeStepLots: 0.01,
    typicalSpreadPips: 2.8,
    marginCurrency: 'USD',
    tradingHours: 'Mon 01:05 - Fri 23:55 EET'
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
    tradingHours: '24/7'
  }
};

export interface BrokerConnectionStatus {
  isConnected: boolean;
  adapterType: 'XM_METATRADER_5';
  hostTarget: string;
  terminalStatus: 'NOT_DETECTED' | 'DISCONNECTED' | 'STANDBY';
  accountType: 'DEMO_ONLY';
  serverName: string;
  errorMessage: string;
  lastCheckedTimestamp: number;
}

export class BrokerGatewayService {
  private status: BrokerConnectionStatus = {
    isConnected: false,
    adapterType: 'XM_METATRADER_5',
    hostTarget: '127.0.0.1:8000 (Local Windows MT5 Python/ZeroMQ Bridge)',
    terminalStatus: 'NOT_DETECTED',
    accountType: 'DEMO_ONLY',
    serverName: 'XMGlobal-Demo',
    errorMessage: 'Windows MT5 terminal bridge is not active. Real execution remains explicitly blocked.',
    lastCheckedTimestamp: Date.now()
  };

  public getStatus(): BrokerConnectionStatus {
    return { ...this.status, lastCheckedTimestamp: Date.now() };
  }

  public getInstrumentSpec(symbol: string): InstrumentSpecification {
    return (
      XM_MT5_INSTRUMENT_SPECS[symbol] || {
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
      }
    );
  }
}

export const brokerGateway = new BrokerGatewayService();
