import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardMetrics from '../components/DashboardMetrics'
import AdminAlerts from '../components/AdminAlerts'
import ExecutiveFinancialWidget from '../components/ExecutiveFinancialWidget'
import ExecutiveCommandCenter from '../components/ExecutiveCommandCenter'
import toast from 'react-hot-toast'
import './Dashboard.css'

const STATUS_TONE = {
  open:        { fg: 'var(--danger)',  bg: 'var(--danger-soft)',  line: 'var(--danger-line)'  },
  in_progress: { fg: 'var(--warn)',    bg: 'var(--warn-soft)',    line: 'var(--warn-line)'    },
  resolved:    { fg: 'var(--ok)',      bg: 'var(--ok-soft)',      line: 'var(--ok-line)'      },
  closed:      { fg: 'var(--neutral)', bg: 'var(--neutral-soft)', line: 'var(--neutral-line)' },
}

function Dashboard() {
  const navigate = useNavigate()
  const { profile, isAdmin, isViewer } = useAuth()
  const [activities, setActivities] = useState([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchActivities()
    const interval = setInterval(fetchActivities, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchActivities({ manual = false } = {}) {
    if (manual) setRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = localStorage.getItem('token') || session?.access_token

      if (!token) {
        setActivitiesLoading(false)
        return
      }

      const response = await fetch('http://localhost:5000/api/activities', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
      } else {
        // Fallback: fetch directly from Supabase if Flask API is offline
        await fetchActivitiesFallback()
      }
    } catch (err) {
      console.error('Error fetching activities:', err)
      await fetchActivitiesFallback()
    } finally {
      setActivitiesLoading(false)
      // Hold the spinner briefly so a sub-100ms response still reads as an
      // action that happened, rather than a flicker.
      if (manual) setTimeout(() => setRefreshing(false), 420)
    }
  }

  async function fetchActivitiesFallback() {
    try {
      const fallbackList = []

      const { data: incidents } = await supabase
        .from('incidents')
        .select('id, title, severity, status, created_at')
        .order('created_at', { ascending: false })
        .limit(4)

      if (incidents) {
        incidents.forEach(inc => {
          fallbackList.push({
            id: `inc_${inc.id}`,
            type: 'incident',
            title: inc.title,
            severity: inc.severity,
            status: inc.status,
            description: `Incident reported with ${inc.severity} severity`,
            timestamp: inc.created_at,
            link: '/incidents'
          })
        })
      }

      const { data: assets } = await supabase
        .from('assets')
        .select('id, name, type, status, created_at')
        .order('created_at', { ascending: false })
        .limit(4)

      if (assets) {
        assets.forEach(asset => {
          fallbackList.push({
            id: `asset_${asset.id}`,
            type: 'asset',
            title: asset.name,
            severity: 'info',
            status: asset.status,
            description: `Registered as ${asset.type} asset`,
            timestamp: asset.created_at,
            link: `/assets/${asset.id}`
          })
        })
      }

      fallbackList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      setActivities(fallbackList.slice(0, 8))
    } catch (fallbackErr) {
      console.error('Activities fallback error:', fallbackErr)
    }
  }

  function formatTimeAgo(dateString) {
    if (!dateString) return 'Recent'
    const date = new Date(dateString)
    const diffMins  = Math.floor((new Date() - date) / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays  = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  function handleAddAssetClick() {
    if (isViewer) {
      toast.error('Viewers have read-only access and cannot add assets.')
      return
    }
    navigate('/assets/new')
  }

  const quickActions = [
    {
      label: 'Register Asset', sub: 'Hardware / software', color: '#4f46e5',
      onClick: handleAddAssetClick,
      icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    },
    {
      label: 'Report Incident', sub: 'SLA response queue', color: '#dc2626',
      onClick: () => navigate('/incidents/report'),
      icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    },
    {
      label: 'Incident Board', sub: 'Track & resolve tickets', color: '#d97706',
      onClick: () => navigate('/incidents'),
      icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
    },
    {
      label: isAdmin ? 'User Management' : 'Asset Inventory',
      sub: isAdmin ? 'Roles & permissions' : 'View all assets',
      color: '#7c3aed',
      onClick: () => navigate(isAdmin ? '/users' : '/assets'),
      icon: isAdmin
        ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
    },
  ]

  return (
    <main className="max-w-[1400px] mx-auto py-7 px-4 sm:px-6 lg:px-8 animate-fade-in flex flex-col gap-6">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">
            {profile?.full_name ? `Good to see you, ${profile.full_name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="page-subtitle">Infrastructure health, incident queue, and asset lifecycle overview.</p>
        </div>
      </div>

      <AdminAlerts />
      <ExecutiveCommandCenter />
      <DashboardMetrics />
      <ExecutiveFinancialWidget />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Live activity feed ── */}
        <section className="card-flush flex flex-col">
          <div className="card-header">
            <p className="section-header !mb-0">Live Activity Feed</p>
            <button
              onClick={() => fetchActivities({ manual: true })}
              className="btn btn-ghost btn-sm dash-refresh"
              title="Refresh"
            >
              <span className={refreshing ? 'animate-spin-fast' : undefined} style={{ display: 'inline-flex' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
              </span>
              Refresh
            </button>
          </div>

          <div className="p-2.5">
            {activitiesLoading ? (
              <div className="flex flex-col gap-1.5">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="skeleton w-[26px] h-[26px] !rounded-lg shrink-0" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="skeleton h-[11px]" style={{ width: `${68 - i * 6}%` }} />
                      <div className="skeleton h-[9px]" style={{ width: `${44 - i * 4}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length > 0 ? (
              <div className="flex flex-col stagger" style={{ maxHeight: 372, overflowY: 'auto' }}>
                {activities.map((act) => {
                  const isIncident = act.type === 'incident'
                  const critical = act.severity === 'critical'
                  const tone = STATUS_TONE[act.status] ?? STATUS_TONE.closed
                  return (
                    <Link key={act.id} to={act.link} className="activity-row">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className="w-[26px] h-[26px] rounded-lg shrink-0 flex items-center justify-center"
                          style={{
                            background: isIncident ? (critical ? 'var(--danger-soft)' : 'var(--warn-soft)') : 'var(--brand-soft)',
                            border: `1px solid ${isIncident ? (critical ? 'var(--danger-line)' : 'var(--warn-line)') : 'var(--brand-line)'}`,
                          }}
                        >
                          {isIncident ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={critical ? 'var(--danger)' : 'var(--warn)'} strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-semibold leading-snug truncate" style={{ color: 'var(--text)' }}>
                            {act.title}
                          </p>
                          <p className="text-[11px] leading-snug truncate mt-[2px]" style={{ color: 'var(--text-muted)' }}>
                            {act.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span
                          className="badge-code"
                          style={{ color: tone.fg, background: tone.bg, borderColor: tone.line }}
                        >
                          {(act.status || act.severity || '').replace('_', ' ')}
                        </span>
                        <span className="text-[11px] font-mono w-[30px] text-right" style={{ color: 'var(--text-faint)' }}>
                          {formatTimeAgo(act.timestamp)}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <p className="empty-state-title">No recent activity</p>
                <p className="empty-state-text">Asset registrations and incident reports will appear here.</p>
              </div>
            )}
          </div>
        </section>

        {/* ── Quick actions ── */}
        <section className="card">
          <p className="section-header">Quick Actions</p>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map(({ label, sub, color, onClick, icon }) => (
              <button key={label} onClick={onClick} className="quick-action" style={{ '--qa': color }}>
                <span className="quick-action-icon">{icon}</span>
                <span className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>{label}</span>
                <span className="text-[11px] mt-[3px]" style={{ color: 'var(--text-muted)' }}>{sub}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Hover and press states live in CSS: a JS onMouseEnter handler cannot
          express :active, and cannot be gated behind a pointer query. */}
      <style>{`
        .activity-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 9px 11px;
          border-radius: 10px;
          text-decoration: none;
          transition:
            background-color var(--t-press) var(--ease-out),
            transform var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .activity-row:hover { background-color: var(--surface-hover); }
        }
        .activity-row:active { transform: scale(0.99); }

        .dash-refresh { color: var(--brand); font-weight: 600; }
        @media (hover: hover) and (pointer: fine) {
          .dash-refresh:hover { background-color: var(--brand-soft); color: var(--brand-hover); }
        }

        .quick-action {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 16px 12px;
          border-radius: 12px;
          cursor: pointer;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
          transition:
            transform var(--t-pop) var(--ease-out),
            background-color var(--t-pop) var(--ease-out),
            border-color var(--t-pop) var(--ease-out),
            box-shadow var(--t-pop) var(--ease-out);
        }
        .quick-action-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 11px;
          margin-bottom: 8px;
          color: var(--qa);
          background: color-mix(in srgb, var(--qa) 10%, transparent);
          transition: transform var(--t-pop) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .quick-action:hover {
            transform: translateY(-2px);
            background: var(--surface);
            border-color: var(--qa);
            box-shadow: 0 4px 14px color-mix(in srgb, var(--qa) 18%, transparent);
          }
          .quick-action:hover .quick-action-icon { transform: scale(1.08); }
        }
        .quick-action:active { transform: translateY(0) scale(0.975); }

        @media (prefers-reduced-motion: reduce) {
          .quick-action:hover { transform: none; }
          .quick-action:hover .quick-action-icon { transform: none; }
          .quick-action:active,
          .activity-row:active { transform: none; }
        }
      `}</style>
    </main>
  )
}

export default Dashboard
