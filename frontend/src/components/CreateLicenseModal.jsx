import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { API_BASE_URL } from '../config/api'

// The seat field means something different per license type, so the type
// drives its label and hint instead of every model being called "seats".
const LICENSE_TYPES = [
  { id: 'per_seat',     label: 'Per seat (named user or device)', seatLabel: 'Total seats',     hint: 'One seat per named user or device.' },
  { id: 'subscription', label: 'Subscription (SaaS)',             seatLabel: 'Subscribed seats',hint: 'Recurring term — set the renewal date below.' },
  { id: 'site_license', label: 'Site license (unlimited)',        seatLabel: 'Seat cap',        hint: 'Unlimited use on site. Enter a cap only if the contract states one.' },
  { id: 'per_core',     label: 'Per CPU core',                    seatLabel: 'Licensed cores',  hint: 'Counted against physical or vCPU cores, not users.' },
  { id: 'oem',          label: 'OEM / node locked',               seatLabel: 'Locked nodes',    hint: 'Tied to specific hardware and not transferable.' },
  { id: 'open_source',  label: 'Open source / FOSS',              seatLabel: 'Tracked installs',hint: 'No cost, but tracked for compliance and attribution.' },
]

const money = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

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

  // Escape closes the dialog
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

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

      const res = await fetch(`${API_BASE_URL}/licenses`, {
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

  const activeType = LICENSE_TYPES.find(t => t.id === formData.license_type) || LICENSE_TYPES[0]

  // Two numbers the user typed separately, and the one number Finance
  // actually asks about. Deriving it here beats making them multiply.
  const seats = parseInt(formData.total_seats, 10) || 0
  const perSeat = parseFloat(formData.cost_per_seat) || 0
  const commitment = seats * perSeat

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal max-w-lg"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Register software license"
      >
        <div className="modal-header">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>Register a license</h3>
            <p className="text-[12px] mt-0.5 m-0 truncate" style={{ color: 'var(--text-muted)' }}>
              {softwareAsset?.name}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body flex flex-col gap-4">

            <div>
              <label htmlFor="lic_name" className="field-label">License name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                id="lic_name"
                type="text"
                required
                placeholder="e.g. Enterprise seat pool, Commercial annual…"
                value={formData.license_name}
                onChange={e => setFormData({ ...formData, license_name: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="lic_type" className="field-label">Licensing model</label>
              <select
                id="lic_type"
                value={formData.license_type}
                onChange={e => setFormData({ ...formData, license_type: e.target.value })}
                className="input-field"
              >
                {LICENSE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <p className="text-[11.5px] mt-1.5 mb-0" style={{ color: 'var(--text-muted)' }}>{activeType.hint}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="lic_seats" className="field-label">
                  {activeType.seatLabel} <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  id="lic_seats"
                  type="number"
                  min="0"
                  required
                  value={formData.total_seats}
                  onChange={e => setFormData({ ...formData, total_seats: e.target.value })}
                  className="input-field tnum"
                />
              </div>
              <div>
                <label htmlFor="lic_cost" className="field-label">Cost per seat (₹)</label>
                <input
                  id="lic_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost_per_seat}
                  onChange={e => setFormData({ ...formData, cost_per_seat: e.target.value })}
                  className="input-field tnum"
                />
              </div>
            </div>

            {commitment > 0 && (
              <div className="commit-row">
                <span>Total commitment</span>
                <strong className="tnum">{money(commitment)}</strong>
              </div>
            )}

            <div>
              <label htmlFor="lic_vendor" className="field-label">Vendor / publisher</label>
              <input
                id="lic_vendor"
                type="text"
                placeholder="e.g. Microsoft, JetBrains, Adobe…"
                value={formData.vendor}
                onChange={e => setFormData({ ...formData, vendor: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="lic_key" className="field-label">License key / activation code</label>
              <input
                id="lic_key"
                type="text"
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                value={formData.license_key}
                onChange={e => setFormData({ ...formData, license_key: e.target.value })}
                className="input-field font-mono"
                spellCheck="false"
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="lic_purchased" className="field-label">Purchase date</label>
                <input
                  id="lic_purchased"
                  type="date"
                  value={formData.purchase_date}
                  onChange={e => setFormData({ ...formData, purchase_date: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="lic_expires" className="field-label">Expiration / renewal</label>
                {/* Bounded by the purchase date so a renewal cannot be
                    recorded as happening before the purchase. */}
                <input
                  id="lic_expires"
                  type="date"
                  min={formData.purchase_date || undefined}
                  value={formData.expiration_date}
                  onChange={e => setFormData({ ...formData, expiration_date: e.target.value })}
                  className="input-field"
                />
                <p className="text-[11.5px] mt-1.5 mb-0" style={{ color: 'var(--text-muted)' }}>
                  {formData.expiration_date ? 'Renewal alerts fire from this date.' : 'Leave empty for a perpetual license.'}
                </p>
              </div>
            </div>

          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary btn-sm">
              {submitting && (
                <span
                  className="animate-spin-fast w-3 h-3 rounded-full"
                  style={{ border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
                />
              )}
              {submitting ? 'Registering…' : 'Save license'}
            </button>
          </div>
        </form>

        <style>{`
          .commit-row {
            display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
            padding: 9px 12px;
            border-radius: 10px;
            font-size: 12px;
            color: var(--text-muted);
            background: var(--brand-soft);
            border: 1px solid var(--brand-line);
          }
          .commit-row strong {
            font-size: 14px; font-weight: 700;
            color: var(--brand);
          }
        `}</style>
      </div>
    </div>
  )
}
