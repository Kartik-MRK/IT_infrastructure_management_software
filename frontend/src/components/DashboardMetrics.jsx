import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function DashboardMetrics() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
    
    // Refresh metrics every 30 seconds
    const interval = setInterval(fetchMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchMetrics() {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('flask_jwt_token')
      let fetched = false

      if (token) {
        try {
          const response = await fetch('http://localhost:5000/api/assets/summary', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
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

      if (!fetched) {
        await fetchMetricsFallback()
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
      await fetchMetricsFallback()
    } finally {
      setLoading(false)
    }
  }

  async function fetchMetricsFallback() {
    try {
      const { data: assets } = await supabase
        .from('assets')
        .select('id, status, type')

      if (assets) {
        const summary = {
          total: assets.length,
          by_status: {
            active: assets.filter(a => a.status === 'active').length,
            in_use: assets.filter(a => a.status === 'in_use').length,
            maintenance: assets.filter(a => a.status === 'maintenance').length,
            retired: assets.filter(a => a.status === 'retired').length,
            damaged: assets.filter(a => a.status === 'damaged').length,
          },
          by_type: {
            hardware: assets.filter(a => a.type === 'hardware').length,
            software: assets.filter(a => a.type === 'software').length,
            network: assets.filter(a => a.type === 'network').length,
            infrastructure: assets.filter(a => a.type === 'infrastructure').length,
            peripherals: assets.filter(a => a.type === 'peripherals').length,
          },
          incidents: {
            open: 0,
            critical: 0
          }
        }
        setMetrics(summary)
      }
    } catch (err) {
      console.error('Metrics fallback error:', err)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card animate-pulse">
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!metrics) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Assets */}
      <div className="card hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Total Assets</p>
            <p className="text-3xl font-bold text-gray-900">{metrics.total}</p>
            <p className="text-xs text-gray-500 mt-1">All registered assets</p>
          </div>
          <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Active Assets */}
      <div className="card hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Active Assets</p>
            <p className="text-3xl font-bold text-green-600">{(metrics.by_status?.active || 0) + (metrics.by_status?.in_use || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.by_status?.active || 0} active, {metrics.by_status?.in_use || 0} in use
            </p>
          </div>
          <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Maintenance Assets */}
      <div className="card hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Maintenance</p>
            <p className="text-3xl font-bold text-yellow-600">{metrics.by_status?.maintenance || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Under maintenance</p>
          </div>
          <div className="w-14 h-14 bg-yellow-100 rounded-xl flex items-center justify-center">
            <svg className="w-7 h-7 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Issues */}
      <div className="card hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Issues</p>
            <p className="text-3xl font-bold text-red-600">{(metrics.by_status?.damaged || 0) + (metrics.by_status?.retired || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.by_status?.damaged || 0} damaged, {metrics.by_status?.retired || 0} retired
            </p>
          </div>
          <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center">
            <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Asset Type Breakdown */}
      <div className="col-span-full">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Asset Distribution by Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Hardware</p>
                <p className="text-2xl font-bold text-purple-600">{metrics.by_type?.hardware || 0}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-indigo-50 rounded-lg">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Software</p>
                <p className="text-2xl font-bold text-indigo-600">{metrics.by_type?.software || 0}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-cyan-50 rounded-lg">
              <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Network</p>
                <p className="text-2xl font-bold text-cyan-600">{metrics.by_type?.network || 0}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Infrastructure</p>
                <p className="text-2xl font-bold text-orange-600">{metrics.by_type?.infrastructure || 0}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-pink-50 rounded-lg">
              <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Peripherals</p>
                <p className="text-2xl font-bold text-pink-600">{metrics.by_type?.peripherals || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardMetrics
