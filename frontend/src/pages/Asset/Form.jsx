import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import './Form.css'

function AssetForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = Boolean(id)

  const { user, role: userRole } = useAuth()
  const currentUserId = user?.id

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(isEditMode)
  const [error, setError] = useState(null)
  const [users, setUsers] = useState([])

  const [formData, setFormData] = useState({
    name: '',
    type: 'hardware',
    status: 'active',
    description: '',
    serial_number: '',
    location: '',
    purchase_date: '',
    warranty_expiry: '',
    cost: '',
    assigned_to: ''
  })

  // Roles that are entirely read-only and cannot create or edit assets
  const READ_ONLY_ROLES = new Set(['viewer', 'employee_requester', 'compliance_officer'])

  useEffect(() => {
    if (READ_ONLY_ROLES.has(userRole)) {
      toast.error('Your role has read-only access and cannot create or edit assets')
      navigate('/assets')
      return
    }
    fetchUsers()
    if (isEditMode) {
      fetchAsset()
    }
  }, [id, userRole])

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name')

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  async function fetchAsset() {
    try {
      setInitialLoading(true)
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      if (data) {
        if (userRole === 'operator' && data.created_by !== currentUserId) {
          toast.error('You can only edit assets you created')
          setTimeout(() => navigate('/assets'), 1500)
          return
        }

        setFormData({
          name: data.name || '',
          type: data.type || 'hardware',
          status: data.status || 'active',
          description: data.description || '',
          serial_number: data.serial_number || '',
          location: data.location || '',
          purchase_date: data.purchase_date || '',
          warranty_expiry: data.warranty_expiry || '',
          cost: data.cost !== null && data.cost !== undefined ? String(data.cost) : '',
          assigned_to: data.assigned_to || ''
        })
      }
    } catch (error) {
      toast.error(`Error loading asset: ${error.message}`)
      setError(error.message)
    } finally {
      setInitialLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.name?.trim() || !formData.type || !formData.status) {
        throw new Error('Please fill in all required fields (Name, Type, Status)')
      }

      const assetData = {
        name: formData.name.trim(),
        type: formData.type,
        status: formData.status,
        description: formData.description?.trim() || null,
        serial_number: formData.serial_number?.trim() || null,
        location: formData.location?.trim() || null,
        purchase_date: formData.purchase_date?.trim() ? formData.purchase_date : null,
        warranty_expiry: formData.warranty_expiry?.trim() ? formData.warranty_expiry : null,
        cost: formData.cost !== '' && !isNaN(Number(formData.cost)) ? parseFloat(formData.cost) : null,
        assigned_to: formData.assigned_to || null
      }

      if (isEditMode) {
        const { error } = await supabase
          .from('assets')
          .update(assetData)
          .eq('id', id)

        if (error) throw error
        toast.success('Asset updated successfully!')
      } else {
        let creatorId = currentUserId
        if (!creatorId) {
          const { data: { user } } = await supabase.auth.getUser()
          creatorId = user?.id
        }

        const newAssetPayload = {
          ...assetData,
          created_by: creatorId
        }

        const { data: insertedData, error: insertError } = await supabase
          .from('assets')
          .insert([newAssetPayload])
          .select()

        if (insertError) throw insertError

        if (insertedData && insertedData[0]) {
          await supabase.from('asset_metrics').insert([{
            asset_id: insertedData[0].id,
            cpu_usage: 0,
            memory_usage: 0,
            disk_usage: 0,
            temperature: 30,
            power_consumption: 50,
            health_status: 'healthy',
            uptime: 0
          }])
        }

        toast.success('Asset registered successfully!')
      }

      navigate('/assets')
    } catch (err) {
      toast.error(err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <main className="max-w-4xl mx-auto py-7 px-4 sm:px-6 lg:px-8 animate-fade-in flex flex-col gap-5">
        <div className="skeleton h-[13px] w-[110px]" />
        <div className="card flex flex-col gap-4">
          <div className="skeleton h-[14px] w-1/3" />
          <div className="skeleton h-[38px] w-full !rounded-[10px]" />
          <div className="skeleton h-[38px] w-full !rounded-[10px]" />
        </div>
        <div className="card flex flex-col gap-4">
          <div className="skeleton h-[14px] w-1/4" />
          <div className="skeleton h-[38px] w-full !rounded-[10px]" />
        </div>
      </main>
    )
  }

  const assetTypes = [
    { id: 'hardware',       label: 'Hardware'       },
    { id: 'software',       label: 'Software'       },
    { id: 'network',        label: 'Network'        },
    { id: 'infrastructure', label: 'Infrastructure' },
    { id: 'peripherals',    label: 'Peripherals'    },
  ]

  const statusOptions = [
    { id: 'active',      label: 'Active',      dot: 'var(--ok)'      },
    { id: 'in_use',      label: 'In Use',      dot: '#0891b2'        },
    { id: 'maintenance', label: 'Maintenance', dot: 'var(--warn)'    },
    { id: 'retired',     label: 'Retired',     dot: 'var(--neutral)' },
    { id: 'damaged',     label: 'Damaged',     dot: 'var(--danger)'  },
  ]

  const sections = [
    { title: 'General',    hint: 'What it is and where it sits in the lifecycle.' },
    { title: 'Specs',      hint: 'Serial, location, and technical detail.'        },
    { title: 'Financials', hint: 'Cost and warranty timeline.'                    },
    { title: 'Custodian',  hint: 'Who is accountable for this asset.'             },
  ]

  return (
    <main className="max-w-4xl mx-auto py-7 px-4 sm:px-6 lg:px-8 animate-fade-in">

      {/* Header */}
      <div className="mb-6">
        <button type="button" onClick={() => navigate('/assets')} className="btn btn-ghost btn-sm !px-2 -ml-2 mb-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Asset inventory
        </button>
        <h1 className="page-title">
          {isEditMode ? (formData.name || 'Edit asset') : 'Register new asset'}
        </h1>
        <p className="page-subtitle">
          {isEditMode
            ? 'Update specifications, lifecycle status, and custodian.'
            : 'Add physical or logical hardware, software, or network assets to the CMDB.'}
        </p>
      </div>

      {error && (
        <div
          className="mb-5 px-4 py-3 rounded-[11px] text-[12.5px] flex items-start gap-2.5"
          style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger-line)', color: 'var(--danger)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-[1px]"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* ── General ── */}
        <section className="card-flush">
          <div className="card-header">
            <div>
              <p className="section-header !mb-0">{sections[0].title}</p>
              <p className="text-[11.5px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>{sections[0].hint}</p>
            </div>
          </div>

          <div className="p-5 flex flex-col gap-4">
            <div>
              <label htmlFor="name" className="field-label">
                Asset name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Core-Router-01, Dell PowerEdge R750"
                className="input-field"
              />
            </div>

            <div>
              <label className="field-label">
                Classification <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {assetTypes.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: t.id }))}
                    className="choice-tile"
                    data-active={formData.type === t.id}
                    aria-pressed={formData.type === t.id}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="field-label">
                Lifecycle status <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {statusOptions.map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, status: st.id }))}
                    className="choice-tile"
                    data-active={formData.status === st.id}
                    aria-pressed={formData.status === st.id}
                  >
                    <span className="status-dot" style={{ background: st.dot }} />
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Specs ── */}
        <section className="card-flush">
          <div className="card-header">
            <div>
              <p className="section-header !mb-0">{sections[1].title}</p>
              <p className="text-[11.5px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>{sections[1].hint}</p>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="serial_number" className="field-label">Serial number / barcode</label>
              <input
                type="text"
                id="serial_number"
                name="serial_number"
                value={formData.serial_number}
                onChange={handleChange}
                placeholder="SN-892347-DELL"
                className="input-field font-mono"
              />
            </div>

            <div>
              <label htmlFor="location" className="field-label">Location / rack</label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Server Room B — Rack 4U"
                className="input-field"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="description" className="field-label">Description &amp; specifications</label>
              <textarea
                id="description"
                name="description"
                rows="3"
                value={formData.description}
                onChange={handleChange}
                placeholder="Hardware specs, operating system, network configuration, purpose…"
                className="input-field"
              />
            </div>
          </div>
        </section>

        {/* ── Financials ── */}
        <section className="card-flush">
          <div className="card-header">
            <div>
              <p className="section-header !mb-0">{sections[2].title}</p>
              <p className="text-[11.5px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>{sections[2].hint}</p>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="cost" className="field-label">Purchase cost (USD)</label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-mono pointer-events-none"
                  style={{ color: 'var(--text-faint)' }}
                >
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  id="cost"
                  name="cost"
                  value={formData.cost}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="input-field font-mono tnum !pl-7"
                />
              </div>
            </div>

            <div>
              <label htmlFor="purchase_date" className="field-label">Purchase date</label>
              <input
                type="date"
                id="purchase_date"
                name="purchase_date"
                value={formData.purchase_date}
                onChange={handleChange}
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="warranty_expiry" className="field-label">Warranty expiry</label>
              <input
                type="date"
                id="warranty_expiry"
                name="warranty_expiry"
                value={formData.warranty_expiry}
                onChange={handleChange}
                className="input-field"
              />
            </div>
          </div>
        </section>

        {/* ── Custodian ── */}
        <section className="card-flush">
          <div className="card-header">
            <div>
              <p className="section-header !mb-0">{sections[3].title}</p>
              <p className="text-[11.5px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>{sections[3].hint}</p>
            </div>
          </div>

          <div className="p-5">
            <label htmlFor="assigned_to" className="field-label">Assign to custodian</label>
            <select
              id="assigned_to"
              name="assigned_to"
              value={formData.assigned_to}
              onChange={handleChange}
              className="input-field"
            >
              <option value="">Unassigned (general pool)</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email} ({u.role || 'user'})
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className="flex items-center justify-end gap-2.5">
          <button type="button" onClick={() => navigate('/assets')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading && (
              <span
                className="animate-spin-fast w-3 h-3 rounded-full"
                style={{ border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
              />
            )}
            {loading ? 'Saving…' : isEditMode ? 'Update asset' : 'Register asset'}
          </button>
        </div>

      </form>

      <style>{`
        .choice-tile {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 9px 8px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          color: var(--text-soft);
          background: var(--surface);
          border: 1px solid var(--line);
          transition:
            transform var(--t-press) var(--ease-out),
            color var(--t-press) var(--ease-out),
            background-color var(--t-press) var(--ease-out),
            border-color var(--t-press) var(--ease-out),
            box-shadow var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .choice-tile:hover:not([data-active='true']) {
            border-color: var(--line-strong);
            background: var(--surface-hover);
            color: var(--text);
          }
        }
        .choice-tile:active { transform: scale(0.97); }
        .choice-tile[data-active='true'] {
          color: var(--brand);
          background: var(--brand-soft);
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.13);
        }
        @media (prefers-reduced-motion: reduce) {
          .choice-tile:active { transform: none; }
        }
      `}</style>
    </main>
  )
}

export default AssetForm