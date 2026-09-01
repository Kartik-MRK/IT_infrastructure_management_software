import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

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

  async function fetchTargets() {
    try {
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      
      const [assetsRes, usersRes] = await Promise.all([
        fetch('http://localhost:5000/api/assets', { headers }),
        fetch('http://localhost:5000/api/users', { headers }).catch(() => ({ ok: false }))
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

      const res = await fetch(`http://localhost:5000/api/licenses/${license.id}/allocate`, {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in font-space">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">💺</span>
            <h3 className="text-base font-bold text-white tracking-tight">
              Allocate Seat: {license?.license_name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Allocation Target Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetType('asset')}
                className={`px-3 py-2 font-semibold rounded-xl border transition-all ${
                  targetType === 'asset'
                    ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                🖥️ Hardware Device / Server
              </button>
              <button
                type="button"
                onClick={() => setTargetType('user')}
                className={`px-3 py-2 font-semibold rounded-xl border transition-all ${
                  targetType === 'user'
                    ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                👤 Employee / User
              </button>
            </div>
          </div>

          {targetType === 'asset' && (
            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Target Hardware Device / Workstation
              </label>
              <select
                value={selectedAssetId}
                onChange={e => setSelectedAssetId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
              >
                {hardwareAssets.map(hw => (
                  <option key={hw.id} value={hw.id}>
                    {hw.name} ({hw.location || 'No Location'} • {hw.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetType === 'user' && (
            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Target Employee / User
              </label>
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email} ({u.role || 'viewer'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Assignment Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Primary CAD workstation for design team..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (targetType === 'asset' && hardwareAssets.length === 0)}
              className="px-5 py-2 font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Allocating...' : 'Assign Seat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
