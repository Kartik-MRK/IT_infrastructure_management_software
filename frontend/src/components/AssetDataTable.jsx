import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

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
        vA = Number(vA) || 0
        vB = Number(vB) || 0
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
        if (isTyping) {
          activeEl.blur()
        } else {
          setSelectedIds(new Set())
          setSearchQuery('')
        }
        return
      }

      if (isTyping) return

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
  }, [filteredAssets, focusedIndex, navigate])

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
      const res = await fetch('http://localhost:5000/api/assets/bulk-status', {
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
      const res = await fetch('http://localhost:5000/api/assets/bulk-delete', {
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
      a.purchase_cost ?? 0,
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

  // Row Styling by Density
  const densityStyles = {
    compact: {
      row: 'h-8 text-xs',
      cell: 'py-1 px-3',
      badge: 'px-1.5 py-0.2 text-[10px]'
    },
    normal: {
      row: 'h-12 text-xs',
      cell: 'py-3 px-4',
      badge: 'px-2.5 py-0.5 text-xs'
    },
    comfortable: {
      row: 'h-16 text-sm',
      cell: 'py-4 px-5',
      badge: 'px-3 py-1 text-xs'
    }
  }[density]

  const getStatusColor = (st) => {
    switch (st) {
      case 'active': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      case 'maintenance': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
      case 'damaged': return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
      case 'in_use': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
      default: return 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
    }
  }

  const getTypeColor = (tp) => {
    switch (tp) {
      case 'hardware': return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
      case 'software': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
      case 'network': return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
      default: return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30'
    }
  }

  return (
    <div className="space-y-4 font-space">
      
      {/* Control Bar: Presets, Search, Density & Columns */}
      <div className="card !p-4 border border-gray-200 dark:border-slate-800 shadow-sm space-y-3">
        
        {/* Row 1: Presets & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Quick Filter Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {[
              { id: 'all', label: 'All Assets', icon: '📋' },
              { id: 'maintenance', label: 'Degraded / Issues', icon: '🔥' },
              { id: 'hardware', label: 'Hardware & Infra', icon: '🖥️' },
              { id: 'software', label: 'Software', icon: '📦' },
              { id: 'network', label: 'Network', icon: '🌐' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  preset === p.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-slate-800/80 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{p.icon}</span> {p.label}
              </button>
            ))}
          </div>

          {/* Right Controls: Density Selector & Column Picker */}
          <div className="flex items-center gap-2">
            
            {/* Density Selector */}
            <div className="flex items-center bg-gray-100 dark:bg-slate-800/80 p-1 rounded-xl border border-gray-200 dark:border-slate-700/60">
              <span className="text-[10px] text-gray-400 px-2 font-bold uppercase">Density:</span>
              {[
                { id: 'compact', label: 'Compact', icon: '☷' },
                { id: 'normal', label: 'Normal', icon: '☰' },
                { id: 'comfortable', label: 'Roomy', icon: '☲' }
              ].map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDensity(d.id)}
                  title={`Row Density: ${d.label}`}
                  className={`px-2 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                    density === d.id
                      ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {d.icon}
                </button>
              ))}
            </div>

            {/* Column Visibility Picker Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsColMenuOpen(prev => !prev)}
                className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800/80 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-gray-200 dark:border-slate-700/60 flex items-center gap-1.5 cursor-pointer"
              >
                <span>⚙️</span> Columns
              </button>

              {isColMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-30 animate-fade-in space-y-2">
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1 pb-1 border-b border-gray-100 dark:border-slate-800">
                    Toggle Columns
                  </div>
                  {Object.keys(defaultCols).map(colKey => (
                    <label key={colKey} className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 p-1.5 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleCols[colKey] ?? true}
                        onChange={() => toggleColumn(colKey)}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span className="capitalize">{colKey.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Row 2: Search Input & Keyboard Hints */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-slate-800/80">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search assets by name, serial #, location, type... (Press '/' to focus)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono transition-all"
            />
            <span className="absolute left-3 top-2.5 text-xs text-gray-400">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 text-xs text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-400 font-mono">
            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700">/</span> search
            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 ml-1">j/k</span> move
            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 ml-1">x</span> select
            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 ml-1">Enter</span> open
          </div>
        </div>

      </div>

      {/* Main Table Container */}
      <div ref={tableRef} className="card !p-0 overflow-hidden border border-gray-200 dark:border-slate-800 shadow-sm relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                
                {/* Select All Checkbox */}
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredAssets.length && filteredAssets.length > 0}
                    onChange={handleSelectAll}
                    className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                </th>

                {visibleCols.name && (
                  <th
                    onClick={() => { setSortField('name'); setSortAsc(!sortAsc) }}
                    className="py-2.5 px-4 cursor-pointer hover:text-purple-600 transition-colors"
                  >
                    Asset Name {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                )}

                {visibleCols.type && (
                  <th
                    onClick={() => { setSortField('type'); setSortAsc(!sortAsc) }}
                    className="py-2.5 px-4 cursor-pointer hover:text-purple-600 transition-colors"
                  >
                    Type {sortField === 'type' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                )}

                {visibleCols.status && (
                  <th
                    onClick={() => { setSortField('status'); setSortAsc(!sortAsc) }}
                    className="py-2.5 px-4 cursor-pointer hover:text-purple-600 transition-colors"
                  >
                    Status {sortField === 'status' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                )}

                {visibleCols.location && <th className="py-2.5 px-4">Location</th>}
                {visibleCols.serial_number && <th className="py-2.5 px-4">Serial Number</th>}
                {visibleCols.purchase_cost && (
                  <th
                    onClick={() => { setSortField('purchase_cost'); setSortAsc(!sortAsc) }}
                    className="py-2.5 px-4 cursor-pointer hover:text-purple-600 transition-colors"
                  >
                    Cost {sortField === 'purchase_cost' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                )}
                {visibleCols.creator && <th className="py-2.5 px-4">Created By</th>}
                {visibleCols.created_at && (
                  <th
                    onClick={() => { setSortField('created_at'); setSortAsc(!sortAsc) }}
                    className="py-2.5 px-4 cursor-pointer hover:text-purple-600 transition-colors"
                  >
                    Date Added {sortField === 'created_at' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                )}
                {visibleCols.actions && <th className="py-2.5 px-4 text-right">Actions</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={10} className="py-4 px-4">
                      <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs text-gray-500 dark:text-slate-400">
                    No assets found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset, index) => {
                  const isSelected = selectedIds.has(asset.id)
                  const isFocused = focusedIndex === index

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => setFocusedIndex(index)}
                      className={`transition-colors cursor-pointer ${densityStyles.row} ${
                        isSelected
                          ? 'bg-purple-500/10 dark:bg-purple-950/30'
                          : isFocused
                            ? 'bg-blue-50 dark:bg-slate-900/90 ring-1 ring-inset ring-blue-500/30'
                            : 'hover:bg-gray-50 dark:hover:bg-slate-900/50'
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className={`${densityStyles.cell} text-center`} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(asset.id)}
                          className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>

                      {/* Name */}
                      {visibleCols.name && (
                        <td className={`${densityStyles.cell} font-bold text-gray-900 dark:text-white`}>
                          <button
                            type="button"
                            onClick={() => navigate(`/assets/${asset.id}`)}
                            className="hover:text-purple-600 dark:hover:text-purple-400 text-left cursor-pointer truncate max-w-xs block"
                          >
                            {asset.name}
                          </button>
                        </td>
                      )}

                      {/* Type */}
                      {visibleCols.type && (
                        <td className={densityStyles.cell}>
                          <span className={`inline-block font-mono font-bold uppercase rounded-lg border ${densityStyles.badge} ${getTypeColor(asset.type)}`}>
                            {asset.type}
                          </span>
                        </td>
                      )}

                      {/* Status */}
                      {visibleCols.status && (
                        <td className={densityStyles.cell}>
                          <span className={`inline-block font-mono font-bold uppercase rounded-lg border ${densityStyles.badge} ${getStatusColor(asset.status)}`}>
                            {asset.status}
                          </span>
                        </td>
                      )}

                      {/* Location */}
                      {visibleCols.location && (
                        <td className={`${densityStyles.cell} text-gray-600 dark:text-slate-400 truncate max-w-[120px]`}>
                          {asset.location || '—'}
                        </td>
                      )}

                      {/* Serial Number */}
                      {visibleCols.serial_number && (
                        <td className={`${densityStyles.cell} font-mono text-gray-500 dark:text-slate-400 truncate max-w-[120px]`}>
                          {asset.serial_number || '—'}
                        </td>
                      )}

                      {/* Purchase Cost */}
                      {visibleCols.purchase_cost && (
                        <td className={`${densityStyles.cell} font-mono font-semibold text-gray-800 dark:text-slate-200`}>
                          {asset.purchase_cost ? `$${Number(asset.purchase_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                      )}

                      {/* Creator */}
                      {visibleCols.creator && (
                        <td className={`${densityStyles.cell} text-gray-600 dark:text-slate-400 truncate max-w-[120px]`}>
                          {asset.creator?.full_name || 'System'}
                        </td>
                      )}

                      {/* Created At */}
                      {visibleCols.created_at && (
                        <td className={`${densityStyles.cell} font-mono text-gray-500 dark:text-slate-400 whitespace-nowrap`}>
                          {new Date(asset.created_at).toLocaleDateString()}
                        </td>
                      )}

                      {/* Actions */}
                      {visibleCols.actions && (
                        <td className={`${densityStyles.cell} text-right space-x-2 whitespace-nowrap`} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => navigate(`/assets/${asset.id}`)}
                            className="text-purple-600 dark:text-purple-400 hover:underline font-bold text-xs cursor-pointer"
                          >
                            View
                          </button>
                          {canEditAsset && canEditAsset(asset.created_by) && (
                            <button
                              type="button"
                              onClick={() => navigate(`/assets/${asset.id}/edit`)}
                              className="text-amber-600 dark:text-amber-400 hover:underline font-bold text-xs cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                          {canDeleteAsset && canDeleteAsset(asset.created_by) && (
                            <button
                              type="button"
                              onClick={() => onDeleteAsset && onDeleteAsset(asset.id, asset.created_by)}
                              className="text-rose-600 dark:text-rose-400 hover:underline font-bold text-xs cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bottom Bulk Action Dock */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 animate-slide-up">
          <div className="bg-slate-900/95 backdrop-blur-md border border-purple-500/40 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 flex-wrap max-w-4xl">
            
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-purple-600 rounded-lg text-xs font-mono font-bold">
                {selectedIds.size} Selected
              </span>
            </div>

            <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsBulkStatusModalOpen(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded-xl text-xs font-bold border border-purple-500/30 transition-all cursor-pointer"
              >
                ⚡ Set Status
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-xl text-xs font-bold border border-emerald-500/30 transition-all cursor-pointer"
              >
                📥 Export CSV
              </button>

              <button
                type="button"
                onClick={handleExportJSON}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-bold border border-cyan-500/30 transition-all cursor-pointer"
              >
                📥 Export JSON
              </button>

              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-900 text-rose-300 rounded-xl text-xs font-bold border border-rose-500/30 transition-all cursor-pointer"
              >
                🗑️ Delete
              </button>
            </div>

            <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-slate-400 hover:text-white cursor-pointer ml-auto"
            >
              ✕ Clear
            </button>
          </div>
        </div>
      )}

      {/* Bulk Status Update Modal */}
      {isBulkStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-space">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-white">
            <h4 className="text-base font-bold text-white mb-1">
              Bulk Status Update ({selectedIds.size} Assets)
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Select the new operational lifecycle status to apply across all selected assets.
            </p>

            <div className="space-y-2 mb-6">
              {[
                { id: 'active', label: 'Active (Operational)', icon: '🟢' },
                { id: 'in_use', label: 'In Use (Assigned)', icon: '🔵' },
                { id: 'maintenance', label: 'Maintenance (Under Repair)', icon: '🟡' },
                { id: 'retired', label: 'Retired (Decommissioned)', icon: '⚪' },
                { id: 'damaged', label: 'Damaged (Faulty)', icon: '🔴' }
              ].map(st => (
                <label
                  key={st.id}
                  onClick={() => setBulkStatus(st.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    bulkStatus === st.id
                      ? 'bg-purple-600/20 border-purple-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span>{st.icon}</span> {st.label}
                  </div>
                  <input
                    type="radio"
                    name="bulkStatus"
                    checked={bulkStatus === st.id}
                    onChange={() => setBulkStatus(st.id)}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBulkStatusModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkUpdating}
                onClick={handleBulkStatusSubmit}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {isBulkUpdating ? 'Updating...' : 'Apply Status Change'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
