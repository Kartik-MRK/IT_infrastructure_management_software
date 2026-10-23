import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { API_BASE_URL } from '../config/api'

// Status tiles: one accent rail each, so the row scans as a single system
const STATUS_TILES = [
  {
    key: 'total', label: 'Total Assets', accent: '#4f46e5',
    value: (m) => m.total,
    hint:  () => 'All registered assets',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>,
  },
  {
    key: 'active', label: 'Operational', accent: '#059669',
    value: (m) => (m.by_status?.active || 0) + (m.by_status?.in_use || 0),
    hint:  (m) => `${m.by_status?.active || 0} active · ${m.by_status?.in_use || 0} in use`,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  },
  {
    key: 'maintenance', label: 'Maintenance', accent: '#d97706',
    value: (m) => m.by_status?.maintenance || 0,
    hint:  () => 'Currently serviced',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>,
  },
  {
    key: 'issues', label: 'Attention', accent: '#dc2626',
    value: (m) => (m.by_status?.damaged || 0) + (m.by_status?.retired || 0),
    hint:  (m) => `${m.by_status?.damaged || 0} damaged · ${m.by_status?.retired || 0} retired`,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  },
]

const TYPE_ROWS = [
  { key: 'hardware',       label: 'Hardware',       color: '#7c3aed' },
  { key: 'software',       label: 'Software',       color: '#4f46e5' },
  { key: 'network',        label: 'Network',        color: '#0891b2' },
  { key: 'infrastructure', label: 'Infrastructure', color: '#ea580c' },
  { key: 'peripherals',    label: 'Peripherals',    color: '#db2777' },
]

function DashboardMetrics() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchMetricsFallback = useCallback(async () => {
    try {
      const { data: assets } = await supabase.from('assets').select('id, status, type')
      if (!assets) return

      const countBy = (field, value) => assets.filter(a => a[field] === value).length
      setMetrics({
        total: assets.length,
        by_status: {
          active:      countBy('status', 'active'),
          in_use:      countBy('status', 'in_use'),
          maintenance: countBy('status', 'maintenance'),
          retired:     countBy('status', 'retired'),
          damaged:     countBy('status', 'damaged'),
        },
        by_type: {
          hardware:       countBy('type', 'hardware'),
          software:       countBy('type', 'software'),
          network:        countBy('type', 'network'),
          infrastructure: countBy('type', 'infrastructure'),
          peripherals:    countBy('type', 'peripherals'),
        },
        incidents: { open: 0, critical: 0 },
      })
    } catch (err) {
      console.error('Metrics fallback error:', err)
    }
  }, [])

  const fetchMetrics = useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('flask_jwt_token')
      let fetched = false

      if (token) {
        try {
          const response = await fetch(`${API_BASE_URL}/assets/summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (response.ok) {
            const data = await response.json()
            setMetrics(data.summary)
            fetched = true
          }
        } catch (apiErr) {
          console.warn('Backend /api/assets/summary offline, falling back to Supabase direct query')
        }
      }

      if (!fetched) await fetchMetricsFallback()
    } catch (error) {
      console.error('Error fetching metrics:', error)
      await fetchMetricsFallback()
    } finally {
      setLoading(false)
    }
  }, [fetchMetricsFallback])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 30000)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="card !py-4">
              <div className="skeleton h-[9px] w-[46%] mb-3.5" />
              <div className="skeleton h-[24px] w-[34%] mb-3" />
              <div className="skeleton h-[9px] w-[62%]" />
            </div>
          ))}
        </div>
        <div className="card">
          <div className="skeleton h-[9px] w-[180px] mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton h-[58px] !rounded-[11px]" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!metrics) return null

  const typeTotal = TYPE_ROWS.reduce((sum, t) => sum + (metrics.by_type?.[t.key] || 0), 0)

  return (
    <div className="flex flex-col gap-5">

      {/* ── Status tiles ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUS_TILES.map(tile => (
          <div key={tile.key} className="card !py-4 relative overflow-hidden" style={{ '--accent': tile.accent }}>
            {/* Accent rail — a 3px edge reads faster than a coloured number */}
            <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: tile.accent }} />

            <div className="flex items-start justify-between gap-2 mb-2.5">
              <p className="metric-label">{tile.label}</p>
              <span style={{ color: tile.accent, opacity: 0.55 }}>{tile.icon}</span>
            </div>
            <p className="metric-value" style={{ color: 'var(--text)' }}>{tile.value(metrics)}</p>
            <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>{tile.hint(metrics)}</p>
          </div>
        ))}
      </div>

      {/* ── Type distribution ── */}
      <div className="card">
        <div className="flex items-baseline justify-between gap-3 mb-4">
          <p className="section-header !mb-0">Asset Distribution by Type</p>
          <span className="text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>{typeTotal} classified</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {TYPE_ROWS.map(({ key, label, color }) => {
            const count = metrics.by_type?.[key] || 0
            const share = typeTotal > 0 ? (count / typeTotal) * 100 : 0
            return (
              <div
                key={key}
                className="rounded-[11px] px-3.5 py-3"
                style={{ background: 'var(--surface-sunk)', border: '1px solid var(--line)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="status-dot" style={{ background: color, '--halo': `${color}26` }} />
                  <p className="text-[11.5px] font-medium truncate" style={{ color: 'var(--text-soft)' }}>{label}</p>
                </div>
                <p className="text-[21px] font-bold leading-none tnum font-mono" style={{ color: 'var(--text)' }}>
                  {count}
                </p>
                {/* Share bar — turns five separate counts into one comparison */}
                <div className="mt-2.5 h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${share}%`,
                      background: color,
                      transition: 'width 420ms var(--ease-out)',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default DashboardMetrics
