import { InstrumentSpecification } from '../types/trading';

/**
 * Local sizing assumptions for paper simulation only; these are not broker-verified.
 */
export const SIMULATED_INSTRUMENT_SPECS: Record<string, InstrumentSpecification> = {
  'EUR/USD': {
    symbol: 'EUR/USD',
    displayName: 'Euro vs US Dollar (simulation)',
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
    displayName: 'British Pound vs US Dollar (simulation)',
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
    displayName: 'US Dollar vs Japanese Yen (simulation)',
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
    displayName: 'Gold vs US Dollar (simulation)',
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
    displayName: 'Bitcoin vs US Dollar (simulation)',
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
  adapterType: 'NOT_IMPLEMENTED';
  hostTarget: string;
  terminalStatus: 'NOT_IMPLEMENTED';
  accountType: 'PAPER_SIMULATION';
  serverName: string;
  errorMessage: string;
  lastCheckedTimestamp: number;
}

export class BrokerGatewayService {
  private status: BrokerConnectionStatus = {
    isConnected: false,
    adapterType: 'NOT_IMPLEMENTED',
    hostTarget: 'Not configured',
    terminalStatus: 'NOT_IMPLEMENTED',
    accountType: 'PAPER_SIMULATION',
    serverName: 'Not configured',
    errorMessage: 'Manual demo order ticket only; strategy automation is not connected. Live order activation is locked pending separate release approval.',
    lastCheckedTimestamp: Date.now()
  };

  public getStatus(): BrokerConnectionStatus {
    return { ...this.status, lastCheckedTimestamp: Date.now() };
  }

  public getInstrumentSpec(symbol: string): InstrumentSpecification | undefined {
    return SIMULATED_INSTRUMENT_SPECS[symbol];
  }
}

export const brokerGateway = new BrokerGatewayService();
