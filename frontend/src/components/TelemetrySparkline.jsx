import React, { useState } from 'react'

const THRESHOLD_LINE = '#dc2626'

export default function TelemetrySparkline({
  data = [],
  metricKey = 'cpu_usage',
  label = 'CPU Usage',
  unit = '%',
  color = '#0ea5e9',
  fillGradientId = 'grad-sparkline',
  height = 80,
  threshold = 90,
  maxScale = 100
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  if (!data || data.length === 0) {
    return (
      <div className="spark-empty">
        No telemetry recorded for this window
        <style>{SPARK_EMPTY_CSS}</style>
      </div>
    )
  }

  // Reverse data so oldest is left (x=0) and newest is right (x=width)
  const sorted = [...data].reverse()
  const width = 320
  const padX = 10
  const padY = 12

  const points = sorted.map((d, i) => {
    // parseFloat on a non-numeric field produced NaN, which silently broke
    // the whole path — one bad sample used to blank the entire chart.
    const parsed = parseFloat(d[metricKey])
    const rawVal = Number.isFinite(parsed) ? parsed : 0
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

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`
  }, '')

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x},${height - padY} L ${points[0].x},${height - padY} Z`
    : ''

  const thresholdY = height - padY - (threshold / maxScale) * (height - 2 * padY)
  const latestVal = points.length > 0 ? points[points.length - 1].val : 0
  const show = (n) => (Number.isInteger(n) ? n : Number(n).toFixed(1))

  const hovered = hoveredIndex != null ? points[hoveredIndex] : null
  // Column width for the invisible hit targets. A 4px dot was impossible to
  // hit with a mouse, and non-anomaly dots were only rendered once hovered —
  // so the tooltip could never open on any middle sample at all.
  const band = (width - 2 * padX) / Math.max(1, points.length - 1)

  return (
    <div className="spark">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[11.5px] font-bold truncate" style={{ color: 'var(--text-soft)' }}>{label}</span>
          <span className="text-[10px] font-mono tnum shrink-0" style={{ color: 'var(--text-faint)' }}>
            {sorted.length} pts
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[14px] font-bold font-mono tnum" style={{ color: 'var(--text)' }}>
            {show(latestVal)}
            <span className="text-[10px] font-normal ml-0.5" style={{ color: 'var(--text-muted)' }}>{unit}</span>
          </span>
          {/* Was `py-0.2`, which is not a Tailwind scale value — the class
              compiled to nothing, so this pill had no vertical padding. */}
          {latestVal >= threshold && <span className="badge-danger">High</span>}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          style={{ display: 'block', cursor: 'crosshair' }}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {threshold && (
            <line
              x1={padX} y1={thresholdY} x2={width - padX} y2={thresholdY}
              stroke={THRESHOLD_LINE}
              strokeDasharray="3 3"
              strokeWidth="1"
              strokeOpacity="0.45"
            />
          )}

          <path d={areaD} fill={`url(#${fillGradientId})`} />

          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Anomaly halos are static rings now. animate-ping on every
              outlier meant a bad window filled the chart with expanding
              circles, which hid the very shape you were reading. */}
          {points.map((pt, idx) => pt.isAnomaly && (
            <circle key={`a${idx}`} cx={pt.x} cy={pt.y} r="6.5"
                    fill="none" stroke={THRESHOLD_LINE} strokeWidth="1.25" strokeOpacity="0.5" />
          ))}

          {points.map((pt, idx) => {
            const active = hoveredIndex === idx
            if (!pt.isAnomaly && !active && idx !== points.length - 1) return null
            return (
              /* strokeWidth/stroke go through `style` because an SVG
                 presentation attribute cannot parse var(). */
              <circle
                key={`d${idx}`}
                cx={pt.x} cy={pt.y}
                r={pt.isAnomaly ? 3.75 : active ? 4 : 3.25}
                fill={pt.isAnomaly ? THRESHOLD_LINE : color}
                style={{ stroke: 'var(--surface)', strokeWidth: 1.5 }}
              />
            )
          })}

          {/* Full-height hit columns: pointing anywhere above a sample
              selects it, instead of demanding a hit on the dot itself. */}
          {points.map((pt, idx) => (
            <rect
              key={`h${idx}`}
              x={pt.x - band / 2}
              y={0}
              width={band}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHoveredIndex(idx)}
            />
          ))}
        </svg>

        {hovered && (
          /* No transition on `left`: the tooltip tracks the pointer, and
             easing a position that retargets every few pixels reads as lag. */
          <div
            className="spark-tip"
            style={{ left: `${Math.min(90, Math.max(10, (hovered.x / width) * 100))}%` }}
          >
            <span>{hovered.time}</span>
            <span aria-hidden="true" style={{ color: 'var(--text-faint)' }}>·</span>
            <strong>{show(hovered.val)}{unit}</strong>
            {hovered.isAnomaly && (
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                {hovered.anomalyScore}σ
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[9.5px] font-mono tnum mt-1"
           style={{ color: 'var(--text-faint)' }}>
        <span>0{unit}</span>
        {threshold && <span style={{ color: 'var(--danger)' }}>Threshold {threshold}{unit}</span>}
        <span>{maxScale}{unit}</span>
      </div>

      <style>{`
        .spark {
          position: relative;
          padding: 12px 13px;
          border-radius: 12px;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
        }

        .spark-tip {
          position: absolute;
          top: -6px;
          z-index: 20;
          display: flex; align-items: center; gap: 5px;
          padding: 3px 7px;
          border-radius: 7px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 10px;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          pointer-events: none;
          transform: translate(-50%, -100%);
          color: var(--text-soft);
          background: var(--surface);
          border: 1px solid var(--line-strong);
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.12);
        }
        .spark-tip strong { color: var(--text); font-weight: 700; }
      `}</style>
    </div>
  )
}

const SPARK_EMPTY_CSS = `
  .spark-empty {
    display: flex; align-items: center; justify-content: center;
    height: 80px;
    border-radius: 12px;
    font-size: 11.5px;
    color: var(--text-faint);
    background: var(--surface-sunk);
    border: 1px dashed var(--line-strong);
  }
`
