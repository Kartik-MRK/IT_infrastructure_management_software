import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function AdminAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
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

  async function fetchAlerts() {
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
    return (
      <div className="card mb-6 animate-pulse">
        <div className="h-16 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="card mb-6 bg-green-50 border-l-4 border-green-500">
        <div className="flex items-center">
          <svg className="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-green-800">All Systems Operational</h3>
            <p className="text-xs text-green-700">No critical alerts at this time</p>
          </div>
        </div>
      </div>
    )
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  const warningAlerts = alerts.filter(a => a.severity === 'warning')

  return (
    <div className="mb-6 space-y-4">
      {/* Critical Alerts */}
      {criticalAlerts.length > 0 && (
        <div className="card bg-red-50 border-l-4 border-red-600">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-red-900">
                  🚨 Critical Alerts ({criticalAlerts.length})
                </h3>
                <button 
                  onClick={fetchAlerts}
                  className="text-xs text-red-700 hover:text-red-900 font-medium cursor-pointer"
                >
                  Refresh
                </button>
              </div>
              <div className="space-y-2">
                {criticalAlerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className="bg-white p-3 rounded-lg shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{alert.asset_name}</p>
                        <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
                        <div className="flex items-center mt-2 space-x-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            {alert.asset_type}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <Link 
                        to={`/assets/${alert.asset_id}`}
                        className="ml-3 text-xs text-primary-600 hover:text-primary-800 font-medium whitespace-nowrap"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                ))}
                {criticalAlerts.length > 3 && (
                  <p className="text-xs text-red-700 text-center mt-2">
                    + {criticalAlerts.length - 3} more critical alerts
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning Alerts */}
      {warningAlerts.length > 0 && (
        <div className="card bg-yellow-50 border-l-4 border-yellow-500">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-yellow-900">
                  ⚠️ Warnings ({warningAlerts.length})
                </h3>
                <button 
                  onClick={fetchAlerts}
                  className="text-xs text-yellow-700 hover:text-yellow-900 font-medium cursor-pointer"
                >
                  Refresh
                </button>
              </div>
              <div className="space-y-2">
                {warningAlerts.slice(0, 2).map((alert) => (
                  <div key={alert.id} className="bg-white p-2 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{alert.asset_name}</p>
                        <p className="text-xs text-gray-600">{alert.message}</p>
                      </div>
                      <Link 
                        to={`/assets/${alert.asset_id}`}
                        className="ml-3 text-xs text-primary-600 hover:text-primary-800 font-medium"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                ))}
                {warningAlerts.length > 2 && (
                  <p className="text-xs text-yellow-700 text-center mt-2">
                    + {warningAlerts.length - 2} more warnings
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminAlerts
