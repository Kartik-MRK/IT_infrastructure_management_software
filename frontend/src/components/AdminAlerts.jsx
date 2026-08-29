import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function AdminAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    checkUserRole()
  }, [])

  useEffect(() => {
    if (userRole === 'admin') {
      fetchAlerts()
      
      // Refresh alerts every 15 seconds
      const interval = setInterval(fetchAlerts, 15000)
      
      return () => clearInterval(interval)
    }
  }, [userRole])

  async function checkUserRole() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile) {
          setUserRole(profile.role)
        }
      }
    } catch (error) {
      console.error('Error checking user role:', error)
    }
  }

  async function fetchAlerts() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = localStorage.getItem('token') || localStorage.getItem('flask_jwt_token')
      
      console.log('🔍 AdminAlerts - Debug:', {
        hasSession: !!session,
        hasToken: !!token,
        token: token ? token.substring(0, 20) + '...' : 'null'
      })
      
      if (!session && !token) {
        console.log('⚠️ AdminAlerts - No token or session found')
        return
      }

      const authHeader = `Bearer ${token || session?.access_token}`
      console.log('📤 AdminAlerts - Sending request with auth header')

      const response = await fetch('http://localhost:5000/api/alerts', {
        headers: {
          'Authorization': authHeader
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('📊 AdminAlerts - Received alerts:', data)
        console.log(`   Count: ${data.alerts?.length || 0}`)
        if (data.alerts && data.alerts.length > 0) {
          console.log('   First alert:', data.alerts[0])
        }
        setAlerts(data.alerts || [])
      } else {
        console.error('❌ AdminAlerts - Failed to fetch:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('❌ AdminAlerts - Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Only show to admins
  if (userRole !== 'admin') {
    return null
  }

  if (loading) {
    return (
      <div className="card mb-6 animate-pulse">
        <div className="h-20 bg-gray-200 rounded"></div>
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
                  className="text-xs text-red-700 hover:text-red-900 font-medium"
                >
                  Refresh
                </button>
              </div>
              <div className="space-y-2">
                {criticalAlerts.slice(0, 3).map((alert, index) => (
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
                      <a 
                        href={`/assets/${alert.asset_id}`}
                        className="ml-3 text-xs text-primary-600 hover:text-primary-800 font-medium whitespace-nowrap"
                      >
                        View →
                      </a>
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
                  className="text-xs text-yellow-700 hover:text-yellow-900 font-medium"
                >
                  Refresh
                </button>
              </div>
              <div className="space-y-2">
                {warningAlerts.slice(0, 2).map((alert, index) => (
                  <div key={alert.id} className="bg-white p-2 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{alert.asset_name}</p>
                        <p className="text-xs text-gray-600">{alert.message}</p>
                      </div>
                      <a 
                        href={`/assets/${alert.asset_id}`}
                        className="ml-3 text-xs text-primary-600 hover:text-primary-800 font-medium"
                      >
                        View →
                      </a>
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
