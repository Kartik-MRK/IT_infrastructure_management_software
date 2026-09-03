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

function Dashboard() {
  const navigate = useNavigate()
  const { user, profile, isAdmin, isViewer } = useAuth()
  const [activities, setActivities] = useState([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)

  useEffect(() => {
    fetchActivities()
    
    // Auto-refresh activities every 30 seconds
    const interval = setInterval(fetchActivities, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchActivities() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = localStorage.getItem('token') || session?.access_token
      
      if (!token) {
        setActivitiesLoading(false)
        return
      }

      const response = await fetch('http://localhost:5000/api/activities', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
      } else {
        // Fallback: Fetch directly from Supabase if Flask API is offline
        await fetchActivitiesFallback()
      }
    } catch (err) {
      console.error('Error fetching activities:', err)
      await fetchActivitiesFallback()
    } finally {
      setActivitiesLoading(false)
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
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  function handleAddAssetClick() {
    if (isViewer) {
      toast.error('Viewers have read-only access and cannot add assets.')
      return
    }
    navigate('/assets/new')
  }

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 font-space animate-fade-in space-y-6">
      
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span>⚡</span> Welcome to ITIMS Mission Control
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time infrastructure operations, enterprise asset lifecycle, and SRE velocity telemetry.
          </p>
        </div>
        {profile?.full_name && (
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-2xl shadow-xs">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white font-bold flex items-center justify-center text-xs shadow-xs">
              {(profile.full_name || 'U')[0].toUpperCase()}
            </div>
            <div className="text-left">
              <span className="text-[10px] text-slate-400 font-mono block uppercase">Logged in as</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">{profile.full_name}</span>
            </div>
          </div>
        )}
      </div>

      {/* Admin Alerts */}
      <AdminAlerts />

      {/* Executive Analytics & SRE Command Center */}
      <ExecutiveCommandCenter />

      {/* Dashboard Metrics */}
      <DashboardMetrics />

      {/* Executive Financial & TCO Command Center */}
      <ExecutiveFinancialWidget />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Activities */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Live Audit & Telemetry Feed
              </h3>
            </div>
            <button 
              onClick={fetchActivities}
              className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 font-bold cursor-pointer"
              title="Refresh activities"
            >
              🔄 Refresh
            </button>
          </div>

          {activitiesLoading ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                  <div className="h-8 w-8 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
                  <div className="flex-1 space-y-1">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {activities.map((act) => (
                <Link
                  key={act.id}
                  to={act.link}
                  className="flex items-start justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-slate-950/70 hover:bg-purple-500/5 border border-slate-100 dark:border-slate-800/80 transition-all group"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                      act.type === 'incident'
                        ? act.severity === 'critical'
                          ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                        : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/30'
                    }`}>
                      {act.type === 'incident' ? '🚨' : '🖥️'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                        {act.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {act.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right flex flex-col items-end flex-shrink-0 ml-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                      act.status === 'open' || act.severity === 'critical'
                        ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                        : act.status === 'resolved' || act.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {act.status || act.severity}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono mt-1">
                      {formatTimeAgo(act.timestamp)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs">
              No recent activities recorded.
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card space-y-4">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Operational Short-Cuts
            </h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handleAddAssetClick}
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-purple-500 bg-slate-50/50 dark:bg-slate-950/50 hover:bg-purple-500/5 transition-all group cursor-pointer text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform">
                ➕
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">Register Asset</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Hardware / software</span>
            </button>

            <button 
              onClick={() => navigate('/incidents/report')}
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-rose-500 bg-slate-50/50 dark:bg-slate-950/50 hover:bg-rose-500/5 transition-all group cursor-pointer text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform">
                🚨
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">Report Outage</span>
              <span className="text-[10px] text-slate-400 mt-0.5">SLA response queue</span>
            </button>

            <button 
              onClick={() => navigate('/incidents')}
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 bg-slate-50/50 dark:bg-slate-950/50 hover:bg-amber-500/5 transition-all group cursor-pointer text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform">
                📋
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">Incident Board</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Track & resolve tickets</span>
            </button>

            <button 
              onClick={() => navigate(profile?.role === 'admin' ? '/users' : '/assets')}
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-950/50 hover:bg-indigo-500/5 transition-all group cursor-pointer text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform">
                {profile?.role === 'admin' ? '👑' : '🖥️'}
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {profile?.role === 'admin' ? 'Enterprise RBAC' : 'Asset Inventory'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                {profile?.role === 'admin' ? 'Manage roles & access' : 'View topology & assets'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

export default Dashboard
