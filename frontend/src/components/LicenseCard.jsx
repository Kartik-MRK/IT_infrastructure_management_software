import React, { useState } from 'react'
import toast from 'react-hot-toast'

export default function LicenseCard({ license, onAllocateClick, onReclaimSuccess, canEdit }) {
  const [showKey, setShowKey] = useState(false)
  const [showAllocations, setShowAllocations] = useState(true)
  const [reclaimingId, setReclaimingId] = useState(null)

  const total = license.total_seats || 0
  const allocated = license.allocated_seats || 0
  const available = license.available_seats || 0
  const utilization = license.utilization_percent || 0
  const compliance = license.compliance_status || 'COMPLIANT'

  async function handleReclaim(allocId) {
    if (!window.confirm('Are you sure you want to reclaim this license seat?')) return
    try {
      setReclaimingId(allocId)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`http://localhost:5000/api/licenses/allocations/${allocId}`, {
        method: 'DELETE',
        headers
      })
      if (res.ok) {
        toast.success('License seat reclaimed')
        onReclaimSuccess && onReclaimSuccess()
      } else {
        toast.error('Failed to reclaim seat')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setReclaimingId(null)
    }
  }

  // Progress bar color based on utilization
  const progressBarColor =
    compliance === 'EXPIRED' ? 'bg-red-600' :
    compliance === 'OVER_ALLOCATED' ? 'bg-rose-600' :
    compliance === 'WARNING_90_PERCENT' ? 'bg-amber-500' :
    'bg-emerald-500'

  const statusBadge =
    compliance === 'EXPIRED' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
    compliance === 'OVER_ALLOCATED' ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse' :
    compliance === 'WARNING_90_PERCENT' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' :
    'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl font-space transition-all hover:border-slate-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📜</span>
            <h4 className="text-base font-bold text-white tracking-tight">
              {license.license_name}
            </h4>
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${statusBadge}`}>
              {compliance.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Vendor: <strong className="text-slate-300">{license.vendor || 'N/A'}</strong></span>
            <span>•</span>
            <span>Type: <strong className="text-purple-400 font-mono">{license.license_type}</strong></span>
            {license.cost_per_seat > 0 && (
              <>
                <span>•</span>
                <span>₹{parseFloat(license.cost_per_seat).toLocaleString()}/seat</span>
              </>
            )}
          </div>
        </div>

        {canEdit && (
          <button
            onClick={() => onAllocateClick(license)}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all self-start sm:self-auto cursor-pointer"
          >
            <span>+</span> Assign Seat
          </button>
        )}
      </div>

      {/* Seat Utilization Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5 font-semibold">
          <span className="text-slate-400">Seat Utilization ({allocated} / {total} Assigned)</span>
          <span className={compliance === 'OVER_ALLOCATED' ? 'text-rose-400' : 'text-slate-300'}>
            {utilization}%
          </span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${progressBarColor}`}
            style={{ width: `${Math.min(100, utilization)}%` }}
          ></div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
          <span>{available} Seats Available</span>
          {license.expiration_date ? (
            <span>
              {license.days_until_expiration < 0
                ? <strong className="text-red-400">Expired on {license.expiration_date}</strong>
                : <span>Expires in <strong className="text-cyan-400">{license.days_until_expiration} days</strong> ({license.expiration_date})</span>}
            </span>
          ) : (
            <span className="text-emerald-400">Perpetual License</span>
          )}
        </div>
      </div>

      {/* License Key Preview */}
      {license.license_key && (
        <div className="flex items-center justify-between bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800 text-xs mb-4">
          <span className="text-slate-400 font-mono text-[11px]">
            Key: {showKey ? license.license_key : '•••••-•••••-•••••-•••••'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKey(!showKey)}
              className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
            >
              {showKey ? 'Hide' : 'Reveal'}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(license.license_key)
                toast.success('License key copied!')
              }}
              className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Allocated Seats List */}
      <div className="pt-2 border-t border-slate-800/80">
        <button
          onClick={() => setShowAllocations(!showAllocations)}
          className="flex items-center justify-between w-full text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          <span>Assigned Hardware & Users ({license.allocations?.length || 0})</span>
          <span>{showAllocations ? '▲' : '▼'}</span>
        </button>

        {showAllocations && (
          <div className="mt-3 space-y-2">
            {license.allocations && license.allocations.length > 0 ? (
              license.allocations.map(alloc => (
                <div
                  key={alloc.id}
                  className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-xl border border-slate-800 text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">
                      {alloc.asset?.name || alloc.user?.full_name || alloc.user?.email || 'Dedicated Seat'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {alloc.asset?.location ? `Location: ${alloc.asset.location}` : ''}
                      {alloc.notes ? ` • Note: ${alloc.notes}` : ''}
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => handleReclaim(alloc.id)}
                      disabled={reclaimingId === alloc.id}
                      className="text-rose-400 hover:text-rose-300 text-[11px] px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
                      title="Reclaim seat"
                    >
                      {reclaimingId === alloc.id ? 'Reclaiming...' : 'Reclaim Seat'}
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-[11px] text-slate-500 italic py-1">
                No active seat allocations yet. Click "+ Assign Seat" to associate this license with a computer or employee.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
