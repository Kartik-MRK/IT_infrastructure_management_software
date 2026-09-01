import React, { useState } from 'react'
import toast from 'react-hot-toast'

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

      const res = await fetch(`http://localhost:5000/api/assets/${asset.id}/audits`, {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-space">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h3 className="text-base font-bold text-white tracking-tight">
              Record Physical Audit ({asset.name})
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
          {/* Asset Summary Badge */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-slate-300 grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Registered Location</span>
              <strong className="text-white text-xs">{asset.location || 'No Location Set'}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Registered Status</span>
              <strong className="text-white text-xs uppercase">{asset.status}</strong>
            </div>
          </div>

          {/* Location Verification Check */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={formData.location_verified}
                onChange={e => setFormData({ ...formData, location_verified: e.target.checked })}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
              />
              <span>Physical location matches registered location ({asset.location || 'HQ'})</span>
            </label>

            {!formData.location_verified && (
              <div className="mt-2 pl-6 animate-fade-in">
                <input
                  type="text"
                  required={!formData.location_verified}
                  placeholder="Enter newly observed physical location (e.g. Floor 3 - Lab A)..."
                  value={formData.observed_location}
                  onChange={e => setFormData({ ...formData, observed_location: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-amber-500/50 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            )}
          </div>

          {/* Status Verification Check */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={formData.status_verified}
                onChange={e => setFormData({ ...formData, status_verified: e.target.checked })}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
              />
              <span>Operational state matches registered status ({asset.status})</span>
            </label>

            {!formData.status_verified && (
              <div className="mt-2 pl-6 animate-fade-in">
                <select
                  value={formData.observed_status}
                  onChange={e => setFormData({ ...formData, observed_status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-amber-500/50 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="active">Active / In Production</option>
                  <option value="maintenance">Under Maintenance</option>
                  <option value="inactive">Inactive / In Storage</option>
                  <option value="decommissioned">Decommissioned</option>
                </select>
              </div>
            )}
          </div>

          {/* Physical Condition & Scan Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Physical Hardware Condition
              </label>
              <select
                value={formData.physical_condition}
                onChange={e => setFormData({ ...formData, physical_condition: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
              >
                <option value="excellent">✨ Excellent (Like New)</option>
                <option value="good">🟢 Good (Minor Wear)</option>
                <option value="fair">🟡 Fair (Cosmetic Flaws)</option>
                <option value="damaged">🔴 Damaged (Needs Repair)</option>
                <option value="missing">⛔ Missing / Unaccounted</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Audit Verification Method
              </label>
              <select
                value={formData.scan_method}
                onChange={e => setFormData({ ...formData, scan_method: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
              >
                <option value="camera_qr">📷 Camera QR Scan</option>
                <option value="barcode_128">🏷️ Laser 1D Barcode</option>
                <option value="manual">✍️ Manual Inspection</option>
                <option value="nfc">📡 NFC Tap</option>
              </select>
            </div>
          </div>

          {/* Auditor Notes */}
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Inspection Notes / Discrepancies (Optional)
            </label>
            <textarea
              rows="2"
              placeholder="e.g. Serial tag verified. Cleaned fan filters. Found in Server Room Rack 2..."
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
            ></textarea>
          </div>

          {/* Footer */}
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
              disabled={submitting}
              className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Recording...' : 'Submit Physical Audit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
