import React, { useState } from 'react'
import toast from 'react-hot-toast'

export default function CreateLicenseModal({ isOpen, onClose, softwareAsset, onLicenseCreated }) {
  const [formData, setFormData] = useState({
    license_name: '',
    license_key: '',
    license_type: 'per_seat',
    total_seats: 10,
    cost_per_seat: 0,
    vendor: '',
    purchase_date: '',
    expiration_date: ''
  })
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.license_name.trim()) {
      toast.error('License name is required')
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
        software_asset_id: softwareAsset.id,
        license_name: formData.license_name.trim(),
        license_key: formData.license_key.trim() || null,
        license_type: formData.license_type,
        total_seats: parseInt(formData.total_seats, 10) || 1,
        cost_per_seat: parseFloat(formData.cost_per_seat) || 0.00,
        vendor: formData.vendor.trim() || null,
        purchase_date: formData.purchase_date || null,
        expiration_date: formData.expiration_date || null
      }

      const res = await fetch('http://localhost:5000/api/licenses', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create license')
      }

      toast.success('Software license registered successfully!')
      onLicenseCreated && onLicenseCreated()
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
            <span className="text-xl">📜</span>
            <h3 className="text-base font-bold text-white tracking-tight">
              Register Software License ({softwareAsset?.name})
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
            <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
              License Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Enterprise Seat Pool, Commercial Annual..."
              value={formData.license_name}
              onChange={e => setFormData({ ...formData, license_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
                License Type
              </label>
              <select
                value={formData.license_type}
                onChange={e => setFormData({ ...formData, license_type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
              >
                <option value="per_seat">Per Seat (Named User/Device)</option>
                <option value="subscription">Subscription (SaaS)</option>
                <option value="site_license">Site License (Unlimited)</option>
                <option value="per_core">Per CPU Core</option>
                <option value="oem">OEM / Node Locked</option>
                <option value="open_source">Open Source / FOSS</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Total Seat Capacity *
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.total_seats}
                onChange={e => setFormData({ ...formData, total_seats: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Vendor / Publisher
              </label>
              <input
                type="text"
                placeholder="e.g. Microsoft, JetBrains, Adobe..."
                value={formData.vendor}
                onChange={e => setFormData({ ...formData, vendor: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Cost Per Seat (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.cost_per_seat}
                onChange={e => setFormData({ ...formData, cost_per_seat: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
              License Key / Activation Code
            </label>
            <input
              type="text"
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              value={formData.license_key}
              onChange={e => setFormData({ ...formData, license_key: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono text-cyan-300 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                value={formData.purchase_date}
                onChange={e => setFormData({ ...formData, purchase_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Expiration / Renewal Date
              </label>
              <input
                type="date"
                value={formData.expiration_date}
                onChange={e => setFormData({ ...formData, expiration_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Registering...' : 'Save License'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
