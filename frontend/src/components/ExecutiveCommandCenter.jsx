import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function ExecutiveCommandCenter() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30) // seconds
  const [lastRefreshed, setLastRefreshed] = useState(new Date())

  useEffect(() => {
    fetchMetrics()

    if (refreshInterval > 0) {
      const timer = setInterval(() => {
        fetchMetrics(false)
      }, refreshInterval * 1000)
      return () => clearInterval(timer)
    }
  }, [refreshInterval])

  async function fetchMetrics(showLoading = true) {
    try {
      if (showLoading) setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch('http://localhost:5000/api/command-center/metrics', { headers })
      if (res.ok) {
        const json = await res.json()
        setData(json.command_center)
        setLastRefreshed(new Date())
      }
    } catch (err) {
      console.error('Command center fetch error:', err)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="card !p-8 animate-pulse border border-gray-200 dark:border-slate-800 mb-8">
        <div className="h-6 bg-gray-200 dark:bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-slate-900 rounded-2xl"></div>
          ))}
        </div>
      </div>
    )
  }

  const healthScore = data?.composite_health_index ?? 100
  const healthTier = data?.health_tier || 'EXCELLENT'
  const sre = data?.sre_reliability || {}
  const tco = data?.financial_tco || {}
  const sec = data?.security_and_audit || {}
  const degradedList = data?.degraded_assets_radar || []

  // Dynamic colors based on health
  const getHealthTheme = (score) => {
    if (score >= 85) {
      return {
        text: 'text-emerald-500',
        bg: 'bg-emerald-500/10 border-emerald-500/30',
        stroke: '#10b981',
        label: 'EXCELLENT HEALTH'
      }
    }
    if (score >= 65) {
      return {
        text: 'text-amber-500',
        bg: 'bg-amber-500/10 border-amber-500/30',
        stroke: '#f59e0b',
        label: 'DEGRADED WARNING'
      }
    }
    return {
      text: 'text-rose-500',
      bg: 'bg-rose-500/10 border-rose-500/30',
      stroke: '#f43f5e',
      label: 'CRITICAL RISK'
    }
  }

  const healthTheme = getHealthTheme(healthScore)

  return (
    <section className="card !p-6 border border-gray-200 dark:border-slate-800 shadow-md mb-8 space-y-6 font-space animate-fade-in bg-gradient-to-b from-white to-gray-50/50 dark:from-slate-900 dark:to-slate-950">
      
      {/* Top Banner: Title & Live Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🛰️</span>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Executive Analytics & SRE Command Center
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Unified infrastructure health scoring, SRE reliability velocity, TCO financial intelligence, and security posture.
          </p>
        </div>

        {/* Live Auto-Refresh Controller */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 font-mono hidden sm:inline">
            Updated: {lastRefreshed.toLocaleTimeString()}
          </span>

          <select
            value={refreshInterval}
            onChange={e => setRefreshInterval(Number(e.target.value))}
            className="px-2.5 py-1.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-800 dark:text-slate-200 font-bold focus:outline-none cursor-pointer"
          >
            <option value={10}>Live 10s</option>
            <option value={30}>Live 30s</option>
            <option value={60}>Live 60s</option>
            <option value={0}>Paused</option>
          </select>

          <button
            type="button"
            onClick={() => fetchMetrics(true)}
            className="p-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            title="Refresh now"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Row 1: Composite Health Index + SRE Velocity + Financial TCO + Security Posture */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Composite Health Gauge */}
        <div className={`card !p-5 border rounded-2xl flex flex-col justify-between ${healthTheme.bg}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-gray-500 dark:text-slate-400 font-mono">
              Composite Health
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${healthTheme.bg} ${healthTheme.text}`}>
              {healthTheme.label}
            </span>
          </div>

          <div className="flex items-center justify-center my-3 relative">
            <div className="text-center">
              <span className={`text-5xl font-black font-mono tracking-tighter ${healthTheme.text}`}>
                {healthScore}
              </span>
              <span className="text-xs text-gray-400 font-mono block">/ 100 Index</span>
            </div>
          </div>

          <div className="text-[10px] text-gray-500 dark:text-slate-400 font-mono flex justify-between border-t border-gray-200/40 dark:border-slate-800/80 pt-2">
            <span>Critical CVEs: {sec.critical_cves || 0}</span>
            <span>Incidents: {sre.active_incidents || 0}</span>
          </div>
        </div>

        {/* Card 2: SRE Reliability & MTTR */}
        <div className="card !p-5 border border-gray-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-gray-500 dark:text-slate-400 font-mono">
              SRE Reliability (SLA)
            </span>
            <span className="text-base">⚡</span>
          </div>

          <div className="space-y-2.5 my-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">SLA Uptime:</span>
              <span className="text-sm font-bold font-mono text-emerald-500">{sre.sla_uptime_percent || 99.95}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">Mean Time to Resolve (MTTR):</span>
              <span className="text-xs font-bold font-mono text-gray-900 dark:text-white">{sre.mttr_minutes || 45.0}m</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">Mean Time to Detect (MTTD):</span>
              <span className="text-xs font-bold font-mono text-gray-900 dark:text-white">{sre.mttd_minutes || 8.5}m</span>
            </div>
          </div>

          <div className="text-[10px] text-emerald-500 font-mono border-t border-gray-100 dark:border-slate-800 pt-2 flex justify-between">
            <span>Error Budget: {sre.error_budget_remaining || 100}%</span>
            <span>Resolved: {sre.resolved_incidents || 0}</span>
          </div>
        </div>

        {/* Card 3: Financial TCO & License Waste */}
        <div className="card !p-5 border border-gray-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-gray-500 dark:text-slate-400 font-mono">
              TCO & License Burn
            </span>
            <span className="text-base">💰</span>
          </div>

          <div className="space-y-2.5 my-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">Asset Valuation:</span>
              <span className="text-sm font-bold font-mono text-cyan-600 dark:text-cyan-400">
                ${Number(tco.total_asset_valuation || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">Monthly Software Spend:</span>
              <span className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400">
                ${Number(tco.monthly_software_spend || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">Wasted Seats:</span>
              <span className="text-xs font-bold font-mono text-amber-500">
                ${Number(tco.wasted_unallocated_license_spend || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
              </span>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 font-mono border-t border-gray-100 dark:border-slate-800 pt-2">
            Annual Depreciation: ~${Number(tco.annual_depreciation_estimate || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        {/* Card 4: Security & Tamper-Proof Audit */}
        <div className="card !p-5 border border-gray-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-gray-500 dark:text-slate-400 font-mono">
              Security & Audit
            </span>
            <span className="text-base">🛡️</span>
          </div>

          <div className="space-y-2.5 my-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">Cryptographic Chain:</span>
              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${
                sec.audit_chain_valid
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
              }`}>
                {sec.audit_chain_valid ? '✓ Tamper-Proof' : '⚠️ Altered'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">Critical CVEs:</span>
              <span className="text-xs font-bold font-mono text-rose-500">{sec.critical_cves || 0} Open</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">High CVEs:</span>
              <span className="text-xs font-bold font-mono text-amber-500">{sec.high_cves || 0} Open</span>
            </div>
          </div>

          <div className="text-[10px] text-purple-500 dark:text-purple-400 font-mono border-t border-gray-100 dark:border-slate-800 pt-2 flex justify-between">
            <Link to="/audit-ledger" className="hover:underline">
              Ledger: {sec.audited_blocks_count || 0} Blocks →
            </Link>
          </div>
        </div>

      </div>

      {/* Row 2: Degraded Infrastructure & CMDB Blast Radius Radar */}
      {degradedList && degradedList.length > 0 && (
        <div className="card !p-4 border border-rose-500/30 dark:border-rose-900/30 bg-rose-500/5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 font-mono">
                Degraded Infrastructure & Blast Radius Radar ({degradedList.length} Nodes Impacted)
              </h4>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">
              Live Topology Traversal
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {degradedList.map(node => (
              <div
                key={node.id}
                onClick={() => navigate(`/assets/${node.id}`)}
                className="p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl hover:border-rose-500 transition-all cursor-pointer space-y-1.5 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[160px]">
                    {node.name}
                  </span>
                  <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded-md border ${
                    node.health_status === 'critical'
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                  }`}>
                    {node.health_status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400 font-mono pt-1">
                  <span>Type: {node.type}</span>
                  <span className="text-rose-500 font-bold">
                    💥 {node.connected_dependencies_count || 0} Blast Nodes
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </section>
  )
}
