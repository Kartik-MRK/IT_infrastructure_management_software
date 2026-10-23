import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { API_BASE_URL } from '../config/api'

// The explanation used to live inside the <option> label, where it was
// truncated by every native select on every platform. It belongs under the
// field, describing only the choice you actually made.
const REL_TYPES = [
  { id: 'hosts',       label: 'hosts',       hint: 'The parent physically or logically runs the child.' },
  { id: 'connects_to', label: 'connects_to', hint: 'A network link or physical port between the two.'   },
  { id: 'depends_on',  label: 'depends_on',  hint: 'An architectural service dependency.'              },
  { id: 'backs_up',    label: 'backs_up',    hint: 'Backup or failover redundancy.'                    },
]

const Arrow = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
)

export default function AddRelationshipModal({ isOpen, onClose, currentAsset, onRelationshipAdded }) {
  const [allAssets, setAllAssets] = useState([])
  const [targetAssetId, setTargetAssetId] = useState('')
  const [relationshipType, setRelationshipType] = useState('depends_on')
  const [direction, setDirection] = useState('outgoing') // outgoing (this -> target) or incoming (target -> this)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchAllAssets = useCallback(async () => {
    try {
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE_URL}/assets`, { headers })
      if (res.ok) {
        const data = await res.json()
        // Filter out current asset
        const others = (data.assets || []).filter(a => a.id !== currentAsset?.id)
        setAllAssets(others)
        if (others.length > 0) {
          setTargetAssetId(others[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to load assets list:', err)
    }
  }, [currentAsset?.id])

  useEffect(() => {
    if (isOpen) {
      fetchAllAssets()
    }
  }, [isOpen, fetchAllAssets])

  // Escape closes the dialog — every other modal in the app now does
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!targetAssetId) {
      toast.error('Please select a target asset')
      return
    }

    try {
      setSubmitting(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }

      const parentId = direction === 'outgoing' ? currentAsset.id : targetAssetId
      const childId = direction === 'outgoing' ? targetAssetId : currentAsset.id

      const payload = {
        parent_asset_id: parentId,
        child_asset_id: childId,
        relationship_type: relationshipType,
        description: description.trim() || null
      }

      const res = await fetch(`${API_BASE_URL}/assets/${currentAsset.id}/relationships`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create dependency')
      }

      toast.success('Dependency successfully mapped!')
      onRelationshipAdded && onRelationshipAdded()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const thisName = currentAsset?.name || 'This asset'
  const targetName = allAssets.find(a => a.id === targetAssetId)?.name || 'Target asset'
  const activeHint = REL_TYPES.find(r => r.id === relationshipType)?.hint

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal max-w-lg"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Map asset dependency"
      >
        <div className="modal-header">
          <div>
            <h3 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>
              Map dependency
            </h3>
            <p className="text-[12px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>
              Edges in the CMDB graph drive blast-radius analysis.
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body flex flex-col gap-4">

            <div>
              <label className="field-label">Direction</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('outgoing')}
                  className="dir-tile"
                  data-active={direction === 'outgoing'}
                  aria-pressed={direction === 'outgoing'}
                >
                  <span className="truncate">{thisName}</span>
                  <Arrow />
                  <span className="truncate" style={{ color: 'var(--text-muted)' }}>{targetName}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('incoming')}
                  className="dir-tile"
                  data-active={direction === 'incoming'}
                  aria-pressed={direction === 'incoming'}
                >
                  <span className="truncate" style={{ color: 'var(--text-muted)' }}>{targetName}</span>
                  <Arrow />
                  <span className="truncate">{thisName}</span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="rel_type" className="field-label">Relationship type</label>
              <select
                id="rel_type"
                value={relationshipType}
                onChange={e => setRelationshipType(e.target.value)}
                className="input-field font-mono"
              >
                {REL_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <p className="text-[11.5px] mt-1.5 mb-0" style={{ color: 'var(--text-muted)' }}>{activeHint}</p>
            </div>

            <div>
              <label htmlFor="rel_target" className="field-label">Target asset</label>
              {allAssets.length === 0 ? (
                <p
                  className="text-[12px] px-3 py-2.5 rounded-[10px] m-0"
                  style={{ background: 'var(--surface-sunk)', border: '1px solid var(--line)', color: 'var(--text-muted)' }}
                >
                  No other assets are available to link to yet.
                </p>
              ) : (
                <select
                  id="rel_target"
                  value={targetAssetId}
                  onChange={e => setTargetAssetId(e.target.value)}
                  className="input-field"
                >
                  {allAssets.map(asset => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} — {asset.type} · {asset.status}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="rel_desc" className="field-label">Interface notes (optional)</label>
              <textarea
                id="rel_desc"
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Primary eth0 uplink at 10Gbps, or PostgreSQL port 5432…"
                className="input-field"
              />
            </div>

          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
            <button type="submit" disabled={submitting || allAssets.length === 0} className="btn-primary btn-sm">
              {submitting && (
                <span
                  className="animate-spin-fast w-3 h-3 rounded-full"
                  style={{ border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
                />
              )}
              {submitting ? 'Mapping…' : 'Save relationship'}
            </button>
          </div>
        </form>

        <style>{`
          .dir-tile {
            display: flex; align-items: center; justify-content: center; gap: 7px;
            min-width: 0;
            padding: 10px 11px;
            border-radius: 10px;
            font-size: 12px; font-weight: 600;
            cursor: pointer;
            color: var(--text);
            background: var(--surface-sunk);
            border: 1px solid var(--line);
            transition:
              transform var(--t-press) var(--ease-out),
              background-color var(--t-press) var(--ease-out),
              border-color var(--t-press) var(--ease-out);
          }
          @media (hover: hover) and (pointer: fine) {
            .dir-tile:hover:not([data-active='true']) { border-color: var(--line-strong); }
          }
          .dir-tile:active { transform: scale(0.98); }
          .dir-tile[data-active='true'] {
            background: var(--brand-soft);
            border-color: var(--brand);
          }
          @media (prefers-reduced-motion: reduce) {
            .dir-tile:active { transform: none; }
          }
        `}</style>
      </div>
    </div>
  )
}
