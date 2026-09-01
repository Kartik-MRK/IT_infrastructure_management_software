import React, { useState, useEffect } from 'react'

export default function SLAComplianceWidget({ onOpenPolicyModal, canManagePolicy, refreshKey }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSummary()
  }, [refreshKey])

  async function fetchSummary() {
    try {
      setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch('http://localhost:5000/api/sla/summary', { headers })
      if (res.ok) {
        const json = await res.json()
        setSummary(json)
      }
    } catch (err) {
      console.error('Failed to load SLA summary:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card mb-6 !p-5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl animate-pulse font-space">
        <div className="h-20 bg-slate-800/60 rounded-xl"></div>
      </div>
    )
  }

  if (!summary) return null

  const compliancePercent = parseFloat(summary.sla_compliance_percentage || 100)
  const activeBreaches = parseInt(summary.active_breached_count || 0)
  const approachingBreaches = parseInt(summary.active_approaching_count || 0)

  return (
    <div className="card mb-6 !p-6 bg-slate-900/90 border-l-4 border-l-cyan-500 border border-slate-800 rounded-2xl shadow-xl font-space">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⏱️</span>
            <h3 className="text-base font-bold text-white tracking-tight">
              SLA Reliability & Operational Timers
            </h3>
            <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
              compliancePercent >= 95
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : compliancePercent >= 80
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
            }`}>
              {compliancePercent}% Met
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Contractual incident response & resolution compliance with real-time countdown timers.
          </p>
        </div>

        {canManagePolicy && (
          <button
            type="button"
            onClick={onOpenPolicyModal}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all self-start sm:self-auto cursor-pointer"
          >
            <span>⚙️</span> Configure Policies
          </button>
        )}
      </div>

      {/* SLA Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        {/* Compliance Rate */}
        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
            SLA Attainment
          </span>
          <div className="text-xl font-black text-white font-mono">
            {compliancePercent}%
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {summary.resolved_within_sla} / {summary.resolved_incidents} Resolved
          </span>
        </div>

        {/* MTTD (Mean Time to Respond) */}
        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
            Avg MTTD (Response)
          </span>
          <div className="text-xl font-black text-cyan-400 font-mono">
            {summary.avg_mttd_minutes}m
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Mean Time to Acknowledge
          </span>
        </div>

        {/* MTTR (Mean Time to Resolve) */}
        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
            Avg MTTR (Resolution)
          </span>
          <div className="text-xl font-black text-purple-400 font-mono">
            {summary.avg_mttr_minutes > 60 
              ? `${Math.floor(summary.avg_mttr_minutes / 60)}h ${Math.round(summary.avg_mttr_minutes % 60)}m`
              : `${summary.avg_mttr_minutes}m`}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Mean Time to Resolution
          </span>
        </div>

        {/* Active Breaches Warning */}
        <div className={`p-3 rounded-xl border ${
          activeBreaches > 0
            ? 'bg-rose-950/40 border-rose-500/60 animate-pulse'
            : approachingBreaches > 0
            ? 'bg-amber-950/30 border-amber-500/50'
            : 'bg-slate-950/60 border-slate-800/80'
        }`}>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
            Active Alerts
          </span>
          <div className={`text-xl font-black font-mono ${
            activeBreaches > 0
              ? 'text-rose-400'
              : approachingBreaches > 0
              ? 'text-amber-400'
              : 'text-emerald-400'
          }`}>
            {activeBreaches > 0 ? `⛔ ${activeBreaches} Breached` : approachingBreaches > 0 ? `⚠️ ${approachingBreaches} Warning` : '✓ 0 Breaches'}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {approachingBreaches} approaching deadline
          </span>
        </div>
      </div>
    </div>
  )
}
