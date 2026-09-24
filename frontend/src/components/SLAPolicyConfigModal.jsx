import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

const SEVERITY_TONE = {
  critical: 'badge-code badge-danger',
  high:     'badge-code badge-warning',
  medium:   'badge-code badge-warning',
  low:      'badge-code badge-info',
}

// Everything on this form is entered in minutes, which stops being readable
// somewhere around 240. The human form sits under the field as a check.
function humanMinutes(value) {
  const n = parseInt(value, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n < 60) return `${n} min`
  const hours = Math.floor(n / 60)
  const mins = n % 60
  if (hours < 24) return mins ? `${hours}h ${mins}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours ? `${days}d ${remHours}h` : `${days}d`
}

const EDITABLE = [
  'policy_name',
  'max_response_time_minutes',
  'max_resolution_time_minutes',
  'business_hours_only',
  'escalation_email',
]

const snapshot = (p) => JSON.stringify(EDITABLE.map(k => p?.[k] ?? null))

export default function SLAPolicyConfigModal({ isOpen, onClose, onPoliciesUpdated }) {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  // Per-policy snapshot of what the server last confirmed, so a row can tell
  // you whether it has unsaved edits. Every Save button used to be live all
  // the time, which gave no signal about what still needed saving.
  const [saved, setSaved] = useState({})

  useEffect(() => {
    if (isOpen) {
      fetchPolicies()
    }
  }, [isOpen])

  // Escape closes the dialog
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  async function fetchPolicies() {
    try {
      setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch('http://localhost:5000/api/sla/policies', { headers })
      if (res.ok) {
        const json = await res.json()
        const list = json.policies || []
        setPolicies(list)
        setSaved(Object.fromEntries(list.map(p => [p.id, snapshot(p)])))
      }
    } catch (err) {
      toast.error('Failed to load SLA policies')
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePolicy(policy) {
    try {
      setSavingId(policy.id)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }

      const res = await fetch(`http://localhost:5000/api/sla/policies/${policy.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          policy_name: policy.policy_name,
          max_response_time_minutes: parseInt(policy.max_response_time_minutes),
          max_resolution_time_minutes: parseInt(policy.max_resolution_time_minutes),
          business_hours_only: policy.business_hours_only,
          escalation_email: policy.escalation_email
        })
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update SLA policy')
      }

      toast.success(`${policy.severity.toUpperCase()} SLA policy updated!`)
      setSaved(prev => ({ ...prev, [policy.id]: snapshot(policy) }))
      onPoliciesUpdated && onPoliciesUpdated()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingId(null)
    }
  }

  function handleFieldChange(id, field, value) {
    setPolicies(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  if (!isOpen) return null

  const dirtyCount = policies.filter(p => saved[p.id] !== snapshot(p)).length

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal max-w-2xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="SLA policies"
      >
        <div className="modal-header">
          <div>
            <h3 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>SLA policies</h3>
            <p className="text-[12px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>
              Response and resolution targets per severity. Countdown timers and breach alerts follow these.
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="modal-body flex flex-col gap-3">
          {loading ? (
            <>
              <div className="skeleton" style={{ height: 148, borderRadius: 12 }} />
              <div className="skeleton" style={{ height: 148, borderRadius: 12 }} />
            </>
          ) : policies.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No SLA policies defined</div>
              <p className="empty-state-text">
                Policies are seeded per severity by the backend. If this list is empty, the SLA service has not been
                initialised yet.
              </p>
            </div>
          ) : (
            policies.map(policy => {
              const dirty = saved[policy.id] !== snapshot(policy)
              const busy = savingId === policy.id
              const responseMin = parseInt(policy.max_response_time_minutes, 10)
              const resolutionMin = parseInt(policy.max_resolution_time_minutes, 10)
              // A response target longer than the resolution target is
              // internally contradictory — the timer would breach acknowledgement
              // after the ticket was already meant to be closed.
              const inverted =
                Number.isFinite(responseMin) && Number.isFinite(resolutionMin) && responseMin > resolutionMin

              return (
                <div key={policy.id} className="policy-row" data-dirty={dirty}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={SEVERITY_TONE[policy.severity] || SEVERITY_TONE.low}>
                        {policy.severity}
                      </span>
                      {/* A bare transparent input read as static text. It now
                          carries a visible field treatment like every other input. */}
                      <input
                        type="text"
                        aria-label={`${policy.severity} policy name`}
                        value={policy.policy_name}
                        onChange={e => handleFieldChange(policy.id, 'policy_name', e.target.value)}
                        className="input-field !py-1 !text-[12px] !font-semibold"
                        style={{ maxWidth: 220 }}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      {dirty && !busy && <span className="badge-warning">Unsaved</span>}
                      <button
                        type="button"
                        disabled={busy || !dirty || inverted}
                        onClick={() => handleSavePolicy(policy)}
                        className="btn-primary btn-sm"
                      >
                        {busy && (
                          <span
                            className="animate-spin-fast w-3 h-3 rounded-full"
                            style={{ border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
                          />
                        )}
                        {busy ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor={`resp-${policy.id}`} className="field-label">Response target</label>
                      <input
                        id={`resp-${policy.id}`}
                        type="number"
                        min="1"
                        value={policy.max_response_time_minutes}
                        onChange={e => handleFieldChange(policy.id, 'max_response_time_minutes', e.target.value)}
                        className="input-field tnum !py-1.5"
                      />
                      <p className="hint">{humanMinutes(policy.max_response_time_minutes) || 'minutes'}</p>
                    </div>

                    <div>
                      <label htmlFor={`resol-${policy.id}`} className="field-label">Resolution target</label>
                      <input
                        id={`resol-${policy.id}`}
                        type="number"
                        min="1"
                        value={policy.max_resolution_time_minutes}
                        onChange={e => handleFieldChange(policy.id, 'max_resolution_time_minutes', e.target.value)}
                        className="input-field tnum !py-1.5"
                        data-invalid={inverted}
                      />
                      <p className="hint">{humanMinutes(policy.max_resolution_time_minutes) || 'minutes'}</p>
                    </div>

                    <div>
                      <label htmlFor={`esc-${policy.id}`} className="field-label">Escalation email</label>
                      <input
                        id={`esc-${policy.id}`}
                        type="email"
                        value={policy.escalation_email || ''}
                        onChange={e => handleFieldChange(policy.id, 'escalation_email', e.target.value)}
                        placeholder="oncall@domain.com"
                        className="input-field !py-1.5"
                        spellCheck="false"
                      />
                      <p className="hint">Notified on breach.</p>
                    </div>
                  </div>

                  {inverted && (
                    <p className="warn-line">
                      Resolution must be at least as long as response — a {humanMinutes(responseMin)} response target
                      cannot sit inside a {humanMinutes(resolutionMin)} resolution window.
                    </p>
                  )}

                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={policy.business_hours_only}
                      onChange={e => handleFieldChange(policy.id, 'business_hours_only', e.target.checked)}
                      className="cb"
                    />
                    <span>Business hours only — pause the timer overnight and at weekends</span>
                  </label>
                </div>
              )
            })
          )}
        </div>

        <div className="modal-footer">
          {dirtyCount > 0 && (
            <span className="text-[11.5px] mr-auto" style={{ color: 'var(--warn)' }}>
              {dirtyCount} polic{dirtyCount === 1 ? 'y has' : 'ies have'} unsaved changes
            </span>
          )}
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">Close</button>
        </div>

        <style>{`
          .policy-row {
            display: flex; flex-direction: column; gap: 11px;
            padding: 13px;
            border-radius: 12px;
            background: var(--surface-sunk);
            border: 1px solid var(--line);
            transition: border-color var(--t-press) var(--ease-out);
          }
          /* A dirty row gets a left rail so unsaved work is visible while
             scrolling a list of four policies. */
          .policy-row[data-dirty='true'] {
            border-color: var(--warn-line);
            box-shadow: inset 3px 0 0 var(--warn);
          }

          .hint {
            margin: 4px 0 0;
            font-size: 11px;
            color: var(--text-faint);
          }

          .warn-line {
            margin: 0;
            padding: 8px 10px;
            border-radius: 9px;
            font-size: 11.5px;
            color: var(--warn);
            background: var(--warn-soft);
            border: 1px solid var(--warn-line);
          }

          .input-field[data-invalid='true'] { border-color: var(--warn); }

          .check-row {
            display: flex; align-items: center; gap: 9px;
            font-size: 12px;
            cursor: pointer;
            color: var(--text-soft);
          }
          .cb { width: 14px; height: 14px; accent-color: var(--brand); cursor: pointer; flex-shrink: 0; }
        `}</style>
      </div>
    </div>
  )
}
