import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import QRScannerModal from '../../components/QRScannerModal'
import './List.css'

function AssetList() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user, role: userRole, isAdmin, isOperator } = useAuth()
  const currentUserId = user?.id
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchAssets()
  }, [])

  async function fetchAssets() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('assets')
        .select(`
          *,
          creator:created_by(id, email, full_name),
          assignee:assigned_to(id, email, full_name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAssets(data || [])
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(assetId, createdBy) {
    // Check permissions
    if (userRole === 'viewer') {
      toast.error('Viewers cannot delete assets')
      return
    }

    if (userRole === 'operator' && createdBy !== currentUserId) {
      toast.error('Operators can only delete assets they created')
      return
    }

    if (!window.confirm('Are you sure you want to delete this asset?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId)

      if (error) throw error

      // Remove from local state
      setAssets(assets.filter(asset => asset.id !== assetId))
      toast.success('Asset deleted successfully')
    } catch (error) {
      toast.error('Error deleting asset: ' + error.message)
    }
  }

  function canEditAsset(createdBy) {
    if (userRole === 'admin') return true
    if (userRole === 'operator' && createdBy === currentUserId) return true
    return false
  }

  function canDeleteAsset(createdBy) {
    if (userRole === 'admin') return true
    if (userRole === 'operator' && createdBy === currentUserId) return true
    return false
  }

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800'
      case 'retired':
        return 'bg-gray-100 text-gray-800'
      case 'damaged':
        return 'bg-red-100 text-red-800'
      case 'in_use':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeBadgeColor = (type) => {
    switch (type) {
      case 'hardware':
        return 'bg-purple-100 text-purple-800'
      case 'software':
        return 'bg-indigo-100 text-indigo-800'
      case 'network':
        return 'bg-cyan-100 text-cyan-800'
      case 'infrastructure':
        return 'bg-orange-100 text-orange-800'
      case 'peripherals':
        return 'bg-pink-100 text-pink-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Filter assets
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.serial_number?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === 'all' || asset.type === filterType
    const matchesStatus = filterStatus === 'all' || asset.status === filterStatus

    return matchesSearch && matchesType && matchesStatus
  })

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header with Action Button */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            🖥️ Asset Management
          </h2>
          <p className="text-gray-600">
            View and manage your IT assets
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium flex items-center gap-2 cursor-pointer shadow-sm text-sm"
            title="Scan barcode or QR code using camera"
          >
            <span>📷</span> Scan Tag
          </button>
          {(isAdmin || isOperator) && (
            <button
              onClick={() => navigate('/assets/new')}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium cursor-pointer shadow-sm text-sm"
            >
              + Add New Asset
            </button>
          )}
        </div>
      </div>

        {/* Filters and Search */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Assets
              </label>
              <input
                type="text"
                placeholder="Search by name, description, or serial number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Types</option>
                <option value="hardware">Hardware</option>
                <option value="software">Software</option>
                <option value="network">Network</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="peripherals">Peripherals</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="in_use">In Use</option>
                <option value="maintenance">Maintenance</option>
                <option value="damaged">Damaged</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Assets Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Asset Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                        <div className="h-3 bg-gray-100 rounded w-20"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-5 bg-gray-200 rounded-full w-16"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-5 bg-gray-200 rounded-full w-16"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-16"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-12"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredAssets.length > 0 ? (
                  filteredAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {asset.name}
                            </div>
                            {asset.serial_number && (
                              <div className="text-sm text-gray-500">
                                S/N: {asset.serial_number}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeColor(asset.type)}`}>
                          {asset.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(asset.status)}`}>
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {asset.location || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {asset.creator?.full_name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(asset.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => navigate(`/assets/${asset.id}`)}
                          className="text-primary-600 hover:text-primary-900 cursor-pointer"
                        >
                          View
                        </button>
                        {canEditAsset(asset.created_by) && (
                          <button
                            onClick={() => navigate(`/assets/${asset.id}/edit`)}
                            className="text-yellow-600 hover:text-yellow-900 cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                        {canDeleteAsset(asset.created_by) && (
                          <button
                            onClick={() => handleDelete(asset.id, asset.created_by)}
                            className="text-red-600 hover:text-red-900 cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : null}
              </tbody>
            </table>

            {!loading && filteredAssets.length === 0 && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No assets found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || filterType !== 'all' || filterStatus !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Get started by creating a new asset'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Assets</p>
                <p className="text-3xl font-bold text-blue-600">{assets.length}</p>
              </div>
              <span className="text-4xl">🖥️</span>
            </div>
          </div>

          <div className="card bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Active</p>
                <p className="text-3xl font-bold text-green-600">
                  {assets.filter(a => a.status === 'active').length}
                </p>
              </div>
              <span className="text-4xl">✅</span>
            </div>
          </div>

          <div className="card bg-yellow-50 border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Maintenance</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {assets.filter(a => a.status === 'maintenance').length}
                </p>
              </div>
              <span className="text-4xl">🔧</span>
            </div>
          </div>

          <div className="card bg-purple-50 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Hardware</p>
                <p className="text-3xl font-bold text-purple-600">
                  {assets.filter(a => a.type === 'hardware').length}
                </p>
              </div>
              <span className="text-4xl">💻</span>
            </div>
          </div>
        </div>

        {/* In-Browser QR & Barcode Camera Scanner */}
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
        />
      </main>
  )
}

export default AssetList