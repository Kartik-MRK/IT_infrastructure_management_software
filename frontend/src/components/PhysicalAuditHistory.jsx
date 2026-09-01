import React, { useState, useEffect } from 'react'

export default function PhysicalAuditHistory({ assetId, onOpenAuditModal, refreshKey, canAudit }) {
  const [audits, setAudits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (assetId) {
      fetchAudits()
    }
  }, [assetId, refreshKey])

  async function fetchAudits() {
    try {
      setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`http://localhost:5000/api/assets/${assetId}/audits`, { headers })
      if (res.ok) {
        const json = await res.json()
        setAudits(json.audits || [])
      }
    } catch (err) {
      console.error('Failed to load asset audit history:', err)
    } finally {
      setLoading(false)
    }
  }

  const conditionBadges = {
    excellent: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    good: 'bg-teal-500/20 text-teal-400 border-teal-500/40',
    fair: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    damaged: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    missing: 'bg-red-600/20 text-red-400 border-red-500/40'
  }

  return (
    <div className="card mb-6 !p-6 font-space border-l-4 border-l-cyan-500 bg-slate-900/90 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📷</span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Physical Inventory Audit Log
            </h3>
            <span className="px-2.5 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-full font-bold">
              {audits.length} {audits.length === 1 ? 'Audit' : 'Audits'} Recorded
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Historical verified physical scans, condition inspections, and location audits.
          </p>
        </div>

        {canAudit && (
          <button
            type="button"
            onClick={onOpenAuditModal}
            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all self-start sm:self-auto cursor-pointer"
          >
            <span>+</span> Log Physical Audit
          </button>
        )}
      </div>

      {/* Audit History Timeline */}
      {loading ? (
        <div className="space-y-3 py-2 animate-pulse">
          <div className="h-12 bg-slate-800/60 rounded-xl"></div>
          <div className="h-12 bg-slate-800/60 rounded-xl"></div>
        </div>
      ) : audits.length > 0 ? (
        <div className="space-y-3">
          {audits.map(item => (
            <div
              key={item.id}
              className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${conditionBadges[item.physical_condition] || conditionBadges.good}`}>
                    {item.physical_condition}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    via {item.scan_method?.replace('_', ' ')}
                  </span>
                  {!item.location_verified && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded">
                      Location Changed: {item.observed_location}
                    </span>
                  )}
                </div>

                {item.notes && (
                  <p className="text-slate-300 italic text-[11px] mt-0.5">
                    "{item.notes}"
                  </p>
                )}
              </div>

              <div className="text-right shrink-0">
                <div className="text-slate-300 font-medium">
                  {item.auditor?.full_name || item.auditor?.email || 'Field Auditor'}
                </div>
                <div className="text-[10px] text-slate-500">
                  {new Date(item.audited_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 border border-dashed border-slate-700/60 rounded-xl bg-slate-900/30">
          <span className="text-3xl">📦</span>
          <p className="text-sm font-semibold text-slate-300 mt-2">No Physical Audits Logged Yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Perform a verified barcode or QR code physical scan to record this asset's location and condition.
          </p>
          {canAudit && (
            <button
              type="button"
              onClick={onOpenAuditModal}
              className="mt-3 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>+</span> Log Initial Physical Audit
            </button>
          )}
        </div>
      )}
    </div>
  )
}
