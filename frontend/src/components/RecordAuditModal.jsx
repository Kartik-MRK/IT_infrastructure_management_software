import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { API_BASE_URL } from '../config/api'

const CONDITIONS = [
  { id: 'excellent', label: 'Excellent — like new'        },
  { id: 'good',      label: 'Good — minor wear'           },
  { id: 'fair',      label: 'Fair — cosmetic flaws'       },
  { id: 'damaged',   label: 'Damaged — needs repair'      },
  { id: 'missing',   label: 'Missing — unaccounted for'   },
]

const SCAN_METHODS = [
  { id: 'camera_qr',    label: 'Camera QR scan'   },
  { id: 'barcode_128',  label: 'Laser 1D barcode' },
  { id: 'manual',       label: 'Manual inspection'},
  { id: 'nfc',          label: 'NFC tap'          },
]

const OBSERVED_STATUSES = [
  { id: 'active',          label: 'Active / in production' },
  { id: 'maintenance',     label: 'Under maintenance'      },
  { id: 'inactive',        label: 'Inactive / in storage'  },
  { id: 'decommissioned',  label: 'Decommissioned'         },
]

export default function RecordAuditModal({ isOpen, onClose, asset, onAuditRecorded }) {
  const [formData, setFormData] = useState({
    location_verified: true,
    observed_location: '',
    status_verified: true,
    observed_status: '',
    physical_condition: 'good',
    scan_method: 'camera_qr',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)

  // Escape closes the dialog
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen || !asset) return null

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      setSubmitting(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }

      const payload = {
        location_verified: formData.location_verified,
        observed_location: formData.location_verified ? asset.location : (formData.observed_location || asset.location),
        status_verified: formData.status_verified,
        observed_status: formData.status_verified ? asset.status : (formData.observed_status || asset.status),
        physical_condition: formData.physical_condition,
        scan_method: formData.scan_method,
        notes: formData.notes.trim() || null
      }

      const res = await fetch(`${API_BASE_URL}/assets/${asset.id}/audits`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to record physical audit')
      }

      toast.success('Physical audit logged successfully!')
      onAuditRecorded && onAuditRecorded()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const discrepancies = (formData.location_verified ? 0 : 1) + (formData.status_verified ? 0 : 1)

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal max-w-lg"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Record physical audit"
      >
        <div className="modal-header">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>Record physical audit</h3>
            <p className="text-[12px] mt-0.5 m-0 truncate" style={{ color: 'var(--text-muted)' }}>{asset.name}</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body flex flex-col gap-4">

            {/* What the record claims — the thing you are checking against */}
            <div className="grid grid-cols-2 gap-2">
              <div className="ref-tile">
                <span className="ref-label">On record — location</span>
                <span className="ref-value">{asset.location || 'Not set'}</span>
              </div>
              <div className="ref-tile">
                <span className="ref-label">On record — status</span>
                <span className="ref-value uppercase">{asset.status || '—'}</span>
              </div>
            </div>

            {/* Verification checks. Unchecking one opens the field that
                explains what you actually found. */}
            <div className="flex flex-col gap-2">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={formData.location_verified}
                  onChange={e => setFormData({ ...formData, location_verified: e.target.checked })}
                  className="cb"
                />
                <span>Location matches the record</span>
              </label>

              {!formData.location_verified && (
                <div className="discrepancy">
                  <label htmlFor="observed_location" className="field-label !mb-1">Where did you find it?</label>
                  <input
                    id="observed_location"
                    type="text"
                    required
                    placeholder="e.g. Floor 3 — Lab A"
                    value={formData.observed_location}
                    onChange={e => setFormData({ ...formData, observed_location: e.target.value })}
                    className="input-field"
                  />
                </div>
              )}

              <label className="check-row">
                <input
                  type="checkbox"
                  checked={formData.status_verified}
                  onChange={e => setFormData({ ...formData, status_verified: e.target.checked })}
                  className="cb"
                />
                <span>Operational state matches the record</span>
              </label>

              {!formData.status_verified && (
                <div className="discrepancy">
                  <label htmlFor="observed_status" className="field-label !mb-1">What state is it actually in?</label>
                  {/* An empty placeholder that fails validation, because the
                      old select silently defaulted to the registered status —
                      logging "no discrepancy" on a flagged discrepancy. */}
                  <select
                    id="observed_status"
                    required
                    value={formData.observed_status}
                    onChange={e => setFormData({ ...formData, observed_status: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select observed state…</option>
                    {OBSERVED_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="physical_condition" className="field-label">Hardware condition</label>
                <select
                  id="physical_condition"
                  value={formData.physical_condition}
                  onChange={e => setFormData({ ...formData, physical_condition: e.target.value })}
                  className="input-field"
                >
                  {CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="scan_method" className="field-label">Verification method</label>
                <select
                  id="scan_method"
                  value={formData.scan_method}
                  onChange={e => setFormData({ ...formData, scan_method: e.target.value })}
                  className="input-field"
                >
                  {SCAN_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="audit_notes" className="field-label">Inspection notes (optional)</label>
              <textarea
                id="audit_notes"
                rows="2"
                placeholder="e.g. Serial tag verified. Cleaned fan filters. Found in Server Room Rack 2…"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="input-field"
              />
            </div>

          </div>

          <div className="modal-footer">
            {discrepancies > 0 && (
              <span className="badge-warning mr-auto">
                {discrepancies} discrepanc{discrepancies === 1 ? 'y' : 'ies'} flagged
              </span>
            )}
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-success btn-sm">
              {submitting && (
                <span
                  className="animate-spin-fast w-3 h-3 rounded-full"
                  style={{ border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
                />
              )}
              {submitting ? 'Recording…' : 'Submit audit'}
            </button>
          </div>
        </form>

        <style>{`
          .ref-tile {
            display: flex; flex-direction: column; gap: 2px;
            padding: 9px 11px;
            border-radius: 10px;
            background: var(--surface-sunk);
            border: 1px solid var(--line);
            min-width: 0;
          }
          .ref-label {
            font-size: 10px; font-weight: 600; letter-spacing: 0.06em;
            text-transform: uppercase; color: var(--text-faint);
          }
          .ref-value {
            font-size: 12.5px; font-weight: 600; color: var(--text);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }

          .check-row {
            display: flex; align-items: center; gap: 9px;
            padding: 9px 11px;
            border-radius: 10px;
            font-size: 12.5px; font-weight: 500;
            cursor: pointer;
            color: var(--text);
            background: var(--surface-sunk);
            border: 1px solid var(--line);
            transition: border-color var(--t-press) var(--ease-out);
          }
          @media (hover: hover) and (pointer: fine) {
            .check-row:hover { border-color: var(--line-strong); }
          }
          .cb { width: 14px; height: 14px; accent-color: var(--brand); cursor: pointer; flex-shrink: 0; }

          /* A flagged discrepancy is the whole point of an audit, so it gets
             an amber rail rather than blending into the form. */
          .discrepancy {
            padding: 10px 12px;
            margin-left: 11px;
            border-radius: 10px;
            background: var(--warn-soft);
            border: 1px solid var(--warn-line);
            border-left: 3px solid var(--warn);
            opacity: 1;
            transform: translateY(0);
            transition:
              opacity var(--t-pop) var(--ease-out),
              transform var(--t-pop) var(--ease-out);
          }
          @starting-style {
            .discrepancy { opacity: 0; transform: translateY(-4px); }
          }
        `}</style>
      </div>
    </div>
  )
}
