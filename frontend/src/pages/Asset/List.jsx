import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import QRScannerModal from '../../components/QRScannerModal'
import AssetDataTable from '../../components/AssetDataTable'
import './List.css'

const ASSET_STATUS_TONE = {
  active:      { fg: 'var(--ok)',      line: 'rgba(5, 150, 105, 0.18)'   },
  in_use:      { fg: 'var(--ok)',      line: 'rgba(5, 150, 105, 0.18)'   },
  maintenance: { fg: 'var(--warn)',    line: 'rgba(217, 119, 6, 0.18)'   },
  damaged:     { fg: 'var(--danger)',  line: 'rgba(220, 38, 38, 0.18)'   },
  retired:     { fg: 'var(--neutral)', line: 'rgba(100, 116, 139, 0.18)' },
  disposed:    { fg: 'var(--neutral)', line: 'rgba(100, 116, 139, 0.18)' },
}

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

  // Read-only roles that cannot delete assets
  const READ_ONLY_ROLES = new Set(['viewer', 'employee_requester', 'compliance_officer'])
  // Roles that can edit/delete any asset (regardless of creator)
  const FULL_ASSET_ACCESS_ROLES = new Set(['admin', 'it_admin'])
  // Roles that can edit/delete only their own assets
  const OWN_ASSET_ROLES = new Set([
    'operator', 'infrastructure_engineer', 'asset_custodian', 'helpdesk_operator'
  ])

  async function handleDelete(assetId, createdBy) {
    if (READ_ONLY_ROLES.has(userRole)) {
      toast.error('Your role does not permit asset deletion')
      return
    }

    if (OWN_ASSET_ROLES.has(userRole) && createdBy !== currentUserId) {
      toast.error('You can only delete assets you created')
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
    if (FULL_ASSET_ACCESS_ROLES.has(userRole)) return true
    if (OWN_ASSET_ROLES.has(userRole) && createdBy === currentUserId) return true
    return false
  }

  function canDeleteAsset(createdBy) {
    if (FULL_ASSET_ACCESS_ROLES.has(userRole)) return true
    if (OWN_ASSET_ROLES.has(userRole) && createdBy === currentUserId) return true
    return false
  }

  return (
    <main className="max-w-[1400px] mx-auto py-7 px-4 sm:px-6 lg:px-8 animate-fade-in">

      {/* Header with actions & view mode toggle */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            Asset Management
            <span className="badge-code" style={{ color: 'var(--brand)', background: 'var(--brand-soft)', borderColor: 'var(--brand-line)' }}>
              {assets.length} total
            </span>
          </h1>
          <p className="page-subtitle">Enterprise asset inventory, telemetry, and lifecycle tracking.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="segmented">
            {[{ id: 'table', label: 'Table' }, { id: 'grid', label: 'Cards' }].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewMode(id)}
                className="segmented-item"
                data-active={viewMode === id}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="btn-secondary btn-sm"
            title="Scan barcode or QR code using camera"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 012-2h2"/><path d="M17 3h2a2 2 0 012 2v2"/><path d="M21 17v2a2 2 0 01-2 2h-2"/><path d="M7 21H5a2 2 0 01-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>
            Scan Tag
          </button>

          {(isAdmin || isOperator) && (
            <button type="button" onClick={() => navigate('/assets/new')} className="btn-primary btn-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Asset
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="mb-5 px-4 py-3 rounded-[11px] text-[12.5px] flex items-start gap-2.5"
          style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger-line)', color: 'var(--danger)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-[1px]"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(262px, 1fr))' }}>
          {loading ? (
            [1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="card">
                <div className="skeleton h-[12px] w-[52%] mb-3" />
                <div className="skeleton h-[9px] w-[74%] mb-4" />
                <div className="skeleton h-[9px] w-[34%]" />
              </div>
            ))
          ) : assets.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
              </div>
              <p className="empty-state-title">No assets in inventory</p>
              <p className="empty-state-text">Registered hardware, software, and infrastructure will appear here.</p>
            </div>
          ) : (
            assets.map(asset => {
              const tone = ASSET_STATUS_TONE[asset.status] ?? ASSET_STATUS_TONE.retired

              return (
                <div
                  key={asset.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/assets/${asset.id}`)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/assets/${asset.id}`)
                    }
                  }}
                  className="card card-interactive asset-tile"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="status-dot" style={{ background: tone.fg, '--halo': tone.line }} />
                        <h4 className="text-[13px] font-bold truncate m-0" style={{ color: 'var(--text)' }}>
                          {asset.name}
                        </h4>
                      </div>
                      <p className="text-[11px] font-mono m-0 truncate" style={{ color: 'var(--text-faint)' }}>
                        {asset.serial_number ? `S/N: ${asset.serial_number}` : 'No serial number'}
                      </p>
                    </div>
                    <span className="badge-code shrink-0" style={{ color: 'var(--brand)', background: 'var(--brand-soft)', borderColor: 'var(--brand-line)' }}>
                      {asset.type}
                    </span>
                  </div>

                  <div
                    className="flex items-center justify-between text-[12px] mt-3 pt-2.5"
                    style={{ borderTop: '1px solid var(--line)' }}
                  >
                    <span className="truncate" style={{ color: 'var(--text-soft)' }}>
                      {asset.location || 'Unassigned'}
                    </span>
                    <span className="font-mono font-bold tnum shrink-0 ml-2" style={{ color: 'var(--text)' }}>
                      {asset.cost ? `$${Number(asset.cost).toLocaleString()}` : '—'}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Summary tiles — accent rails, matching the dashboard so the two read as one system */}
      <div className="grid gap-3 mt-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {[
          { label: 'Total Assets',       value: assets.length,                                                                       accent: '#4f46e5' },
          { label: 'Operational',        value: assets.filter(a => a.status === 'active' || a.status === 'in_use').length,            accent: '#059669' },
          { label: 'Needs Attention',    value: assets.filter(a => a.status === 'maintenance' || a.status === 'damaged').length,      accent: '#d97706' },
          { label: 'Hardware / Infra',   value: assets.filter(a => a.type === 'hardware' || a.type === 'infrastructure').length,      accent: '#7c3aed' },
        ].map(({ label, value, accent }) => (
          <div key={label} className="card !py-3.5 relative overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent }} />
            <p className="metric-label">{label}</p>
            <p className="metric-value mt-2" style={{ color: 'var(--text)' }}>{loading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* In-Browser QR & Barcode Camera Scanner */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />

      <style>{`
        .asset-tile {
          display: flex;
          flex-direction: column;
          text-align: left;
        }
      `}</style>
    </main>
  )
}

export default AssetList