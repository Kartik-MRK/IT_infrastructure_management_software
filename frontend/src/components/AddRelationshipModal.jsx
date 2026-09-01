import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

export default function AddRelationshipModal({ isOpen, onClose, currentAsset, onRelationshipAdded }) {
  const [allAssets, setAllAssets] = useState([])
  const [targetAssetId, setTargetAssetId] = useState('')
  const [relationshipType, setRelationshipType] = useState('depends_on')
  const [direction, setDirection] = useState('outgoing') // outgoing (this -> target) or incoming (target -> this)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchAllAssets()
    }
  }, [isOpen])

  async function fetchAllAssets() {
    try {
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch('http://localhost:5000/api/assets', { headers })
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
  }

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

      const res = await fetch(`http://localhost:5000/api/assets/${currentAsset.id}/relationships`, {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in font-space">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔗</span>
            <h3 className="text-base font-bold text-white tracking-tight">
              Map CMDB Asset Dependency
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Relationship Direction
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('outgoing')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  direction === 'outgoing'
                    ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                {currentAsset?.name} ➔ Target Asset
              </button>
              <button
                type="button"
                onClick={() => setDirection('incoming')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  direction === 'incoming'
                    ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                Target Asset ➔ {currentAsset?.name}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Relationship Type
            </label>
            <select
              value={relationshipType}
              onChange={e => setRelationshipType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
            >
              <option value="hosts">hosts (Parent physically or logically runs Child)</option>
              <option value="connects_to">connects_to (Network link or physical port)</option>
              <option value="depends_on">depends_on (Service architectural dependency)</option>
              <option value="backs_up">backs_up (Backup or failover redundancy)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Target Asset
            </label>
            <select
              value={targetAssetId}
              onChange={e => setTargetAssetId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
            >
              {allAssets.map(asset => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} ({asset.type} • {asset.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Description / Interface Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Primary eth0 uplink at 10Gbps, or PostgreSQL port 5432..."
              className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            ></textarea>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || allAssets.length === 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              {submitting ? 'Mapping Dependency...' : 'Save Relationship'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
