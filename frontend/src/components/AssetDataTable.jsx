import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { API_BASE_URL } from '../config/api'

const PRESETS = [
  { id: 'all',         label: 'All'          },
  { id: 'maintenance', label: 'Needs attention' },
  { id: 'hardware',    label: 'Hardware'     },
  { id: 'software',    label: 'Software'     },
  { id: 'network',     label: 'Network'      },
]

const COL_LABELS = {
  name:          'Asset name',
  type:          'Type',
  status:        'Status',
  location:      'Location',
  serial_number: 'Serial number',
  purchase_cost: 'Cost',
  creator:       'Created by',
  created_at:    'Date added',
  actions:       'Actions',
}

const STATUS_TONE = {
  active:      'badge-code badge-success',
  in_use:      'badge-code badge-info',
  maintenance: 'badge-code badge-warning',
  damaged:     'badge-code badge-danger',
  retired:     'badge-code badge-neutral',
  disposed:    'badge-code badge-neutral',
}

const BULK_STATUSES = [
  { id: 'active',      label: 'Active',      hint: 'Operational',    dot: 'var(--ok)'      },
  { id: 'in_use',      label: 'In use',      hint: 'Assigned',       dot: '#0891b2'        },
  { id: 'maintenance', label: 'Maintenance', hint: 'Under repair',   dot: 'var(--warn)'    },
  { id: 'retired',     label: 'Retired',     hint: 'Decommissioned', dot: 'var(--neutral)' },
  { id: 'damaged',     label: 'Damaged',     hint: 'Faulty',         dot: 'var(--danger)'  },
]

// The table was written against `purchase_cost` while the form writes `cost`,
// so the column rendered "—" for every asset. Read both, and sort on the same
// value that gets displayed.
const costOf = (a) => {
  const raw = a?.purchase_cost ?? a?.cost
  const n = Number(raw)
  return raw === null || raw === undefined || raw === '' || Number.isNaN(n) ? null : n
}

// Density icons: three, two, and one bar. Reads as "tighter → roomier"
// without needing a label on every button.
function DensityIcon({ rows }) {
  const ys = rows === 3 ? [6, 12, 18] : rows === 2 ? [8, 16] : [12]
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      {ys.map(y => <line key={y} x1="4" y1={y} x2="20" y2={y} />)}
    </svg>
  )
}

export default function AssetDataTable({
  assets = [],
  loading = false,
  onRefresh,
  canEditAsset,
  canDeleteAsset,
  onDeleteAsset
}) {
  const navigate = useNavigate()
  const searchInputRef = useRef(null)
  const tableRef = useRef(null)
  const colMenuRef = useRef(null)
  const focusedRowRef = useRef(null)

  // 1. Density Mode (Compact / Normal / Comfortable)
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('itims_table_density') || 'normal'
  })

  useEffect(() => {
    localStorage.setItem('itims_table_density', density)
  }, [density])

  // 2. Column Visibility
  const defaultCols = {
    name: true,
    type: true,
    status: true,
    location: true,
    serial_number: true,
    purchase_cost: true,
    creator: true,
    created_at: true,
    actions: true
  }

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('itims_table_columns')
      return saved ? { ...defaultCols, ...JSON.parse(saved) } : defaultCols
    } catch {
      return defaultCols
    }
  })

  const [isColMenuOpen, setIsColMenuOpen] = useState(false)

  const toggleColumn = (key) => {
    setVisibleCols(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem('itims_table_columns', JSON.stringify(next))
      return next
    })
  }

  // 3. Quick Filter Presets & Search
  const [preset, setPreset] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortAsc, setSortAsc] = useState(false)

  // 4. Multi-Select State
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [focusedIndex, setFocusedIndex] = useState(0)

  // 5. Bulk Status State
  const [bulkStatus, setBulkStatus] = useState('maintenance')
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)

  // Filter & Search Logic
  const filteredAssets = useMemo(() => {
    let result = [...assets]

    // Preset filtering
    if (preset === 'maintenance') {
      result = result.filter(a => a.status === 'maintenance' || a.status === 'damaged')
    } else if (preset === 'hardware') {
      result = result.filter(a => a.type === 'hardware' || a.type === 'infrastructure')
    } else if (preset === 'software') {
      result = result.filter(a => a.type === 'software')
    } else if (preset === 'network') {
      result = result.filter(a => a.type === 'network')
    }

    // Search query filtering (multi-field fuzzy)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(a =>
        a.name?.toLowerCase().includes(q) ||
        a.serial_number?.toLowerCase().includes(q) ||
        a.location?.toLowerCase().includes(q) ||
        a.type?.toLowerCase().includes(q) ||
        a.status?.toLowerCase().includes(q) ||
        a.creator?.full_name?.toLowerCase().includes(q)
      )
    }

    // Sorting
    result.sort((a, b) => {
      let vA = a[sortField] ?? ''
      let vB = b[sortField] ?? ''

      if (sortField === 'purchase_cost') {
        vA = costOf(a) ?? 0
        vB = costOf(b) ?? 0
      } else if (sortField === 'creator') {
        vA = a.creator?.full_name || ''
        vB = b.creator?.full_name || ''
      }

      if (vA < vB) return sortAsc ? -1 : 1
      if (vA > vB) return sortAsc ? 1 : -1
      return 0
    })

    return result
  }, [assets, preset, searchQuery, sortField, sortAsc])

  const colCount = 1 + Object.keys(defaultCols).filter(k => visibleCols[k]).length

  // Keyboard Shortcuts Listener
  useEffect(() => {
    function handleKeyDown(e) {
      // If typing in input/textarea, only allow Escape
      const activeEl = document.activeElement
      const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')

      if (e.key === '/' && !isTyping) {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (e.key === 'Escape') {
        // Dismiss the shallowest layer first — otherwise Escape wiped the
        // selection out from under an open modal that stayed on screen.
        if (isBulkStatusModalOpen) {
          setIsBulkStatusModalOpen(false)
        } else if (isColMenuOpen) {
          setIsColMenuOpen(false)
        } else if (isTyping) {
          activeEl.blur()
        } else {
          setSelectedIds(new Set())
          setSearchQuery('')
        }
        return
      }

      // Row navigation must not run behind an open dialog
      if (isTyping || isBulkStatusModalOpen) return

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex(prev => Math.min(prev + 1, Math.max(0, filteredAssets.length - 1)))
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const target = filteredAssets[focusedIndex]
        if (target) {
          navigate(`/assets/${target.id}`)
        }
      } else if (e.key === 'x') {
        e.preventDefault()
        const target = filteredAssets[focusedIndex]
        if (target) {
          toggleSelect(target.id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredAssets, focusedIndex, navigate, isBulkStatusModalOpen, isColMenuOpen])

  // Keep the cursor on screen while j/k walks the list. Instant, never
  // smooth — this fires on a keystroke people repeat dozens of times.
  useEffect(() => {
    focusedRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [focusedIndex])

  // A filter that shrinks the list must not leave the cursor past the end
  useEffect(() => {
    setFocusedIndex(prev => Math.min(prev, Math.max(0, filteredAssets.length - 1)))
  }, [filteredAssets.length])

  // Click-outside closes the column menu — it previously stayed open until
  // you found the trigger again.
  useEffect(() => {
    if (!isColMenuOpen) return
    function onDown(e) {
      if (!colMenuRef.current?.contains(e.target)) setIsColMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [isColMenuOpen])

  // Multi-Select Handlers
  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleSelectAll() {
    if (selectedIds.size === filteredAssets.length && filteredAssets.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredAssets.map(a => a.id)))
    }
  }

  // Bulk Status Update
  async function handleBulkStatusSubmit() {
    if (selectedIds.size === 0) return
    try {
      setIsBulkUpdating(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
      const res = await fetch(`${API_BASE_URL}/assets/bulk-status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          asset_ids: Array.from(selectedIds),
          status: bulkStatus
        })
      })
      if (res.ok) {
        toast.success(`Updated ${selectedIds.size} assets to "${bulkStatus}"`)
        setIsBulkStatusModalOpen(false)
        setSelectedIds(new Set())
        if (onRefresh) onRefresh()
      } else {
        const json = await res.json()
        toast.error(json.error || 'Failed to update asset statuses')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsBulkUpdating(false)
    }
  }

  // Bulk Delete
  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected assets?`)) return

    try {
      setIsBulkUpdating(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
      const res = await fetch(`${API_BASE_URL}/assets/bulk-delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          asset_ids: Array.from(selectedIds)
        })
      })
      if (res.ok) {
        toast.success(`Deleted ${selectedIds.size} assets`)
        setSelectedIds(new Set())
        if (onRefresh) onRefresh()
      } else {
        const json = await res.json()
        toast.error(json.error || 'Failed to delete assets')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsBulkUpdating(false)
    }
  }

  // Export CSV
  function handleExportCSV() {
    const targetAssets = selectedIds.size > 0
      ? filteredAssets.filter(a => selectedIds.has(a.id))
      : filteredAssets

    if (targetAssets.length === 0) {
      toast.error('No assets to export')
      return
    }

    const headers = ['ID', 'Name', 'Type', 'Status', 'Location', 'Serial Number', 'Cost ($)', 'Created At']
    const rows = targetAssets.map(a => [
      `"${a.id}"`,
      `"${(a.name || '').replace(/"/g, '""')}"`,
      `"${a.type || ''}"`,
      `"${a.status || ''}"`,
      `"${(a.location || '').replace(/"/g, '""')}"`,
      `"${(a.serial_number || '').replace(/"/g, '""')}"`,
      costOf(a) ?? 0,
      `"${a.created_at || ''}"`
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `itims_assets_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Exported ${targetAssets.length} assets to CSV`)
  }

  // Export JSON
  function handleExportJSON() {
    const targetAssets = selectedIds.size > 0
      ? filteredAssets.filter(a => selectedIds.has(a.id))
      : filteredAssets

    const jsonStr = JSON.stringify(targetAssets, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `itims_assets_export_${new Date().toISOString().slice(0, 10)}.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Exported ${targetAssets.length} assets to JSON`)
  }

  function sortBy(field) {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  // A sortable header carries its own caret rather than a text arrow glued
  // to the label, so the column title stays readable at 11px.
  const SortTh = ({ field, children, align }) => (
    <th className={align === 'right' ? '!text-right' : undefined}>
      <button type="button" onClick={() => sortBy(field)} className="th-sort" data-active={sortField === field}>
        {children}
        <svg
          className="caret"
          data-asc={sortField === field ? sortAsc : false}
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </th>
  )

  return (
    <div className="flex flex-col gap-4">

      {/* ── Control bar ── */}
      <div className="card !p-0">

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-3.5 py-3">

          {/* Presets */}
          <div className="segmented overflow-x-auto max-w-full">
            {PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className="segmented-item whitespace-nowrap"
                data-active={preset === p.id}
                aria-pressed={preset === p.id}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">

            {/* Density */}
            <div className="segmented" role="group" aria-label="Row density">
              {[
                { id: 'compact',     rows: 3, label: 'Compact rows'     },
                { id: 'normal',      rows: 2, label: 'Normal rows'      },
                { id: 'comfortable', rows: 1, label: 'Comfortable rows' },
              ].map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDensity(d.id)}
                  title={d.label}
                  aria-label={d.label}
                  aria-pressed={density === d.id}
                  className="segmented-item !px-2 !py-1.5 inline-flex"
                  data-active={density === d.id}
                >
                  <DensityIcon rows={d.rows} />
                </button>
              ))}
            </div>

            {/* Column visibility */}
            <div className="relative" ref={colMenuRef}>
              <button
                type="button"
                onClick={() => setIsColMenuOpen(prev => !prev)}
                className="btn-secondary btn-sm"
                aria-expanded={isColMenuOpen}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                Columns
              </button>

              {isColMenuOpen && (
                <div className="popover right-0 mt-1.5 w-52" style={{ '--transform-origin': 'top right' }}>
                  <p className="section-header !mb-1 px-2.5 pt-1.5">Visible columns</p>
                  {Object.keys(defaultCols).map(colKey => (
                    <label key={colKey} className="menu-item !text-[12.5px]">
                      <input
                        type="checkbox"
                        checked={visibleCols[colKey] ?? true}
                        onChange={() => toggleColumn(colKey)}
                        className="cb"
                      />
                      {COL_LABELS[colKey]}
                    </label>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Search + shortcut legend */}
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="relative flex-1 min-w-0">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search name, serial, location, type…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field !pl-9 !pr-9"
              aria-label="Search assets"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="btn btn-ghost btn-icon absolute right-1.5 top-1/2 -translate-y-1/2 !w-6 !h-6"
                aria-label="Clear search"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[11px] shrink-0" style={{ color: 'var(--text-faint)' }}>
            <kbd className="kbd">/</kbd> search
            <kbd className="kbd ml-1">j</kbd><kbd className="kbd">k</kbd> move
            <kbd className="kbd ml-1">x</kbd> select
            <kbd className="kbd ml-1">↵</kbd> open
          </div>
        </div>

      </div>

      {/* ── Table ── */}
      <div ref={tableRef} className="card-flush">
        <div className="overflow-x-auto">
          <table className="data-table asset-table" data-density={density}>
            <thead>
              <tr>
                <th className="w-9 !px-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredAssets.length && filteredAssets.length > 0}
                    onChange={handleSelectAll}
                    className="cb"
                    aria-label="Select all visible assets"
                  />
                </th>

                {visibleCols.name          && <SortTh field="name">Asset name</SortTh>}
                {visibleCols.type          && <SortTh field="type">Type</SortTh>}
                {visibleCols.status        && <SortTh field="status">Status</SortTh>}
                {visibleCols.location      && <th>Location</th>}
                {visibleCols.serial_number && <th>Serial number</th>}
                {visibleCols.purchase_cost && <SortTh field="purchase_cost">Cost</SortTh>}
                {visibleCols.creator       && <th>Created by</th>}
                {visibleCols.created_at    && <SortTh field="created_at">Date added</SortTh>}
                {visibleCols.actions       && <th className="!text-right">Actions</th>}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="!px-3"><div className="skeleton w-3.5 h-3.5 !rounded-[4px]" /></td>
                    {Array.from({ length: colCount - 1 }).map((__, c) => (
                      <td key={c}>
                        <div className="skeleton h-[11px]" style={{ width: `${58 + ((c * 17) % 40)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="!p-0">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      </div>
                      <p className="empty-state-title">
                        {searchQuery || preset !== 'all' ? 'Nothing matches those filters' : 'No assets registered'}
                      </p>
                      <p className="empty-state-text">
                        {searchQuery || preset !== 'all'
                          ? 'Try a broader preset or a different search term.'
                          : 'Register your first asset to start tracking inventory.'}
                      </p>
                      {(searchQuery || preset !== 'all') && (
                        <button
                          type="button"
                          onClick={() => { setSearchQuery(''); setPreset('all') }}
                          className="btn-secondary btn-sm mt-5"
                        >
                          Reset filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset, index) => {
                  const isSelected = selectedIds.has(asset.id)
                  const isFocused = focusedIndex === index
                  const cost = costOf(asset)

                  return (
                    <tr
                      key={asset.id}
                      ref={isFocused ? focusedRowRef : null}
                      onClick={() => setFocusedIndex(index)}
                      data-selected={isSelected}
                      data-focused={isFocused}
                    >
                      <td className="!px-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(asset.id)}
                          className="cb"
                          aria-label={`Select ${asset.name}`}
                        />
                      </td>

                      {visibleCols.name && (
                        <td>
                          <button
                            type="button"
                            onClick={() => navigate(`/assets/${asset.id}`)}
                            className="name-cell"
                          >
                            {asset.name}
                          </button>
                        </td>
                      )}

                      {visibleCols.type && (
                        <td>
                          <span className="badge-code badge-neutral">{asset.type}</span>
                        </td>
                      )}

                      {visibleCols.status && (
                        <td>
                          <span className={STATUS_TONE[asset.status] || STATUS_TONE.retired}>
                            {(asset.status || '—').replace('_', ' ')}
                          </span>
                        </td>
                      )}

                      {visibleCols.location && (
                        <td className="truncate max-w-[140px]">{asset.location || '—'}</td>
                      )}

                      {visibleCols.serial_number && (
                        <td className="font-mono text-[12px] truncate max-w-[130px]" style={{ color: 'var(--text-muted)' }}>
                          {asset.serial_number || '—'}
                        </td>
                      )}

                      {visibleCols.purchase_cost && (
                        <td className="font-mono tnum whitespace-nowrap" style={{ color: cost == null ? 'var(--text-faint)' : 'var(--text)' }}>
                          {cost == null ? '—' : `$${cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </td>
                      )}

                      {visibleCols.creator && (
                        <td className="truncate max-w-[130px]">{asset.creator?.full_name || 'System'}</td>
                      )}

                      {visibleCols.created_at && (
                        <td className="font-mono tnum text-[12px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                          {new Date(asset.created_at).toLocaleDateString()}
                        </td>
                      )}

                      {visibleCols.actions && (
                        <td className="!text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          {/* Actions stay quiet until the row is hovered or
                              keyboard-focused — nine rows of three coloured
                              links was the loudest thing on the page. */}
                          <div className="row-actions inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/assets/${asset.id}`)}
                              className="btn btn-ghost btn-sm !px-2"
                            >
                              Open
                            </button>
                            {canEditAsset && canEditAsset(asset.created_by) && (
                              <button
                                type="button"
                                onClick={() => navigate(`/assets/${asset.id}/edit`)}
                                className="btn btn-ghost btn-sm !px-2"
                              >
                                Edit
                              </button>
                            )}
                            {canDeleteAsset && canDeleteAsset(asset.created_by) && (
                              <button
                                type="button"
                                onClick={() => onDeleteAsset && onDeleteAsset(asset.id, asset.created_by)}
                                className="btn btn-ghost btn-icon"
                                aria-label={`Delete ${asset.name}`}
                                title="Delete"
                                style={{ color: 'var(--danger)' }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredAssets.length > 0 && (
          <div
            className="flex items-center justify-between px-4 py-2.5 text-[11.5px] font-mono tnum"
            style={{ borderTop: '1px solid var(--line)', color: 'var(--text-faint)' }}
          >
            <span>{filteredAssets.length} of {assets.length} assets</span>
            {selectedIds.size > 0 && <span>{selectedIds.size} selected</span>}
          </div>
        )}
      </div>

      {/* ── Bulk action dock ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="dock pointer-events-auto">
            <span className="dock-count tnum">{selectedIds.size}</span>
            <span className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.72)' }}>
              selected
            </span>

            <span className="dock-sep" />

            <button type="button" onClick={() => setIsBulkStatusModalOpen(true)} className="dock-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Set status
            </button>
            <button type="button" onClick={handleExportCSV} className="dock-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              CSV
            </button>
            <button type="button" onClick={handleExportJSON} className="dock-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              JSON
            </button>
            <button type="button" onClick={handleBulkDelete} className="dock-btn" data-danger="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              Delete
            </button>

            <span className="dock-sep" />

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="dock-btn !px-1.5"
              aria-label="Clear selection"
              title="Clear selection (Esc)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk status modal ── */}
      {isBulkStatusModalOpen && (
        <div className="overlay" onClick={() => setIsBulkStatusModalOpen(false)}>
          <div className="modal max-w-md" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Bulk status update">
            <div className="modal-header">
              <div>
                <h4 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>Set lifecycle status</h4>
                <p className="text-[12px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>
                  Applies to all {selectedIds.size} selected asset{selectedIds.size === 1 ? '' : 's'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkStatusModalOpen(false)}
                className="btn btn-ghost btn-icon"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="modal-body flex flex-col gap-1.5">
              {BULK_STATUSES.map(st => (
                <label key={st.id} className="status-choice" data-active={bulkStatus === st.id}>
                  <input
                    type="radio"
                    name="bulkStatus"
                    checked={bulkStatus === st.id}
                    onChange={() => setBulkStatus(st.id)}
                    className="cb"
                  />
                  <span className="status-dot" style={{ background: st.dot }} />
                  <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>{st.label}</span>
                  <span className="text-[11.5px] ml-auto" style={{ color: 'var(--text-muted)' }}>{st.hint}</span>
                </label>
              ))}
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setIsBulkStatusModalOpen(false)} className="btn-secondary btn-sm">
                Cancel
              </button>
              <button type="button" disabled={isBulkUpdating} onClick={handleBulkStatusSubmit} className="btn-primary btn-sm">
                {isBulkUpdating && (
                  <span
                    className="animate-spin-fast w-3 h-3 rounded-full"
                    style={{ border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
                  />
                )}
                {isBulkUpdating ? 'Updating…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .cb {
          width: 14px; height: 14px;
          accent-color: var(--brand);
          cursor: pointer;
          flex-shrink: 0;
        }

        .kbd {
          display: inline-block;
          min-width: 17px;
          padding: 1px 4px;
          border-radius: 5px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 10.5px;
          text-align: center;
          color: var(--text-muted);
          background: var(--surface-sunk);
          border: 1px solid var(--line);
          box-shadow: 0 1px 0 var(--line);
        }

        /* ── Sortable headers ── */
        .th-sort {
          display: inline-flex; align-items: center; gap: 4px;
          font: inherit; letter-spacing: inherit; text-transform: inherit;
          color: inherit; background: none; border: none; padding: 0;
          cursor: pointer;
          transition: color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .th-sort:hover { color: var(--text); }
        }
        .th-sort[data-active='true'] { color: var(--brand); }
        .th-sort .caret {
          opacity: 0;
          transition: opacity var(--t-press) var(--ease-out), transform var(--t-pop) var(--ease-out);
        }
        .th-sort[data-active='true'] .caret { opacity: 1; }
        .th-sort .caret[data-asc='true'] { transform: rotate(180deg); }

        /* ── Density ──
           Only the vertical rhythm changes; type size holds so switching
           density never reflows the column widths. */
        .asset-table[data-density='compact'] td      { padding-top: 5px;  padding-bottom: 5px;  }
        .asset-table[data-density='normal'] td       { padding-top: 10px; padding-bottom: 10px; }
        .asset-table[data-density='comfortable'] td  { padding-top: 15px; padding-bottom: 15px; }

        /* ── Rows ──
           No transition here on purpose: j/k moves this cursor dozens of
           times a minute, and a fading highlight makes the keyboard feel
           laggy. Hover still animates via the shared .data-table rule. */
        .asset-table tbody tr[data-focused='true'] { transition: none; }
        .asset-table tbody tr[data-focused='true'] td {
          background-color: var(--surface-hover);
          box-shadow: inset 0 1px 0 var(--brand-line), inset 0 -1px 0 var(--brand-line);
        }
        .asset-table tbody tr[data-focused='true'] td:first-child {
          box-shadow: inset 3px 0 0 var(--brand), inset 0 1px 0 var(--brand-line), inset 0 -1px 0 var(--brand-line);
        }
        .asset-table tbody tr[data-selected='true'] td { background-color: var(--brand-soft); }

        .name-cell {
          display: block;
          max-width: 260px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          font-size: 12.5px; font-weight: 600; text-align: left;
          color: var(--text);
          background: none; border: none; padding: 0;
          cursor: pointer;
          transition: color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .name-cell:hover { color: var(--brand); }
        }

        /* Row actions fade in on hover, but stay permanently visible on
           touch (no hover) and whenever something inside has focus. */
        @media (hover: hover) and (pointer: fine) {
          .row-actions { opacity: 0.35; transition: opacity var(--t-press) var(--ease-out); }
          tr:hover .row-actions { opacity: 1; }
          .row-actions:focus-within { opacity: 1; }
        }

        /* ── Bulk dock ──
           Dark against a light app is the elevation cue; it reads as a
           layer floating over the table rather than part of it. */
        .dock {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          max-width: 100%;
          padding: 8px 10px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.96);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.3);
          opacity: 1;
          transform: translateY(0);
          transition:
            opacity var(--t-pop) var(--ease-out),
            transform var(--t-pop) var(--ease-out);
        }
        @starting-style {
          .dock { opacity: 0; transform: translateY(12px); }
        }
        .dock-count {
          padding: 3px 8px;
          border-radius: 7px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 12px; font-weight: 700; color: #fff;
          background: var(--brand);
        }
        .dock-sep { width: 1px; height: 16px; background: rgba(255, 255, 255, 0.14); }
        .dock-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 9px;
          border-radius: 9px;
          font-size: 12px; font-weight: 600;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.82);
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid transparent;
          transition:
            transform var(--t-press) var(--ease-out),
            color var(--t-press) var(--ease-out),
            background-color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .dock-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.14); }
          .dock-btn[data-danger='true']:hover { background: rgba(220, 38, 38, 0.24); color: #fecaca; }
        }
        .dock-btn:active { transform: scale(0.97); }

        /* ── Status radio tiles ── */
        .status-choice {
          display: flex; align-items: center; gap: 9px;
          padding: 9px 11px;
          border-radius: 10px;
          cursor: pointer;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
          transition:
            transform var(--t-press) var(--ease-out),
            background-color var(--t-press) var(--ease-out),
            border-color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .status-choice:hover:not([data-active='true']) { border-color: var(--line-strong); }
        }
        .status-choice:active { transform: scale(0.99); }
        .status-choice[data-active='true'] {
          background: var(--brand-soft);
          border-color: var(--brand);
        }

        @media (prefers-reduced-motion: reduce) {
          .dock { transition-duration: 120ms; }
          .dock-btn:active, .status-choice:active { transform: none; }
          .th-sort .caret { transition: opacity var(--t-press) linear; }
        }
      `}</style>
    </div>
  )
}
