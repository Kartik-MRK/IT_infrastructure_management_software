import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { API_BASE_URL } from '../config/api'

const MonitorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
  </svg>
)

const PersonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
)

export default function AllocateSeatModal({ isOpen, onClose, license, onSeatAllocated }) {
  const [hardwareAssets, setHardwareAssets] = useState([])
  const [users, setUsers] = useState([])
  const [targetType, setTargetType] = useState('asset') // 'asset' | 'user'
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchTargets()
    }
  }, [isOpen])

  // Escape closes the dialog
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  async function fetchTargets() {
    try {
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const [assetsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/assets`, { headers }),
        fetch(`${API_BASE_URL}/users`, { headers }).catch(() => ({ ok: false }))
      ])

      if (assetsRes.ok) {
        const data = await assetsRes.json()
        const hw = (data.assets || []).filter(a => a.type === 'hardware' || a.type === 'infrastructure')
        setHardwareAssets(hw)
        if (hw.length > 0) setSelectedAssetId(hw[0].id)
      }

      if (usersRes.ok) {
        const udata = await usersRes.json()
        setUsers(udata.users || [])
        if (udata.users?.length > 0) setSelectedUserId(udata.users[0].id)
      }
    } catch (err) {
      console.error('Failed to load allocation targets:', err)
    }
  }

  if (!isOpen) return null

  async function handleSubmit(e) {
    e.preventDefault()
    if (targetType === 'asset' && !selectedAssetId) {
      toast.error('Please select a hardware workstation or server')
      return
    }
    if (targetType === 'user' && !selectedUserId) {
      toast.error('Please select an employee')
      return
    }

    try {
      setSubmitting(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }

      const payload = {
        allocated_to_asset_id: targetType === 'asset' ? selectedAssetId : null,
        allocated_to_user_id: targetType === 'user' ? selectedUserId : null,
        notes: notes.trim() || null
      }

      const res = await fetch(`${API_BASE_URL}/licenses/${license.id}/allocate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to allocate seat')
      }

      toast.success('License seat successfully allocated!')
      onSeatAllocated && onSeatAllocated()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const total = license?.total_seats || 0
  const allocated = license?.allocated_seats || 0
  const available = license?.available_seats ?? Math.max(0, total - allocated)
  const noSeatsLeft = total > 0 && available <= 0

  // The old modal disabled submit only when the asset list was empty, so
  // switching to Employee with no users loaded left an enabled button that
  // posted a null target.
  const targetList = targetType === 'asset' ? hardwareAssets : users
  const noTargets = targetList.length === 0

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal max-w-lg"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Allocate license seat"
      >
        <div className="modal-header">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>Allocate a seat</h3>
            <p className="text-[12px] mt-0.5 m-0 truncate" style={{ color: 'var(--text-muted)' }}>
              {license?.license_name}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body flex flex-col gap-4">

            {/* Seat budget belongs at the top of this dialog — it is the one
                number that decides whether this allocation is even compliant. */}
            <div className="seat-meter" data-full={noSeatsLeft}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-faint)' }}>
                  Seats
                </span>
                <span className="tnum text-[12px] font-semibold" style={{ color: 'var(--text)' }}>
                  {allocated} / {total || '∞'} assigned
                </span>
              </div>
              <div className="meter-track">
                <div
                  className="meter-fill"
                  style={{ width: total > 0 ? `${Math.min(100, (allocated / total) * 100)}%` : '0%' }}
                />
              </div>
              <p className="text-[11.5px] m-0" style={{ color: noSeatsLeft ? 'var(--danger)' : 'var(--text-muted)' }}>
                {total === 0
                  ? 'Unlimited seats on this agreement.'
                  : noSeatsLeft
                    ? 'No seats left — assigning another puts this license over-allocated.'
                    : `${available} seat${available === 1 ? '' : 's'} available.`}
              </p>
            </div>

            <div>
              <label className="field-label">Assign to</label>
              <div className="segmented">
                <button
                  type="button"
                  onClick={() => setTargetType('asset')}
                  className="segmented-item"
                  data-active={targetType === 'asset'}
                  aria-pressed={targetType === 'asset'}
                >
                  <MonitorIcon />
                  Device
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('user')}
                  className="segmented-item"
                  data-active={targetType === 'user'}
                  aria-pressed={targetType === 'user'}
                >
                  <PersonIcon />
                  Person
                </button>
              </div>
            </div>

            {targetType === 'asset' && (
              <div>
                <label htmlFor="alloc_asset" className="field-label">Hardware device or server</label>
                {hardwareAssets.length === 0 ? (
                  <p className="empty-note">
                    No hardware or infrastructure assets are registered yet — register one before assigning a seat to it.
                  </p>
                ) : (
                  <select
                    id="alloc_asset"
                    value={selectedAssetId}
                    onChange={e => setSelectedAssetId(e.target.value)}
                    className="input-field"
                  >
                    {hardwareAssets.map(hw => (
                      <option key={hw.id} value={hw.id}>
                        {hw.name} — {hw.location || 'No location'} · {hw.status}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {targetType === 'user' && (
              <div>
                <label htmlFor="alloc_user" className="field-label">Employee</label>
                {users.length === 0 ? (
                  <p className="empty-note">
                    The user directory could not be loaded. Assign this seat to a device instead, or retry once the API is reachable.
                  </p>
                ) : (
                  <select
                    id="alloc_user"
                    value={selectedUserId}
                    onChange={e => setSelectedUserId(e.target.value)}
                    className="input-field"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email} — {u.role || 'viewer'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label htmlFor="alloc_notes" className="field-label">Assignment note (optional)</label>
              <input
                id="alloc_notes"
                type="text"
                placeholder="e.g. Primary CAD workstation for the design team…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="input-field"
              />
            </div>

          </div>

          <div className="modal-footer">
            {noSeatsLeft && !noTargets && (
              <span className="badge-warning mr-auto">Over-allocation</span>
            )}
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
            <button type="submit" disabled={submitting || noTargets} className="btn-primary btn-sm">
              {submitting && (
                <span
                  className="animate-spin-fast w-3 h-3 rounded-full"
                  style={{ border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
                />
              )}
              {submitting ? 'Assigning…' : 'Assign seat'}
            </button>
          </div>
        </form>

        <style>{`
          .seat-meter {
            display: flex; flex-direction: column; gap: 7px;
            padding: 11px 12px;
            border-radius: 11px;
            background: var(--surface-sunk);
            border: 1px solid var(--line);
          }
          .seat-meter[data-full='true'] {
            background: var(--danger-soft);
            border-color: var(--danger-line);
          }

          .meter-track {
            height: 6px;
            border-radius: 999px;
            overflow: hidden;
            background: var(--line);
          }
          /* Width is the one non-transform property worth animating here: it
             changes once, on data arrival, never during interaction. */
          .meter-fill {
            height: 100%;
            border-radius: 999px;
            background: var(--brand);
            transition: width var(--t-panel) var(--ease-out);
          }
          .seat-meter[data-full='true'] .meter-fill { background: var(--danger); }

          .empty-note {
            margin: 0;
            padding: 10px 12px;
            border-radius: 10px;
            font-size: 12px;
            color: var(--text-muted);
            background: var(--surface-sunk);
            border: 1px solid var(--line);
          }

          @media (prefers-reduced-motion: reduce) {
            .meter-fill { transition: none; }
          }
        `}</style>
      </div>
    </div>
  )
}
