import React, { useState, useEffect } from 'react'

export default function ExecutiveFinancialWidget() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExecutiveSummary()
  }, [])

  async function fetchExecutiveSummary() {
    try {
      setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch('http://localhost:5000/api/financials/executive-summary', { headers })
      if (res.ok) {
        const json = await res.json()
        setSummary(json)
      }
    } catch (err) {
      console.error('Failed to load executive financial summary:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card !p-6 font-space mb-6 animate-pulse bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="h-5 bg-slate-800 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-20 bg-slate-800/60 rounded-xl"></div>
          <div className="h-20 bg-slate-800/60 rounded-xl"></div>
          <div className="h-20 bg-slate-800/60 rounded-xl"></div>
          <div className="h-20 bg-slate-800/60 rounded-xl"></div>
        </div>
      </div>
    )
  }

  if (!summary || !summary.overview) return null

  const ov = summary.overview
  const byType = summary.by_type || {}

  const capex = parseFloat(ov.total_capitalized_investment) || 0
  const bookVal = parseFloat(ov.total_current_book_value) || 0
  const depPercent = parseFloat(ov.overall_depreciation_percent) || 0
  const maintOpex = parseFloat(ov.total_maintenance_expenditure) || 0
  const tco = parseFloat(ov.total_infrastructure_tco) || 0
  const assetCount = ov.total_assets_tracked || 0

  return (
    <div className="card !p-6 font-space mb-6 border-l-4 border-l-emerald-500 bg-slate-900 shadow-xl rounded-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏛️</span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Executive Financial & TCO Command Center
            </h3>
            <span className="px-2.5 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full font-bold">
              {assetCount} Capital Assets
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time balance sheet valuation, accumulated depreciation, maintenance OpEx, and Total Cost of Ownership.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Capitalized Asset Value
          </span>
          <span className="text-xl font-bold text-white">
            ₹{capex.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Initial procurement CapEx
          </span>
        </div>

        <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
            Net Book Value
          </span>
          <span className="text-xl font-bold text-emerald-300">
            ₹{bookVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Current depreciated balance
          </span>
        </div>

        <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
            Maintenance OpEx
          </span>
          <span className="text-xl font-bold text-amber-300">
            ₹{maintOpex.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Total incident repair spend
          </span>
        </div>

        <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider block">
            Total Infrastructure TCO
          </span>
          <span className="text-xl font-bold text-purple-300">
            ₹{tco.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            CapEx + Repairs + Software
          </span>
        </div>
      </div>

      {/* Depreciation Progress Meter */}
      <div className="p-3.5 bg-slate-950/50 rounded-xl border border-slate-800/80 mb-4">
        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
          <span className="text-slate-300">Portfolio Capital Depreciation Ratio</span>
          <span className="text-slate-400">
            Depreciated: <strong className="text-rose-400">{depPercent}%</strong> • Retained Value: <strong className="text-emerald-400">{(100 - depPercent).toFixed(2)}%</strong>
          </span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-2.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(5, 100 - depPercent)}%` }}
          ></div>
        </div>
      </div>

      {/* Breakdown by Asset Type */}
      {Object.keys(byType).length > 0 && (
        <div className="pt-3 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
            Capital Allocation by Infrastructure Category
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {Object.entries(byType).map(([type, stats]) => (
              <div
                key={type}
                className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60 text-xs"
              >
                <div className="font-bold text-white capitalize">{type}</div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  ₹{parseFloat(stats.total_cost || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {stats.asset_count} {stats.asset_count === 1 ? 'asset' : 'assets'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
