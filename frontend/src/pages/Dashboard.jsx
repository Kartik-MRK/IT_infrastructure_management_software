import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardMetrics from '../components/DashboardMetrics'
import AdminAlerts from '../components/AdminAlerts'
import toast from 'react-hot-toast'
import './Dashboard.css'

function Dashboard() {
  const navigate = useNavigate()
  const { profile, isAdmin, isViewer } = useAuth()
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
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to ITIMS Dashboard
          </h2>
          <p className="text-gray-600">
            Manage your IT infrastructure efficiently
          </p>
        </div>

        {/* Admin Alerts */}
        <AdminAlerts />

        {/* Dashboard Metrics */}
        <DashboardMetrics />

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="mr-2">⚡</span> Live Activities
              </h3>
              <button 
                onClick={fetchActivities}
                className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                title="Refresh activities"
              >
                Refresh
              </button>
            </div>

            {activitiesLoading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {activities.map((act) => (
                  <Link
                    key={act.id}
                    to={act.link}
                    className="flex items-start justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors group"
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                        act.type === 'incident'
                          ? act.severity === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {act.type === 'incident' ? '🚨' : '🖥️'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 group-hover:text-primary-600 transition-colors">
                          {act.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {act.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end flex-shrink-0 ml-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        act.status === 'open' || act.severity === 'critical'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : act.status === 'resolved' || act.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {act.status || act.severity}
                      </span>
                      <span className="text-[11px] text-gray-400 mt-1">
                        {formatTimeAgo(act.timestamp)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No recent activities recorded</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={handleAddAssetClick}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all text-left group"
              >
                <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">➕</span>
                <span className="text-sm font-semibold text-gray-800">Add Asset</span>
                <span className="text-xs text-gray-500 mt-0.5">Register new hardware/software</span>
              </button>

              <button 
                onClick={() => navigate('/incidents/report')}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-red-500 hover:bg-red-50 transition-all text-left group"
              >
                <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">🚨</span>
                <span className="text-sm font-semibold text-gray-800">Report Incident</span>
                <span className="text-xs text-gray-500 mt-0.5">Submit a critical issue</span>
              </button>

              <button 
                onClick={() => navigate('/incidents')}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition-all text-left group"
              >
                <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📋</span>
                <span className="text-sm font-semibold text-gray-800">View Incidents</span>
                <span className="text-xs text-gray-500 mt-0.5">Track and resolve tickets</span>
              </button>

              <button 
                onClick={() => navigate(profile?.role === 'admin' ? '/users' : '/assets')}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group"
              >
                <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                  {profile?.role === 'admin' ? '👑' : '🖥️'}
                </span>
                <span className="text-sm font-semibold text-gray-800">
                  {profile?.role === 'admin' ? 'User Management' : 'Browse Assets'}
                </span>
                <span className="text-xs text-gray-500 mt-0.5">
                  {profile?.role === 'admin' ? 'Manage roles & access' : 'Full infrastructure inventory'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>
  )
}

export default Dashboard
