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

  useEffect(() => {
    if (userRole === 'viewer') {
      toast.error('Viewers have read-only access and cannot create or edit assets')
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
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 font-space animate-fade-in">
        <div className="animate-pulse space-y-6">
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-28"></div>
          <div className="card space-y-4">
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
            <div className="h-10 bg-slate-100 dark:bg-slate-900 rounded w-full"></div>
            <div className="h-10 bg-slate-100 dark:bg-slate-900 rounded w-full"></div>
          </div>
        </div>
      </main>
    )
  }

  const assetTypes = [
    { id: 'hardware', label: 'Hardware', icon: '🖥️' },
    { id: 'software', label: 'Software', icon: '📦' },
    { id: 'network', label: 'Network', icon: '🌐' },
    { id: 'infrastructure', label: 'Infrastructure', icon: '🏢' },
    { id: 'peripherals', label: 'Peripherals', icon: '⌨️' }
  ]

  const statusOptions = [
    { id: 'active', label: 'Active', icon: '🟢' },
    { id: 'in_use', label: 'In Use', icon: '🔵' },
    { id: 'maintenance', label: 'Maintenance', icon: '🟡' },
    { id: 'retired', label: 'Retired', icon: '⚪' },
    { id: 'damaged', label: 'Damaged', icon: '🔴' }
  ]

  return (
    <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 font-space animate-fade-in">
      
      {/* Back Button & Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/assets')}
            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1.5 cursor-pointer mb-2"
          >
            ← Back to Asset Inventory
          </button>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span>{isEditMode ? '✏️' : '➕'}</span>
            {isEditMode ? `Edit Asset: ${formData.name || 'Configuration'}` : 'Register New Asset'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isEditMode ? 'Update infrastructure specifications and custodian details.' : 'Add new physical or logical hardware, software, or network assets to the CMDB.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Basic Information & Classification */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-lg">📋</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              General Information & Classification
            </h3>
          </div>

          <div className="space-y-4">
            {/* Asset Name */}
            <div>
              <label htmlFor="name" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Asset Name <span className="text-rose-500">*</span>
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

            {/* Asset Type Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                Asset Classification <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {assetTypes.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: t.id }))}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      formData.type === t.id
                        ? 'bg-purple-600/10 border-purple-500 text-purple-600 dark:text-purple-300 shadow-xs'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-lg">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Status Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                Lifecycle Status <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {statusOptions.map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, status: st.id }))}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      formData.status === st.id
                        ? 'bg-purple-600/10 border-purple-500 text-purple-600 dark:text-purple-300 shadow-xs'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <span>{st.icon}</span>
                    <span>{st.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Specifications, Serial & Location */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-lg">🏷️</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Hardware Specs & Physical Location
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="serial_number" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Serial Number / Barcode
              </label>
              <input
                type="text"
                id="serial_number"
                name="serial_number"
                value={formData.serial_number}
                onChange={handleChange}
                placeholder="e.g. SN-892347-DELL"
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Location / Data Center Rack
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. Server Room B - Rack 4U"
                className="input-field"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="description" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Description & Technical Specifications
              </label>
              <textarea
                id="description"
                name="description"
                rows="3"
                value={formData.description}
                onChange={handleChange}
                placeholder="Hardware specs, operating system, network configuration, purpose..."
                className="input-field font-sans"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Financials & Lifecycle */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-lg">💰</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Financials & Warranty Timeline
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="cost" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Purchase Cost ($ USD)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-slate-400 font-mono">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  id="cost"
                  name="cost"
                  value={formData.cost}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="input-field pl-7"
                />
              </div>
            </div>

            <div>
              <label htmlFor="purchase_date" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                id="purchase_date"
                name="purchase_date"
                value={formData.purchase_date}
                onChange={handleChange}
                className="input-field font-sans"
              />
            </div>

            <div>
              <label htmlFor="warranty_expiry" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Warranty Expiry Date
              </label>
              <input
                type="date"
                id="warranty_expiry"
                name="warranty_expiry"
                value={formData.warranty_expiry}
                onChange={handleChange}
                className="input-field font-sans"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Custodian & Assignment */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-lg">👤</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Custodian & Ownership
            </h3>
          </div>

          <div>
            <label htmlFor="assigned_to" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Assign to Custodian
            </label>
            <select
              id="assigned_to"
              name="assigned_to"
              value={formData.assigned_to}
              onChange={handleChange}
              className="input-field font-sans text-sm"
            >
              <option value="">Unassigned (General Pool)</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email} ({u.role || 'user'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/assets')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            <span>{loading ? '⏳' : isEditMode ? '💾' : '✨'}</span>
            {loading ? 'Saving Asset...' : isEditMode ? 'Update Asset' : 'Register Asset'}
          </button>
        </div>

      </form>

    </main>
  )
}

export default AssetForm