import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Navbar from '../../components/Navbar'
import './Form.css'

function AssetForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = Boolean(id)

  const { user, role: userRole } = useAuth()
  const currentUserId = user?.id

  const [loading, setLoading] = useState(false)
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
        .select('id, full_name, email')
        .order('full_name')

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  async function fetchAsset() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      if (data) {
        // Check permissions
        if (userRole === 'operator' && data.created_by !== currentUserId) {
          toast.error('You can only edit assets you created')
          setTimeout(() => navigate('/assets'), 2000)
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
      setLoading(false)
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
      // Validate required fields
      if (!formData.name?.trim() || !formData.type || !formData.status) {
        throw new Error('Please fill in all required fields (Name, Type, Status)')
      }

      // Sanitize fields - convert empty strings to null for PostgreSQL compatibility
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
        // Update existing asset
        const { error } = await supabase
          .from('assets')
          .update(assetData)
          .eq('id', id)

        if (error) throw error
        toast.success('Asset updated successfully!')
      } else {
        // Create new asset - ensure creator ID is always present
        let creatorId = currentUserId
        if (!creatorId) {
          const { data: { user } } = await supabase.auth.getUser()
          creatorId = user?.id
        }

        if (!creatorId) {
          throw new Error('Active session not found. Please log in again.')
        }

        assetData.created_by = creatorId

        const { error } = await supabase
          .from('assets')
          .insert([assetData])

        if (error) throw error
        toast.success('Asset created successfully!')
      }

      navigate('/assets')
    } catch (error) {
      toast.error(error.message)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading && isEditMode) {
    return (
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-6 bg-gray-200 rounded w-28"></div>
          <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-10 bg-gray-100 rounded w-full"></div>
            <div className="h-10 bg-gray-100 rounded w-full"></div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/assets')}
            className="text-primary-600 hover:text-primary-800 font-medium flex items-center"
          >
            ← Back to Assets
          </button>
        </div>

        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {isEditMode ? '✏️ Edit Asset' : '➕ Add New Asset'}
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Asset Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Asset Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Dell OptiPlex 7090"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Type and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                  Asset Type *
                </label>
                <select
                  id="type"
                  name="type"
                  required
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="hardware">Hardware</option>
                  <option value="software">Software</option>
                  <option value="network">Network</option>
                  <option value="infrastructure">Infrastructure</option>
                  <option value="peripherals">Peripherals</option>
                </select>
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  id="status"
                  name="status"
                  required
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="active">Active</option>
                  <option value="in_use">In Use</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="damaged">Damaged</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows="3"
                value={formData.description}
                onChange={handleChange}
                placeholder="Brief description of the asset..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Serial Number and Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="serial_number" className="block text-sm font-medium text-gray-700 mb-2">
                  Serial Number
                </label>
                <input
                  type="text"
                  id="serial_number"
                  name="serial_number"
                  value={formData.serial_number}
                  onChange={handleChange}
                  placeholder="e.g., SN123456789"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., Office - Floor 3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="purchase_date" className="block text-sm font-medium text-gray-700 mb-2">
                  Purchase Date
                </label>
                <input
                  type="date"
                  id="purchase_date"
                  name="purchase_date"
                  value={formData.purchase_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label htmlFor="warranty_expiry" className="block text-sm font-medium text-gray-700 mb-2">
                  Warranty Expiry
                </label>
                <input
                  type="date"
                  id="warranty_expiry"
                  name="warranty_expiry"
                  value={formData.warranty_expiry}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Cost and Assigned To */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="cost" className="block text-sm font-medium text-gray-700 mb-2">
                  Cost (₹)
                </label>
                <input
                  type="number"
                  id="cost"
                  name="cost"
                  step="0.01"
                  min="0"
                  value={formData.cost}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700 mb-2">
                  Assign To
                </label>
                <select
                  id="assigned_to"
                  name="assigned_to"
                  value={formData.assigned_to}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">-- Not Assigned --</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => navigate('/assets')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : isEditMode ? 'Update Asset' : 'Create Asset'}
              </button>
            </div>
          </form>
        </div>
      </main>
  )
}

export default AssetForm