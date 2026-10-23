import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../config/api'

// excellent and good used to be emerald and teal — two greens nobody can tell
// apart in a 10px pill. Condition now maps onto the shared tone scale, and
// "missing" is separated from "damaged" by weight rather than by hue.
const CONDITION_TONE = {
  excellent: 'badge-success',
  good:      'badge-success',
  fair:      'badge-warning',
  damaged:   'badge-danger',
  missing:   'badge-danger',
}

const CameraIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

export default function PhysicalAuditHistory({ assetId, onOpenAuditModal, refreshKey, canAudit }) {
  const [audits, setAudits] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAudits = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE_URL}/assets/${assetId}/audits`, { headers })
      if (res.ok) {
        const json = await res.json()
        setAudits(json.audits || [])
      }
    } catch (err) {
      console.error('Failed to load asset audit history:', err)
    } finally {
      setLoading(false)
    }
  }, [assetId])

  useEffect(() => {
    if (assetId) {
      fetchAudits()
    }
  }, [assetId, refreshKey, fetchAudits])

  return (
    <div className="card audit-history">
      <div className="flex flex-col gap-3 mb-4 pb-3 sm:flex-row sm:items-start sm:justify-between"
           style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="icon-well"><CameraIcon /></span>
            <h3 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>
              Physical audit log
            </h3>
            <span className="badge-neutral tnum">
              {audits.length} {audits.length === 1 ? 'record' : 'records'}
            </span>
          </div>
          <p className="text-[12px] mt-1 m-0" style={{ color: 'var(--text-muted)' }}>
            Verified scans, condition inspections and location checks for this asset.
          </p>
        </div>

        {canAudit && (
          <button type="button" onClick={onOpenAuditModal} className="btn-primary btn-sm shrink-0 self-start">
            <PlusIcon />
            Log audit
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2.5">
          <div className="skeleton" style={{ height: 54, borderRadius: 11 }} />
          <div className="skeleton" style={{ height: 54, borderRadius: 11 }} />
        </div>
      ) : audits.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {audits.map(item => (
            <div key={item.id} className="audit-row">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`${CONDITION_TONE[item.physical_condition] || 'badge-neutral'} uppercase`}>
                    {item.physical_condition || 'unrecorded'}
                  </span>
                  {/* `.replace('_', ' ')` only ever swapped the first
                      underscore, so "qr_code_scan" stayed half snake_case. */}
                  <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    via {item.scan_method?.replace(/_/g, ' ') || 'manual entry'}
                  </span>
                  {!item.location_verified && (
                    <span className="badge-warning">
                      Moved to {item.observed_location || 'unknown location'}
                    </span>
                  )}
                </div>

                {item.notes && (
                  <p className="audit-note">{item.notes}</p>
                )}
              </div>

              <div className="shrink-0 sm:text-right">
                <div className="text-[12px] font-semibold" style={{ color: 'var(--text-soft)' }}>
                  {item.auditor?.full_name || item.auditor?.email || 'Field auditor'}
                </div>
                <div className="text-[10.5px] tnum" style={{ color: 'var(--text-faint)' }}>
                  {new Date(item.audited_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
          <div className="empty-state-title">No physical audits yet</div>
          <p className="empty-state-text">
            Scan the asset tag to record where it actually is and what condition it is in — the register is only
            trustworthy once someone has laid eyes on it.
          </p>
          {canAudit && (
            <button type="button" onClick={onOpenAuditModal} className="btn-primary btn-sm mt-3">
              <PlusIcon />
              Log first audit
            </button>
          )}
        </div>
      )}

      <style>{`
        .audit-history {
          margin-bottom: 24px;
          border-left: 3px solid var(--brand);
        }

        .icon-well {
          display: inline-flex; align-items: center; justify-content: center;
          width: 26px; height: 26px;
          border-radius: 8px;
          color: var(--brand);
          background: var(--brand-soft);
          border: 1px solid var(--brand-line);
        }

        .audit-row {
          display: flex; flex-direction: column; gap: 8px;
          padding: 10px 11px;
          border-radius: 11px;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
          transition: border-color var(--t-press) var(--ease-out);
        }
        @media (min-width: 640px) {
          .audit-row { flex-direction: row; align-items: center; justify-content: space-between; gap: 12px; }
        }
        @media (hover: hover) and (pointer: fine) {
          .audit-row:hover { border-color: var(--line-strong); }
        }

        /* Quotation marks were baked into the JSX, so an empty-but-present
           note rendered as a pair of floating quotes. The rail carries the
           "this is someone's words" signal instead. */
        .audit-note {
          margin: 6px 0 0;
          padding-left: 8px;
          font-size: 11.5px;
          font-style: italic;
          color: var(--text-soft);
          border-left: 2px solid var(--line-strong);
        }
      `}</style>
    </div>
  )
}
