import React, { useState } from 'react'
import toast from 'react-hot-toast'

const COMPLIANCE_META = {
  EXPIRED:            { label: 'Expired',         tone: 'badge-danger',  bar: 'var(--danger)'  },
  OVER_ALLOCATED:     { label: 'Over-allocated',  tone: 'badge-danger',  bar: 'var(--danger)'  },
  WARNING_90_PERCENT: { label: 'Near capacity',   tone: 'badge-warning', bar: 'var(--warn)'    },
  COMPLIANT:          { label: 'Compliant',       tone: 'badge-success', bar: 'var(--ok)'      },
}

const Caret = ({ open }) => (
  <svg
    className="caret" data-open={open}
    width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

export default function LicenseCard({ license, onAllocateClick, onReclaimSuccess, canEdit }) {
  const [showKey, setShowKey] = useState(false)
  const [showAllocations, setShowAllocations] = useState(true)
  const [reclaimingId, setReclaimingId] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)

  const total = license.total_seats || 0
  const allocated = license.allocated_seats || 0
  const available = license.available_seats || 0
  const utilization = license.utilization_percent || 0
  const compliance = license.compliance_status || 'COMPLIANT'

  async function handleReclaim(allocId) {
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
      setConfirmingId(null)
    }
  }

  // `.replace('_', ' ')` only swapped the first underscore, so
  // WARNING_90_PERCENT rendered as "WARNING 90_PERCENT". Human labels now
  // come from a map instead of being derived from the enum at all.
  const meta = COMPLIANCE_META[compliance] || {
    label: compliance.replace(/_/g, ' ').toLowerCase(),
    tone: 'badge-neutral',
    bar: 'var(--neutral)',
  }

  const expired = license.days_until_expiration < 0

  return (
    <div className="card lic-card">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between"
           style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>
              {license.license_name}
            </h4>
            <span className={meta.tone}>{meta.label}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] mt-1.5"
               style={{ color: 'var(--text-muted)' }}>
            <span>{license.vendor || 'Unknown vendor'}</span>
            <span aria-hidden="true">·</span>
            <span className="badge-code badge-neutral">{license.license_type}</span>
            {license.cost_per_seat > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tnum">₹{parseFloat(license.cost_per_seat).toLocaleString('en-IN')}/seat</span>
              </>
            )}
          </div>
        </div>

        {canEdit && (
          <button onClick={() => onAllocateClick(license)} className="btn-primary btn-sm shrink-0 self-start">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Assign seat
          </button>
        )}
      </div>

      {/* ── Seat utilisation ───────────────────────────────────── */}
      <div className="py-3.5">
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-faint)' }}>
            Seat utilisation
          </span>
          <span className="tnum text-[12px] font-semibold" style={{ color: 'var(--text)' }}>
            {allocated} / {total} · {utilization}%
          </span>
        </div>

        <div className="meter-track">
          <div className="meter-fill" style={{ width: `${Math.min(100, utilization)}%`, background: meta.bar }} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] mt-1.5"
             style={{ color: 'var(--text-muted)' }}>
          <span className="tnum">{available} available</span>
          {license.expiration_date ? (
            <span style={expired ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>
              {expired
                ? `Expired ${license.expiration_date}`
                : `Renews in ${license.days_until_expiration}d · ${license.expiration_date}`}
            </span>
          ) : (
            <span>Perpetual</span>
          )}
        </div>
      </div>

      {/* ── Key ────────────────────────────────────────────────── */}
      {license.license_key && (
        <div className="key-row">
          <code className="key-value">
            {showKey ? license.license_key : '•••••-•••••-•••••-•••••'}
          </code>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setShowKey(!showKey)} className="btn-ghost btn-sm">
              {showKey ? 'Hide' : 'Reveal'}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(license.license_key)
                toast.success('License key copied')
              }}
              className="btn-ghost btn-sm"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* ── Allocations ────────────────────────────────────────── */}
      <div className="pt-3" style={{ borderTop: '1px solid var(--line)' }}>
        <button
          onClick={() => setShowAllocations(!showAllocations)}
          className="disclosure"
          aria-expanded={showAllocations}
        >
          <span>Assigned devices &amp; people ({license.allocations?.length || 0})</span>
          <Caret open={showAllocations} />
        </button>

        {showAllocations && (
          <div className="flex flex-col gap-2 mt-2.5">
            {license.allocations && license.allocations.length > 0 ? (
              license.allocations.map(alloc => {
                const confirming = confirmingId === alloc.id
                const busy = reclaimingId === alloc.id
                return (
                  <div key={alloc.id} className="alloc-row">
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                        {alloc.asset?.name || alloc.user?.full_name || alloc.user?.email || 'Dedicated seat'}
                      </div>
                      {(alloc.asset?.location || alloc.notes) && (
                        <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {[alloc.asset?.location, alloc.notes].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>

                    {canEdit && (
                      /* Two-step inline confirm instead of window.confirm —
                         the native dialog blocks the whole page and loses
                         the context of which seat you were reclaiming. */
                      <div className="flex items-center gap-1 shrink-0">
                        {confirming ? (
                          <>
                            <button
                              onClick={() => handleReclaim(alloc.id)}
                              disabled={busy}
                              className="btn-danger btn-sm"
                            >
                              {busy ? 'Reclaiming…' : 'Confirm'}
                            </button>
                            <button onClick={() => setConfirmingId(null)} className="btn-ghost btn-sm">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmingId(alloc.id)}
                            className="btn-danger-soft btn-sm"
                            title="Reclaim this seat"
                          >
                            Reclaim
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <p className="text-[11.5px] m-0 py-1" style={{ color: 'var(--text-muted)' }}>
                No seats assigned yet. Use <strong style={{ color: 'var(--text-soft)' }}>Assign seat</strong> to link this
                license to a device or a person.
              </p>
            )}
          </div>
        )}
      </div>

      <style>{`
        .lic-card { display: flex; flex-direction: column; }

        .meter-track {
          height: 7px;
          border-radius: 999px;
          overflow: hidden;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
        }
        /* Width animates because it changes only when data arrives, never
           while the user is interacting with this card. */
        .meter-fill {
          height: 100%;
          border-radius: 999px;
          transition: width var(--t-panel) var(--ease-out);
        }

        .key-row {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          padding: 6px 6px 6px 10px;
          margin-bottom: 12px;
          border-radius: 10px;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
        }
        .key-value {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 11.5px;
          color: var(--text-soft);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          min-width: 0;
        }

        .disclosure {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%;
          font-size: 12px; font-weight: 700;
          cursor: pointer;
          color: var(--text-soft);
          background: none; border: none; padding: 0;
          transition: color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .disclosure:hover { color: var(--text); }
        }
        .disclosure .caret {
          transition: transform var(--t-pop) var(--ease-out);
        }
        .disclosure .caret[data-open='true'] { transform: rotate(180deg); }

        .alloc-row {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 8px 9px;
          border-radius: 10px;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
          transition: border-color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .alloc-row:hover { border-color: var(--line-strong); }
        }

        @media (prefers-reduced-motion: reduce) {
          .meter-fill { transition: none; }
        }
      `}</style>
    </div>
  )
}
