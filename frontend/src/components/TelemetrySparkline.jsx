import React, { useState } from 'react'

export default function TelemetrySparkline({
  data = [],
  metricKey = 'cpu_usage',
  label = 'CPU Usage',
  unit = '%',
  color = '#06b6d4', // cyan default
  fillGradientId = 'grad-sparkline',
  height = 80,
  threshold = 90,
  maxScale = 100
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null)

  if (!data || data.length === 0) {
    return (
      <div className="h-20 flex items-center justify-center bg-slate-950/40 rounded-xl border border-slate-800/60 text-slate-500 text-xs font-mono">
        No telemetry stream data
      </div>
    )
  }

  // Reverse data so oldest is left (x=0) and newest is right (x=width)
  const sorted = [...data].reverse()
  const width = 320
  const padX = 10
  const padY = 12

  const points = sorted.map((d, i) => {
    const rawVal = parseFloat(d[metricKey] || 0)
    const val = Math.min(maxScale, Math.max(0, rawVal))
    const x = padX + (i / Math.max(1, sorted.length - 1)) * (width - 2 * padX)
    const y = height - padY - (val / maxScale) * (height - 2 * padY)
    return {
      x,
      y,
      val: rawVal,
      isAnomaly: d.is_anomaly,
      anomalyScore: d.anomaly_score,
      time: d.recorded_at ? new Date(d.recorded_at).toLocaleTimeString() : ''
    }
  })

  // Build SVG path
  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`
  }, '')

  // Area path for gradient fill
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x},${height - padY} L ${points[0].x},${height - padY} Z`
    : ''

  const thresholdY = height - padY - (threshold / maxScale) * (height - 2 * padY)
  const latestVal = points.length > 0 ? points[points.length - 1].val : 0

  return (
    <div className="relative p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl font-space shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-300">{label}</span>
          <span className="text-[10px] text-slate-500 font-mono">({sorted.length} pts)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black font-mono text-white">
            {latestVal}
            <span className="text-[10px] text-slate-400 font-normal ml-0.5">{unit}</span>
          </span>
          {latestVal >= threshold && (
            <span className="px-1.5 py-0.2 bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[9px] font-bold rounded">
              HIGH
            </span>
          )}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative overflow-visible">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible cursor-crosshair"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Threshold Guideline */}
          {threshold && (
            <line
              x1={padX}
              y1={thresholdY}
              x2={width - padX}
              y2={thresholdY}
              stroke="#ef4444"
              strokeDasharray="3 3"
              strokeWidth="1"
              strokeOpacity="0.4"
            />
          )}

          {/* Gradient Area */}
          <path d={areaD} fill={`url(#${fillGradientId})`} />

          {/* Stroke Line */}
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {points.map((pt, idx) => (
            <g key={idx}>
              {pt.isAnomaly ? (
                // Pulsing Red Anomaly Dot
                <g>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="6"
                    className="fill-rose-500 opacity-40 animate-ping"
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="4"
                    className="fill-rose-500 stroke-2 stroke-white cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(pt)}
                  />
                </g>
              ) : (
                // Regular subtle dot on hover or end point
                (idx === points.length - 1 || (hoveredPoint && hoveredPoint.x === pt.x)) && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="3.5"
                    fill={color}
                    className="stroke-1 stroke-slate-900 cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(pt)}
                  />
                )
              )}
            </g>
          ))}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute -top-7 pointer-events-none z-20 bg-slate-900 border border-slate-700 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow-xl whitespace-nowrap transform -translate-x-1/2 transition-all"
            style={{ left: `${(hoveredPoint.x / width) * 100}%` }}
          >
            <span>{hoveredPoint.time}</span> •{' '}
            <span className="font-bold text-cyan-300">
              {hoveredPoint.val}{unit}
            </span>
            {hoveredPoint.isAnomaly && (
              <span className="ml-1 text-rose-400 font-bold">
                ⚠️ {hoveredPoint.anomalyScore}σ
              </span>
            )}
          </div>
        )}
      </div>

      {/* Axis Scale Markers */}
      <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono mt-1">
        <span>0{unit}</span>
        {threshold && <span className="text-rose-400/80">Threshold: {threshold}{unit}</span>}
        <span>{maxScale}{unit}</span>
      </div>
    </div>
  )
}
