import { Candle } from '../types/trading';

/**
 * Calculates Simple Moving Average (SMA)
 */
export function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(data[i]);
      continue;
    }
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  let previousEMA = data[0];
  result.push(previousEMA);

  for (let i = 1; i < data.length; i++) {
    const currentEMA = (data[i] - previousEMA) * multiplier + previousEMA;
    result.push(currentEMA);
    previousEMA = currentEMA;
  }
  return result;
}

/**
 * Calculates Relative Strength Index (RSI)
 */
export function calculateRSI(closes: number[], period: number = 14): number[] {
  const result: number[] = [];
  if (closes.length <= period) {
    return closes.map(() => 50);
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(50);
      continue;
    }
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }

  return result;
}

/**
 * Calculates Average True Range (ATR)
 */
export function calculateATR(candles: Candle[], period: number = 14): number[] {
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low);
      continue;
    }
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr.push(Math.max(hl, hc, lc));
  }

  return calculateSMA(tr, period);
}

/**
 * Calculates Bollinger Bands (Middle, Upper, Lower)
 */
export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  multiplier: number = 2
): { middle: number[]; upper: number[]; lower: number[] } {
  const middle = calculateSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(closes[i]);
      lower.push(closes[i]);
      continue;
    }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    upper.push(mean + multiplier * stdDev);
    lower.push(mean - multiplier * stdDev);
  }

  return { middle, upper, lower };
}

/**
 * Estimates Average Directional Index (ADX)
 */
export function estimateADX(candles: Candle[], period: number = 14): number {
  if (candles.length < period * 2) return 22; // default moderate
  
  let plusDmSum = 0;
  let minusDmSum = 0;
  let trSum = 0;

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;

    const plusDm = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDm = downMove > upMove && downMove > 0 ? downMove : 0;

    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );

    plusDmSum += plusDm;
    minusDmSum += minusDm;
    trSum += tr;
  }

  if (trSum === 0) return 20;

  const plusDi = (plusDmSum / trSum) * 100;
  const minusDi = (minusDmSum / trSum) * 100;
  const diDiff = Math.abs(plusDi - minusDi);
  const diSum = plusDi + minusDi;

  if (diSum === 0) return 20;
  const dx = (diDiff / diSum) * 100;

  return Math.min(100, Math.max(0, dx));
}

/**
 * Formats price according to digit precision
 */
export function formatPrice(price: number, digits: number = 5): string {
  if (isNaN(price)) return '0.00000';
  return price.toFixed(digits);
}

/**
 * Converts price difference to pips
 */
export function priceDiffToPips(diff: number, pipMultiplier: number = 10000): number {
  return Math.round(diff * pipMultiplier * 10) / 10;
}
