import React, { useState, useEffect } from 'react'

export default function FinancialSummaryCard({ assetId, refreshKey }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showIncidents, setShowIncidents] = useState(false)

  useEffect(() => {
    if (assetId) {
      fetchFinancials()
    }
  }, [assetId, refreshKey])

  async function fetchFinancials() {
    try {
      setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`http://localhost:5000/api/assets/${assetId}/financials`, { headers })
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error('Failed to load asset financials:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card mb-6 !p-6 font-space animate-pulse">
        <div className="h-5 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="h-16 bg-slate-800/60 rounded-xl"></div>
          <div className="h-16 bg-slate-800/60 rounded-xl"></div>
          <div className="h-16 bg-slate-800/60 rounded-xl"></div>
          <div className="h-16 bg-slate-800/60 rounded-xl"></div>
        </div>
      </div>
    )
  }

  if (!data || !data.financials) return null

  const f = data.financials
  const healthVerdict = data.health_verdict || 'HEALTHY'
  const schedule = data.depreciation_schedule || []
  const incidents = data.maintenance_incidents || []

  const purchaseCost = parseFloat(f.purchase_cost) || 0
  const bookValue = parseFloat(f.current_book_value) || 0
  const accumDep = parseFloat(f.accumulated_depreciation) || 0
  const maintTotal = parseFloat(f.maintenance_cost_total) || 0
  const tco = parseFloat(f.total_cost_of_ownership) || 0

  const bookPercent = purchaseCost > 0 ? Math.max(0, Math.min(100, Math.round((bookValue / purchaseCost) * 100))) : 100

  const verdictBadge =
    healthVerdict === 'REPLACEMENT_RECOMMENDED'
      ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
      : healthVerdict === 'ELEVATED_MAINTENANCE'
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'

  return (
    <div className="card mb-6 !p-6 font-space border-l-4 border-l-emerald-500 bg-slate-900/90 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">💰</span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Financial Lifecycle & Total Cost of Ownership (TCO)
            </h3>
            <span className={`px-2.5 py-0.5 text-[11px] font-bold uppercase rounded-full border ${verdictBadge}`}>
              {healthVerdict.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Method: <strong className="text-purple-400 font-mono">{f.depreciation_method || 'straight_line'}</strong> • Useful Life: <strong className="text-slate-300">{f.useful_life_years || 5} yrs</strong> • Age: <strong className="text-cyan-400">{f.age_years || 0} yrs ({f.age_months || 0} mo)</strong>
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Purchase CapEx
          </span>
          <span className="text-lg font-bold text-white">
            ₹{purchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Initial capital cost
          </span>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
            Net Book Value
          </span>
          <span className="text-lg font-bold text-emerald-300">
            ₹{bookValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {bookPercent}% of original value
          </span>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
            Maintenance OpEx
          </span>
          <span className="text-lg font-bold text-amber-300">
            ₹{maintTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {incidents.length} repair incidents
          </span>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider block">
            Total TCO
          </span>
          <span className="text-lg font-bold text-purple-300">
            ₹{tco.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            CapEx + Repairs + Licenses
          </span>
        </div>
      </div>

      {/* Book Value Depreciation Progress Bar */}
      <div className="mb-5 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60">
        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
          <span className="text-slate-300">Asset Depreciation Status</span>
          <span className="text-slate-400">
            Accumulated: <strong className="text-rose-400">₹{accumDep.toLocaleString()}</strong> (Salvage: ₹{parseFloat(f.salvage_value || 0).toLocaleString()})
          </span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-2.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${bookPercent}%` }}
          ></div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
          <span>Remaining Value: {bookPercent}%</span>
          <span>Depreciated: {100 - bookPercent}%</span>
        </div>
      </div>

      {/* Accordion Controls */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={() => setShowSchedule(!showSchedule)}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <span>📊</span>
          <span>{showSchedule ? 'Hide' : 'View'} Depreciation Schedule</span>
        </button>

        {maintTotal > 0 && (
          <button
            type="button"
            onClick={() => setShowIncidents(!showIncidents)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>🔧</span>
            <span>{showIncidents ? 'Hide' : 'View'} Maintenance Costs ({incidents.length})</span>
          </button>
        )}
      </div>

      {/* Depreciation Schedule Table */}
      {showSchedule && schedule.length > 0 && (
        <div className="mt-4 overflow-x-auto bg-slate-950/80 rounded-xl border border-slate-800 p-3 animate-fade-in">
          <h4 className="text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
            {f.useful_life_years}-Year Depreciation Amortization Schedule
          </h4>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="pb-2 font-semibold">Period</th>
                <th className="pb-2 font-semibold">Year</th>
                <th className="pb-2 font-semibold text-right">Depreciation Expense</th>
                <th className="pb-2 font-semibold text-right">Accumulated Dep.</th>
                <th className="pb-2 font-semibold text-right">Ending Book Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {schedule.map(row => (
                <tr key={row.year_index} className="hover:bg-slate-900/50">
                  <td className="py-2 text-slate-400">Year {row.year_index}</td>
                  <td className="py-2 text-slate-300 font-sans">{row.calendar_year}</td>
                  <td className="py-2 text-right text-rose-400">
                    -₹{row.depreciation_expense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 text-right text-amber-400">
                    ₹{row.accumulated_depreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 text-right text-emerald-300 font-bold">
                    ₹{row.ending_book_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Maintenance Cost Breakdown */}
      {showIncidents && incidents.length > 0 && (
        <div className="mt-4 overflow-x-auto bg-slate-950/80 rounded-xl border border-slate-800 p-3 animate-fade-in">
          <h4 className="text-xs font-bold text-amber-300 mb-2 uppercase tracking-wider">
            Incident Repair & Maintenance History
          </h4>
          <div className="space-y-2">
            {incidents.map(inc => (
              <div
                key={inc.id}
                className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-lg border border-slate-800 text-xs"
              >
                <div>
                  <div className="font-semibold text-white">{inc.title}</div>
                  <div className="text-[10px] text-slate-400">
                    Severity: <strong className="text-slate-300">{inc.severity}</strong> • Status: <strong className="text-slate-300">{inc.status}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-amber-400">
                    ₹{parseFloat(inc.maintenance_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
