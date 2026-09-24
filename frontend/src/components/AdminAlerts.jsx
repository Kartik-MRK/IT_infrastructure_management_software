import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TONE = {
  critical: { label: 'Critical', accent: 'var(--danger)', soft: 'var(--danger-soft)', line: 'var(--danger-line)', badge: 'badge-danger' },
  warning:  { label: 'Warnings', accent: 'var(--warn)',   soft: 'var(--warn-soft)',   line: 'var(--warn-line)',   badge: 'badge-warning' },
}

const AlertTriangle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

// Critical and warning blocks were two near-identical 50-line copies, so any
// fix to one silently skipped the other. One component, driven by tone.
function AlertGroup({ tone, alerts, initialCount }) {
  const [expanded, setExpanded] = useState(false)
  const t = TONE[tone]
  const shown = expanded ? alerts : alerts.slice(0, initialCount)
  const hidden = alerts.length - shown.length

  return (
    <div className="alert-group" style={{ '--accent': t.accent, background: t.soft, borderColor: t.line }}>
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="glyph" style={{ color: t.accent }}><AlertTriangle /></span>
          <h3 className="text-[13px] font-bold m-0" style={{ color: t.accent }}>
            {t.label}
          </h3>
          <span className={`${t.badge} tnum`}>{alerts.length}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {shown.map(alert => (
          <div key={alert.id} className="alert-row">
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold m-0 truncate" style={{ color: 'var(--text)' }}>
                {alert.asset_name}
              </p>
              <p className="text-[11.5px] mt-0.5 mb-0" style={{ color: 'var(--text-muted)' }}>
                {alert.message}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="badge-neutral">{alert.asset_type}</span>
                <span className="text-[10.5px] tnum" style={{ color: 'var(--text-faint)' }}>
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <Link to={`/assets/${alert.asset_id}`} className="btn-ghost btn-sm shrink-0">
              Open
              <Chevron />
            </Link>
          </div>
        ))}

        {/* Was dead text saying "+ N more" with no way to reach them. */}
        {(hidden > 0 || expanded) && (
          <button type="button" onClick={() => setExpanded(!expanded)} className="btn-ghost btn-sm self-center">
            {expanded ? 'Show fewer' : `Show ${hidden} more`}
          </button>
        )}
      </div>
    </div>
  )
}

function AdminAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { isAdmin, isOperator } = useAuth()

  useEffect(() => {
    if (isAdmin || isOperator) {
      fetchAlerts()

      // Refresh alerts every 15 seconds
      const interval = setInterval(fetchAlerts, 15000)
      return () => clearInterval(interval)
    } else {
      setLoading(false)
    }
  }, [isAdmin, isOperator])

  async function fetchAlerts(manual = false) {
    if (manual) setRefreshing(true)
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('flask_jwt_token')

      let fetched = false

      if (token) {
        try {
          const response = await fetch('http://localhost:5000/api/alerts', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })

          if (response.ok) {
            const data = await response.json()
            setAlerts(data.alerts || [])
            fetched = true
          }
        } catch (apiErr) {
          console.warn('Backend /api/alerts offline, falling back to Supabase direct query')
        }
      }

      // Supabase direct query fallback
      if (!fetched) {
        await fetchAlertsFallback()
      }
    } catch (error) {
      console.error('Error in fetchAlerts:', error)
      await fetchAlertsFallback()
    } finally {
      setLoading(false)
      if (manual) setRefreshing(false)
    }
  }

  async function fetchAlertsFallback() {
    try {
      const { data: criticalMetrics } = await supabase
        .from('asset_metrics')
        .select(`
          id, asset_id, health_status, last_updated,
          cpu_usage, memory_usage, temperature, disk_usage,
          asset:asset_id(id, name, type, status)
        `)
        .eq('health_status', 'critical')
        .order('last_updated', { ascending: false })
        .limit(5)

      const alertsList = []

      if (criticalMetrics) {
        criticalMetrics.forEach(m => {
          const assetName = m.asset?.name || 'Unknown Asset'
          const assetType = m.asset?.type || 'hardware'
          let msg = 'Metrics critical'
          const issues = []
          if (m.cpu_usage > 90) issues.push(`CPU: ${m.cpu_usage}%`)
          if (m.memory_usage > 90) issues.push(`Memory: ${m.memory_usage}%`)
          if (m.temperature > 75) issues.push(`Temp: ${m.temperature}°C`)
          if (m.disk_usage > 80) issues.push(`Disk: ${m.disk_usage}%`)
          if (issues.length) msg = `Critical - ${issues.join(', ')}`

          alertsList.push({
            id: m.id,
            severity: 'critical',
            asset_id: m.asset_id,
            asset_name: assetName,
            asset_type: assetType,
            message: msg,
            timestamp: m.last_updated
          })
        })
      }

      setAlerts(alertsList)
    } catch (fallbackErr) {
      console.error('Alerts fallback error:', fallbackErr)
    }
  }

  // Only show to admins and operators
  if (!isAdmin && !isOperator) {
    return null
  }

  if (loading) {
    return <div className="skeleton" style={{ height: 78, borderRadius: 14, marginBottom: 24 }} />
  }

  if (alerts.length === 0) {
    return (
      <div className="all-clear">
        <span className="glyph" style={{ color: 'var(--ok)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </span>
        <div>
          <h3 className="text-[13px] font-bold m-0" style={{ color: 'var(--ok)' }}>All systems operational</h3>
          <p className="text-[11.5px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>
            No critical thresholds crossed. Re-checked every 15 seconds.
          </p>
        </div>
        <style>{ALERT_CSS}</style>
      </div>
    )
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  const warningAlerts = alerts.filter(a => a.severity === 'warning')

  return (
    <div className="flex flex-col gap-3" style={{ marginBottom: 24 }}>
      {/* One refresh control for the whole block — there used to be an
          identical button inside each severity group. */}
      <div className="flex items-center justify-end">
        <button type="button" onClick={() => fetchAlerts(true)} disabled={refreshing} className="btn-ghost btn-sm">
          {refreshing && (
            <span
              className="animate-spin-fast rounded-full"
              style={{ width: 11, height: 11, border: '1.5px solid var(--line-strong)', borderTopColor: 'var(--text-soft)' }}
            />
          )}
          {refreshing ? 'Refreshing…' : 'Refresh alerts'}
        </button>
      </div>

      {criticalAlerts.length > 0 && <AlertGroup tone="critical" alerts={criticalAlerts} initialCount={3} />}
      {warningAlerts.length > 0 && <AlertGroup tone="warning" alerts={warningAlerts} initialCount={2} />}

      <style>{ALERT_CSS}</style>
    </div>
  )
}

const ALERT_CSS = `
  .alert-group {
    position: relative;
    overflow: hidden;
    padding: 14px 16px 14px 18px;
    border-radius: 14px;
    border: 1px solid;
  }
  .alert-group::before {
    content: '';
    position: absolute; top: 0; left: 0; bottom: 0;
    width: 3px;
    background: var(--accent);
  }

  .glyph {
    display: inline-flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    width: 26px; height: 26px;
    border-radius: 8px;
    background: var(--surface);
    border: 1px solid currentColor;
  }

  .alert-row {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 9px 10px;
    border-radius: 11px;
    background: var(--surface);
    border: 1px solid var(--line);
    transition: border-color var(--t-press) var(--ease-out);
  }
  @media (hover: hover) and (pointer: fine) {
    .alert-row:hover { border-color: var(--line-strong); }
  }

  .all-clear {
    display: flex; align-items: center; gap: 11px;
    margin-bottom: 24px;
    padding: 13px 16px;
    border-radius: 14px;
    background: var(--ok-soft);
    border: 1px solid var(--ok-line);
  }
`

export default AdminAlerts
