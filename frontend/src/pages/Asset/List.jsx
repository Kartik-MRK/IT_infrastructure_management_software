import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import QRScannerModal from '../../components/QRScannerModal'
import AssetDataTable from '../../components/AssetDataTable'
import './List.css'

function AssetList() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('table') // 'table' | 'grid'
  const { user, role: userRole, isAdmin, isOperator } = useAuth()
  const currentUserId = user?.id
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

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 font-space animate-fade-in">
      
      {/* Header with Actions & View Mode Toggle */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <span>🖥️</span> Asset Management
            <span className="text-xs font-mono font-bold px-2.5 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 rounded-full">
              {assets.length} Total
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
            Enterprise high-density asset inventory, telemetry monitoring, and lifecycle tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="High-Density Table View"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900'
              }`}
            >
              <span>⚡</span> Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Card Grid View"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900'
              }`}
            >
              <span>🔲</span> Cards
            </button>
          </div>

          {/* QR Camera Scanner */}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="px-3.5 py-2 bg-slate-900 dark:bg-slate-800 border border-slate-700 text-white rounded-xl hover:bg-slate-800 dark:hover:bg-slate-700 transition-all font-bold flex items-center gap-1.5 cursor-pointer shadow-sm text-xs"
            title="Scan barcode or QR code using camera"
          >
            <span>📷</span> Scan Tag
          </button>

          {/* Add Asset */}
          {(isAdmin || isOperator) && (
            <button
              type="button"
              onClick={() => navigate('/assets/new')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all font-bold cursor-pointer shadow-md text-xs flex items-center gap-1.5"
            >
              <span>+</span> Add Asset
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* View Mode 1: High-Density Virtualized Table */}
      {viewMode === 'table' && (
        <AssetDataTable
          assets={assets}
          loading={loading}
          onRefresh={fetchAssets}
          canEditAsset={canEditAsset}
          canDeleteAsset={canDeleteAsset}
          onDeleteAsset={handleDelete}
        />
      )}

      {/* View Mode 2: Card Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="card animate-pulse p-6">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
                <div className="h-3 bg-gray-100 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/4"></div>
              </div>
            ))
          ) : assets.length === 0 ? (
            <div className="col-span-full py-12 text-center text-xs text-gray-500">
              No assets in inventory.
            </div>
          ) : (
            assets.map(asset => (
              <div
                key={asset.id}
                onClick={() => navigate(`/assets/${asset.id}`)}
                className="card !p-5 hover:border-purple-500 transition-all cursor-pointer space-y-3 group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">
                      {asset.name}
                    </h4>
                    <p className="text-[11px] text-gray-400 font-mono">
                      {asset.serial_number ? `S/N: ${asset.serial_number}` : 'No serial number'}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/30">
                    {asset.type}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100 dark:border-slate-800">
                  <span className="text-gray-500 dark:text-slate-400">
                    📍 {asset.location || 'Unassigned'}
                  </span>
                  <span className="font-mono font-bold text-gray-700 dark:text-slate-300">
                    {asset.purchase_cost ? `$${Number(asset.purchase_cost).toLocaleString()}` : '—'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
        <div className="card !p-4 bg-blue-50/50 dark:bg-slate-900/50 border-blue-200 dark:border-blue-900/30">
          <span className="text-[11px] font-bold uppercase text-gray-500 dark:text-slate-400 block">Total Assets</span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono mt-1">
            {assets.length}
          </div>
        </div>

        <div className="card !p-4 bg-emerald-50/50 dark:bg-slate-900/50 border-emerald-200 dark:border-emerald-900/30">
          <span className="text-[11px] font-bold uppercase text-gray-500 dark:text-slate-400 block">Active Operational</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            {assets.filter(a => a.status === 'active' || a.status === 'in_use').length}
          </div>
        </div>

        <div className="card !p-4 bg-amber-50/50 dark:bg-slate-900/50 border-amber-200 dark:border-amber-900/30">
          <span className="text-[11px] font-bold uppercase text-gray-500 dark:text-slate-400 block">Under Maintenance</span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
            {assets.filter(a => a.status === 'maintenance' || a.status === 'damaged').length}
          </div>
        </div>

        <div className="card !p-4 bg-purple-50/50 dark:bg-slate-900/50 border-purple-200 dark:border-purple-900/30">
          <span className="text-[11px] font-bold uppercase text-gray-500 dark:text-slate-400 block">Hardware / Servers</span>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono mt-1">
            {assets.filter(a => a.type === 'hardware' || a.type === 'infrastructure').length}
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