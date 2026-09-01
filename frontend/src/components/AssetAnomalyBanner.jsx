import React from 'react'
import { Link } from 'react-router-dom'

export default function AssetAnomalyBanner({ latestTelemetry, onOpenSimulator }) {
  if (!latestTelemetry || !latestTelemetry.is_anomaly) return null

  const reasons = latestTelemetry.anomaly_reasons || []
  const score = latestTelemetry.anomaly_score || '3.0+'

  return (
    <div className="mb-6 p-4 bg-rose-950/40 border border-rose-500/60 rounded-2xl shadow-[0_0_16px_rgba(244,63,94,0.25)] font-space animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5">⚠️</span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-rose-300">
                Active Outlier Anomaly Detected ({score}σ Deviation)
              </h4>
              <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-mono font-bold rounded-full">
                SRE ALERT
              </span>
            </div>
            {reasons.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-xs text-rose-200/90 font-mono">
                {reasons.map((r, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span>•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-rose-200/90 font-mono mt-1">
                Telemetry metrics significantly exceeded rolling historical baselines.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
          <Link
            to="/incidents"
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
          >
            <span>🚨</span> View Incident
          </Link>
          <button
            type="button"
            onClick={onOpenSimulator}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            🧪 Chaos Simulator
          </button>
        </div>
      </div>
    </div>
  )
}
