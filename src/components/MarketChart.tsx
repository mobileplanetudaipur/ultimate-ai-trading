import React, { useMemo } from 'react';
import { Candle, MarketQuote, PositionRecord } from '../types/trading';
import { calculateBollingerBands, calculateEMA, formatPrice } from '../utils/indicators';

interface MarketChartProps {
  symbol: string;
  quote: MarketQuote;
  candles: Candle[];
  positions: PositionRecord[];
}

export const MarketChart: React.FC<MarketChartProps> = ({
  symbol,
  quote,
  candles,
  positions
}) => {
  // Take last 45 candles for clean viewing
  const viewCandles = useMemo(() => candles.slice(-45), [candles]);

  const { minPrice, maxPrice, ema20Values, ema50Values, bb } = useMemo(() => {
    if (viewCandles.length === 0) {
      return { minPrice: 0, maxPrice: 1, ema20Values: [], ema50Values: [], bb: { upper: [], lower: [], middle: [] } };
    }

    const closes = candles.map(c => c.close);
    const ema20 = calculateEMA(closes, 20).slice(-45);
    const ema50 = calculateEMA(closes, 50).slice(-45);
    const bands = calculateBollingerBands(closes, 20, 2);
    const bbUpper = bands.upper.slice(-45);
    const bbLower = bands.lower.slice(-45);
    const bbMid = bands.middle.slice(-45);

    let low = Math.min(...viewCandles.map(c => c.low));
    let high = Math.max(...viewCandles.map(c => c.high));

    // Include open positions SL/TP in price bounds
    const symbolPositions = positions.filter(p => p.symbol === symbol);
    for (const p of symbolPositions) {
      if (p.stopLossPrice > 0) {
        low = Math.min(low, p.stopLossPrice);
        high = Math.max(high, p.stopLossPrice);
      }
      if (p.takeProfitPrice > 0) {
        low = Math.min(low, p.takeProfitPrice);
        high = Math.max(high, p.takeProfitPrice);
      }
    }

    const padding = (high - low) * 0.12 || 0.001;
    return {
      minPrice: low - padding,
      maxPrice: high + padding,
      ema20Values: ema20,
      ema50Values: ema50,
      bb: { upper: bbUpper, lower: bbLower, middle: bbMid }
    };
  }, [candles, viewCandles, positions, symbol]);

  const chartWidth = 720;
  const chartHeight = 280;
  const priceRange = maxPrice - minPrice || 1;

  const getY = (price: number) => {
    return chartHeight - ((price - minPrice) / priceRange) * chartHeight;
  };

  const candleWidth = Math.max(4, Math.floor((chartWidth / viewCandles.length) * 0.65));
  const stepX = chartWidth / viewCandles.length;

  // Build SVG path for EMA20
  const ema20Path = useMemo(() => {
    if (ema20Values.length === 0) return '';
    return ema20Values
      .map((val, idx) => {
        const x = idx * stepX + stepX / 2;
        const y = getY(val);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [ema20Values, stepX, minPrice, maxPrice]);

  // Build SVG path for EMA50
  const ema50Path = useMemo(() => {
    if (ema50Values.length === 0) return '';
    return ema50Values
      .map((val, idx) => {
        const x = idx * stepX + stepX / 2;
        const y = getY(val);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [ema50Values, stepX, minPrice, maxPrice]);

  const symbolPositions = positions.filter(p => p.symbol === symbol);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-base font-bold text-white tracking-wide">{symbol}</span>
            <span className="ml-2 text-xs text-slate-400 font-mono">M15 Timeframe</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">Bid: <span className="text-white font-semibold">{formatPrice(quote.bid, quote.digits)}</span></span>
            <span className="text-slate-400">Ask: <span className="text-white font-semibold">{formatPrice(quote.ask, quote.digits)}</span></span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
              Spread: {quote.spreadPips.toFixed(1)}p
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-sky-400 rounded-full" />
            <span>EMA 20</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-indigo-400 rounded-full" />
            <span>EMA 50</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-emerald-500" />
            <span className="w-2 h-2 rounded-sm bg-rose-500" />
            <span>Candles</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full h-[280px] bg-slate-950/60 rounded-lg overflow-hidden border border-slate-800/60">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Horizontal grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map(ratio => {
            const y = chartHeight * ratio;
            const priceLevel = maxPrice - ratio * priceRange;
            return (
              <g key={ratio}>
                <line
                  x1="0"
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x="6"
                  y={y - 4}
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {formatPrice(priceLevel, quote.digits)}
                </text>
              </g>
            );
          })}

          {/* EMA Lines */}
          {ema50Path && (
            <path
              d={ema50Path}
              fill="none"
              stroke="#818cf8"
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />
          )}
          {ema20Path && (
            <path
              d={ema20Path}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />
          )}

          {/* Candlesticks */}
          {viewCandles.map((c, idx) => {
            const xCenter = idx * stepX + stepX / 2;
            const isBullish = c.close >= c.open;
            const candleTop = getY(Math.max(c.open, c.close));
            const candleBottom = getY(Math.min(c.open, c.close));
            const height = Math.max(1, candleBottom - candleTop);
            const highY = getY(c.high);
            const lowY = getY(c.low);
            const color = isBullish ? '#10b981' : '#f43f5e';

            return (
              <g key={idx}>
                {/* Wick */}
                <line
                  x1={xCenter}
                  y1={highY}
                  x2={xCenter}
                  y2={lowY}
                  stroke={color}
                  strokeWidth="1"
                />
                {/* Real Body */}
                <rect
                  x={xCenter - candleWidth / 2}
                  y={candleTop}
                  width={candleWidth}
                  height={height}
                  fill={color}
                  rx="1"
                />
              </g>
            );
          })}

          {/* Active Positions Overlay */}
          {symbolPositions.map(pos => {
            const entryY = getY(pos.entryPrice);
            const slY = getY(pos.stopLossPrice);
            const tpY = pos.takeProfitPrice > 0 ? getY(pos.takeProfitPrice) : null;

            return (
              <g key={pos.id}>
                {/* Entry Price Line */}
                <line
                  x1="0"
                  y1={entryY}
                  x2={chartWidth}
                  y2={entryY}
                  stroke={pos.side === 'BUY' ? '#3b82f6' : '#ec4899'}
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
                <rect
                  x={chartWidth - 110}
                  y={entryY - 10}
                  width="105"
                  height="18"
                  fill="#1e293b"
                  rx="3"
                />
                <text
                  x={chartWidth - 105}
                  y={entryY + 3}
                  fill="#93c5fd"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {pos.side} {pos.sizeLots}L @ {formatPrice(pos.entryPrice, quote.digits)}
                </text>

                {/* Stop Loss Line */}
                <line
                  x1="0"
                  y1={slY}
                  x2={chartWidth}
                  y2={slY}
                  stroke="#ef4444"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text
                  x={chartWidth - 75}
                  y={slY - 3}
                  fill="#fca5a5"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  SL: {formatPrice(pos.stopLossPrice, quote.digits)}
                </text>

                {/* Take Profit Line */}
                {tpY !== null && (
                  <>
                    <line
                      x1="0"
                      y1={tpY}
                      x2={chartWidth}
                      y2={tpY}
                      stroke="#22c55e"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={chartWidth - 75}
                      y={tpY - 3}
                      fill="#86efac"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      TP: {formatPrice(pos.takeProfitPrice, quote.digits)}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Current simulated price line */}
          <line
            x1="0"
            y1={getY(quote.last)}
            x2={chartWidth}
            y2={getY(quote.last)}
            stroke="#e2e8f0"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        </svg>

        {/* Floating price label */}
        <div
          className="absolute right-2 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white shadow-md pointer-events-none"
          style={{ top: `${Math.max(8, Math.min(250, getY(quote.last) - 12))}px` }}
        >
          {formatPrice(quote.last, quote.digits)}
        </div>
      </div>
    </div>
  );
};
