import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import './Details.css'

function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, role: userRole } = useAuth()
  const currentUserId = user?.id

  const [asset, setAsset] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [previousMetrics, setPreviousMetrics] = useState(null)

  useEffect(() => {
    fetchAsset()
  }, [id])

  // Separate effect for metrics that depends on asset being loaded
  useEffect(() => {
    if (!asset) return
    
    fetchMetrics()
    
    // Refresh metrics every 10 seconds
    const interval = setInterval(fetchMetrics, 10000)
    
    return () => clearInterval(interval)
  }, [id, asset])

  async function fetchAsset() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('assets')
        .select(`
          *,
          creator:created_by(id, email, full_name),
          assignee:assigned_to(id, email, full_name)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      setAsset(data)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchMetrics() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const flaskToken = localStorage.getItem('flask_jwt_token')
      
      if (!session && !flaskToken) return

      const response = await fetch(`http://localhost:5000/api/assets/${id}/metrics`, {
        headers: {
          'Authorization': `Bearer ${flaskToken || session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const newMetrics = data.metrics
        
        console.log('Fetched metrics:', newMetrics)
        
        // Check for threshold violations and show alerts
        if (newMetrics && asset) {
          checkThresholdViolations(newMetrics)
        }
        
        setPreviousMetrics(metrics)
        setMetrics(newMetrics)
      } else {
        console.error('Failed to fetch metrics:', response.status)
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
    }
  }

  function checkThresholdViolations(newMetrics) {
    console.log('=== THRESHOLD CHECK START ===')
    console.log('Asset:', asset?.name, 'Type:', asset?.type)
    console.log('Previous metrics:', previousMetrics)
    console.log('New metrics:', newMetrics)
    console.log('Health status:', newMetrics?.health_status)
    
    // Only show alerts if this is not the first fetch (avoid spam on page load)
    if (!previousMetrics) {
      console.log('❌ Skipping - First fetch (no previous metrics)')
      return
    }

    if (!asset) {
      console.log('❌ Skipping - Asset not loaded')
      return
    }

    console.log(`✓ Checking thresholds for ${asset.type}: ${asset.name}`)

    // Check if health_status changed to critical or warning
    const previousHealth = previousMetrics.health_status || 'healthy'
    const currentHealth = newMetrics.health_status || 'healthy'
    
    console.log(`Health Status: ${previousHealth} → ${currentHealth}`)
    
    // Alert if status degraded to critical
    if (currentHealth === 'critical' && previousHealth !== 'critical') {
      console.log('🚨 HEALTH STATUS CHANGED TO CRITICAL!')
      
      // Generate appropriate message based on asset type
      let message = ''
      if (asset.type === 'hardware') {
        const issues = []
        if (newMetrics.cpu_usage > 90) issues.push(`CPU: ${newMetrics.cpu_usage.toFixed(1)}%`)
        if (newMetrics.memory_usage > 90) issues.push(`Memory: ${newMetrics.memory_usage.toFixed(1)}%`)
        if (newMetrics.temperature > 75) issues.push(`Temp: ${newMetrics.temperature.toFixed(1)}°C`)
        if (newMetrics.disk_usage > 80) issues.push(`Disk: ${newMetrics.disk_usage.toFixed(1)}%`)
        message = `${asset.name}: CRITICAL - ${issues.join(', ')}`
      } else if (asset.type === 'software') {
        message = `${asset.name}: Software not operational - ${newMetrics.last_error || 'Unknown error'}`
      } else if (asset.type === 'network') {
        message = `${asset.name}: Network critical - Packet Loss: ${newMetrics.packet_loss_percent?.toFixed(1)}%`
      } else if (asset.type === 'infrastructure') {
        message = `${asset.name}: Service ${newMetrics.service_status}`
      } else if (asset.type === 'peripherals') {
        const issues = []
        if (newMetrics.connection_status === 'disconnected') issues.push('Disconnected')
        if (newMetrics.connection_status === 'intermittent') issues.push('Intermittent Connection')
        if (newMetrics.print_status === 'offline') issues.push('Offline')
        if (newMetrics.print_status === 'error') issues.push('Device Error')
        if (newMetrics.print_status === 'paper_jam') issues.push('Paper Jam')
        if (newMetrics.peripheral_error) issues.push(newMetrics.peripheral_error)
        message = `${asset.name}: PERIPHERAL ISSUE - ${issues.join(', ')}`
      }
      
      toast.error(message, {
        duration: 6000,
        icon: '�',
        style: {
          background: '#dc2626',
          color: '#fff',
          fontWeight: 'bold'
        }
      })
    }
    
    // Alert if status degraded to warning
    if (currentHealth === 'warning' && previousHealth === 'healthy') {
      console.log('⚠️ HEALTH STATUS CHANGED TO WARNING!')
      
      let message = `${asset.name}: System showing warning signs`
      if (asset.type === 'hardware') {
        const issues = []
        if (newMetrics.cpu_usage > 75) issues.push(`CPU: ${newMetrics.cpu_usage.toFixed(1)}%`)
        if (newMetrics.memory_usage > 75) issues.push(`Memory: ${newMetrics.memory_usage.toFixed(1)}%`)
        if (newMetrics.temperature > 65) issues.push(`Temp: ${newMetrics.temperature.toFixed(1)}°C`)
        if (issues.length > 0) message = `${asset.name}: ${issues.join(', ')}`
      }
      
      toast.warning(message, {
        duration: 4000,
        icon: '⚠️'
      })
    }
    
    // Also keep individual threshold checks for hardware (as backup/additional alerts)
    if (asset.type === 'hardware') {
      console.log('🔧 Hardware detected - checking individual thresholds')
      
      // CPU Usage Alert
      const cpuCurrent = newMetrics.cpu_usage || 0
      const cpuPrevious = previousMetrics.cpu_usage || 0
      console.log(`  CPU: ${cpuPrevious}% → ${cpuCurrent}%`)
      
      if (cpuCurrent > 90 && cpuPrevious <= 90) {
        console.log('  🔥 TRIGGERING CPU CRITICAL ALERT!')
        toast.error(`⚠️ ${asset.name}: CPU usage critical at ${cpuCurrent.toFixed(1)}%!`, {
          duration: 5000,
          icon: '🔥'
        })
      } else if (cpuCurrent > 75 && cpuCurrent <= 90 && cpuPrevious <= 75) {
        console.log('  ⚠️ TRIGGERING CPU WARNING!')
        toast.warning(`⚠️ ${asset.name}: CPU usage high at ${cpuCurrent.toFixed(1)}%`, {
          duration: 4000
        })
      } else {
        console.log('  ✓ CPU OK (no alert needed)')
      }

      // Memory Usage Alert
      const memCurrent = newMetrics.memory_usage || 0
      const memPrevious = previousMetrics.memory_usage || 0
      console.log(`  Memory: ${memPrevious}% → ${memCurrent}%`)
      
      if (memCurrent > 90 && memPrevious <= 90) {
        console.log('  💾 TRIGGERING MEMORY CRITICAL ALERT!')
        toast.error(`⚠️ ${asset.name}: Memory usage critical at ${memCurrent.toFixed(1)}%!`, {
          duration: 5000,
          icon: '💾'
        })
      } else if (memCurrent > 75 && memCurrent <= 90 && memPrevious <= 75) {
        console.log('  ⚠️ TRIGGERING MEMORY WARNING!')
        toast.warning(`⚠️ ${asset.name}: Memory usage high at ${memCurrent.toFixed(1)}%`, {
          duration: 4000
        })
      } else {
        console.log('  ✓ Memory OK (no alert needed)')
      }

      // Temperature Alert
      const tempCurrent = newMetrics.temperature || 0
      const tempPrevious = previousMetrics.temperature || 0
      console.log(`  Temperature: ${tempPrevious}°C → ${tempCurrent}°C`)
      
      if (tempCurrent > 75 && tempPrevious <= 75) {
        console.log('  🌡️ TRIGGERING TEMPERATURE CRITICAL ALERT!')
        toast.error(`⚠️ ${asset.name}: Temperature critical at ${tempCurrent.toFixed(1)}°C!`, {
          duration: 5000,
          icon: '🌡️'
        })
      } else if (tempCurrent > 65 && tempCurrent <= 75 && tempPrevious <= 65) {
        console.log('  ⚠️ TRIGGERING TEMPERATURE WARNING!')
        toast.warning(`⚠️ ${asset.name}: Temperature elevated at ${tempCurrent.toFixed(1)}°C`, {
          duration: 4000
        })
      } else {
        console.log('  ✓ Temperature OK (no alert needed)')
      }

      // Disk Usage Alert
      const diskCurrent = newMetrics.disk_usage || 0
      const diskPrevious = previousMetrics.disk_usage || 0
      console.log(`  Disk: ${diskPrevious}% → ${diskCurrent}%`)
      
      if (diskCurrent > 80 && diskPrevious <= 80) {
        console.log('  💿 TRIGGERING DISK WARNING!')
        toast.warning(`⚠️ ${asset.name}: Disk usage high at ${diskCurrent.toFixed(1)}%`, {
          duration: 4000,
          icon: '💿'
        })
      } else {
        console.log('  ✓ Disk OK (no alert needed)')
      }
      
    } else if (asset.type === 'software') {
      console.log('💻 Software detected - checking operational status')
      // Software Operational Status
      if (!newMetrics.is_operational && previousMetrics.is_operational !== false) {
        toast.error(`❌ ${asset.name}: Software stopped working!`, {
          duration: 5000,
          icon: '⚠️'
        })
      }
    } else if (asset.type === 'network') {
      // Network Packet Loss
      if (newMetrics.packet_loss_percent > 5 && (!previousMetrics.packet_loss_percent || previousMetrics.packet_loss_percent <= 5)) {
        toast.error(`⚠️ ${asset.name}: Critical packet loss at ${newMetrics.packet_loss_percent.toFixed(1)}%!`, {
          duration: 5000,
          icon: '📡'
        })
      } else if (newMetrics.packet_loss_percent > 2 && newMetrics.packet_loss_percent <= 5 && (!previousMetrics.packet_loss_percent || previousMetrics.packet_loss_percent <= 2)) {
        toast.warning(`⚠️ ${asset.name}: High packet loss at ${newMetrics.packet_loss_percent.toFixed(1)}%`, {
          duration: 4000
        })
      }

      // Network Latency
      if (newMetrics.latency_ms > 100 && (!previousMetrics.latency_ms || previousMetrics.latency_ms <= 100)) {
        toast.warning(`⚠️ ${asset.name}: High latency at ${newMetrics.latency_ms.toFixed(0)}ms`, {
          duration: 4000,
          icon: '🐌'
        })
      }
    } else if (asset.type === 'infrastructure') {
      // Infrastructure Service Status
      if (newMetrics.service_status === 'down' && previousMetrics.service_status !== 'down') {
        toast.error(`❌ ${asset.name}: Service is DOWN!`, {
          duration: 6000,
          icon: '🔴'
        })
      } else if (newMetrics.service_status === 'degraded' && previousMetrics.service_status !== 'degraded') {
        toast.warning(`⚠️ ${asset.name}: Service is degraded`, {
          duration: 4000,
          icon: '🟡'
        })
      }

      // Response Time
      if (newMetrics.response_time_ms > 500 && (!previousMetrics.response_time_ms || previousMetrics.response_time_ms <= 500)) {
        toast.warning(`⚠️ ${asset.name}: Slow response time at ${newMetrics.response_time_ms.toFixed(0)}ms`, {
          duration: 4000
        })
      }

      // Availability
      if (newMetrics.availability_percent < 99 && (!previousMetrics.availability_percent || previousMetrics.availability_percent >= 99)) {
        toast.error(`⚠️ ${asset.name}: Availability dropped to ${newMetrics.availability_percent.toFixed(2)}%!`, {
          duration: 5000
        })
      }
    }
  }

  async function handleDelete() {
    if (userRole === 'viewer') {
      toast.error('Viewers cannot delete assets')
      return
    }

    if (userRole === 'operator' && asset.created_by !== currentUserId) {
      toast.error('Operators can only delete assets they created')
      return
    }

    if (!window.confirm('Are you sure you want to delete this asset? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Asset deleted successfully')
      navigate('/assets')
    } catch (error) {
      toast.error('Error deleting asset: ' + error.message)
    }
  }

  function canEdit() {
    if (userRole === 'admin') return true
    if (userRole === 'operator' && asset?.created_by === currentUserId) return true
    return false
  }

  function canDelete() {
    if (userRole === 'admin') return true
    if (userRole === 'operator' && asset?.created_by === currentUserId) return true
    return false
  }

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800'
      case 'retired':
        return 'bg-gray-100 text-gray-800'
      case 'damaged':
        return 'bg-red-100 text-red-800'
      case 'in_use':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeBadgeColor = (type) => {
    switch (type) {
      case 'hardware':
        return 'bg-purple-100 text-purple-800'
      case 'software':
        return 'bg-indigo-100 text-indigo-800'
      case 'network':
        return 'bg-cyan-100 text-cyan-800'
      case 'infrastructure':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-6 bg-gray-200 rounded w-28"></div>
          <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-100 rounded w-1/3"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 h-48"></div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 h-48"></div>
          </div>
        </div>
      </main>
    )
  }

  if (error || !asset) {
    return (
      <main className="max-w-4xl mx-auto py-16 px-4 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Asset Not Found</h2>
        <p className="text-gray-600 mb-6">{error || 'The asset you are looking for does not exist'}</p>
        <button
          onClick={() => navigate('/assets')}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer"
        >
          Back to Assets
        </button>
      </main>
    )
  }

  return (
    <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/assets')}
            className="text-primary-600 hover:text-primary-800 font-medium flex items-center"
          >
            ← Back to Assets
          </button>
        </div>

        {/* Asset Header */}
        <div className="card mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {asset.name}
              </h2>
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getTypeBadgeColor(asset.type)}`}>
                  {asset.type}
                </span>
                <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getStatusBadgeColor(asset.status)}`}>
                  {asset.status}
                </span>
              </div>
            </div>
            <div className="flex space-x-3">
              {/* Test Toast Button - Remove in production */}
              <button
                onClick={() => {
                  toast.success('✅ Toast system working!', { duration: 3000 })
                  toast.error('🔥 Test critical alert!', { duration: 3000 })
                  toast.warning('⚠️ Test warning!', { duration: 3000 })
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                🧪 Test Alerts
              </button>
              
              {canEdit() && (
                <button
                  onClick={() => navigate(`/assets/${id}/edit`)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  ✏️ Edit
                </button>
              )}
              {canDelete() && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>

          {asset.description && (
            <p className="text-gray-700 mb-4">{asset.description}</p>
          )}
        </div>

        {/* Asset Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Basic Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Basic Information</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Serial Number</dt>
                <dd className="mt-1 text-sm text-gray-900">{asset.serial_number || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Location</dt>
                <dd className="mt-1 text-sm text-gray-900">{asset.location || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Cost</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {asset.cost ? `₹${parseFloat(asset.cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Dates */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📅 Dates</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Purchase Date</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Warranty Expiry</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString() : 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created At</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(asset.created_at).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(asset.updated_at).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Assignment */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">👤 Assignment</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Assigned To</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {asset.assignee ? (
                    <div>
                      <div className="font-medium">{asset.assignee.full_name}</div>
                      <div className="text-gray-500">{asset.assignee.email}</div>
                    </div>
                  ) : (
                    'Not assigned'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created By</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {asset.creator ? (
                    <div>
                      <div className="font-medium">{asset.creator.full_name}</div>
                      <div className="text-gray-500">{asset.creator.email}</div>
                    </div>
                  ) : (
                    'Unknown'
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Status Info */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">ℹ️ Status Information</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Current Status</dt>
                <dd className="mt-1">
                  <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getStatusBadgeColor(asset.status)}`}>
                    {asset.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Asset Type</dt>
                <dd className="mt-1">
                  <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getTypeBadgeColor(asset.type)}`}>
                    {asset.type}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Asset ID</dt>
                <dd className="mt-1 text-xs text-gray-900 font-mono">{asset.id}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Real-time Metrics Section */}
        {metrics && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">📊 Real-time Metrics</h3>
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full animate-pulse ${
                  metrics.health_status === 'healthy' ? 'bg-green-500' :
                  metrics.health_status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                }`}></span>
                <span className="text-xs text-gray-500">
                  Updated {new Date(metrics.last_updated).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Health Status Badge */}
            <div className="mb-4">
              <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
                metrics.health_status === 'healthy' ? 'bg-green-100 text-green-800' :
                metrics.health_status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {metrics.health_status === 'healthy' ? '✓ Healthy' :
                 metrics.health_status === 'warning' ? '⚠ Warning' : '❌ Critical'}
              </span>
            </div>

            {/* Hardware Metrics */}
            {asset.type === 'hardware' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">CPU Usage</span>
                    <span className={`text-lg font-bold ${
                      metrics.cpu_usage > 90 ? 'text-red-600' :
                      metrics.cpu_usage > 75 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {metrics.cpu_usage ? `${metrics.cpu_usage.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        metrics.cpu_usage > 90 ? 'bg-red-600' :
                        metrics.cpu_usage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${metrics.cpu_usage || 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Memory Usage</span>
                    <span className={`text-lg font-bold ${
                      metrics.memory_usage > 90 ? 'text-red-600' :
                      metrics.memory_usage > 75 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {metrics.memory_usage ? `${metrics.memory_usage.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        metrics.memory_usage > 90 ? 'bg-red-600' :
                        metrics.memory_usage > 75 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${metrics.memory_usage || 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-indigo-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Disk Usage</span>
                    <span className="text-lg font-bold text-indigo-600">
                      {metrics.disk_usage ? `${metrics.disk_usage.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Temperature</span>
                    <span className={`text-lg font-bold ${
                      metrics.temperature > 70 ? 'text-red-600' : 'text-orange-600'
                    }`}>
                      {metrics.temperature ? `${metrics.temperature.toFixed(1)}°C` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Software Metrics */}
            {asset.type === 'software' && (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${
                  metrics.is_operational ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Operational Status</span>
                    <span className={`text-lg font-bold ${
                      metrics.is_operational ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {metrics.is_operational ? '✓ Working' : '✗ Not Working'}
                    </span>
                  </div>
                  {metrics.last_error && (
                    <p className="text-xs text-red-700 mt-2">
                      <strong>Last Error:</strong> {metrics.last_error}
                    </p>
                  )}
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Uptime</span>
                    <span className="text-lg font-bold text-blue-600">
                      {metrics.uptime_hours ? `${metrics.uptime_hours.toFixed(1)} hours` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Network Metrics */}
            {asset.type === 'network' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-cyan-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Bandwidth Usage</span>
                    <span className="text-lg font-bold text-cyan-600">
                      {metrics.bandwidth_usage_mbps ? `${metrics.bandwidth_usage_mbps.toFixed(1)} Mbps` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Packet Loss</span>
                    <span className={`text-lg font-bold ${
                      metrics.packet_loss_percent > 5 ? 'text-red-600' :
                      metrics.packet_loss_percent > 2 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {metrics.packet_loss_percent ? `${metrics.packet_loss_percent.toFixed(2)}%` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-indigo-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Latency</span>
                    <span className="text-lg font-bold text-indigo-600">
                      {metrics.latency_ms ? `${metrics.latency_ms.toFixed(1)} ms` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Active Connections</span>
                    <span className="text-lg font-bold text-purple-600">
                      {metrics.active_connections || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Infrastructure Metrics */}
            {asset.type === 'infrastructure' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${
                  metrics.service_status === 'healthy' ? 'bg-green-50' :
                  metrics.service_status === 'degraded' ? 'bg-yellow-50' : 'bg-red-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Service Status</span>
                    <span className={`text-lg font-bold ${
                      metrics.service_status === 'healthy' ? 'text-green-600' :
                      metrics.service_status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {metrics.service_status === 'healthy' ? '✓ Healthy' :
                       metrics.service_status === 'degraded' ? '⚠ Degraded' : '✗ Down'}
                    </span>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Response Time</span>
                    <span className="text-lg font-bold text-blue-600">
                      {metrics.response_time_ms ? `${metrics.response_time_ms.toFixed(1)} ms` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Error Rate</span>
                    <span className="text-lg font-bold text-orange-600">
                      {metrics.error_rate_percent ? `${metrics.error_rate_percent.toFixed(2)}%` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Availability</span>
                    <span className="text-lg font-bold text-green-600">
                      {metrics.availability_percent ? `${metrics.availability_percent.toFixed(2)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Peripherals Metrics */}
            {asset.type === 'peripherals' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${
                  metrics.connection_status === 'connected' ? 'bg-green-50' :
                  metrics.connection_status === 'intermittent' ? 'bg-yellow-50' : 'bg-red-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Connection Status</span>
                    <span className={`text-lg font-bold ${
                      metrics.connection_status === 'connected' ? 'text-green-600' :
                      metrics.connection_status === 'intermittent' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {metrics.connection_status === 'connected' ? '✓ Connected' :
                       metrics.connection_status === 'intermittent' ? '⚠ Intermittent' : '✗ Disconnected'}
                    </span>
                  </div>
                </div>

                {metrics.print_status && (
                  <div className={`p-4 rounded-lg ${
                    metrics.print_status === 'online' ? 'bg-green-50' :
                    metrics.print_status === 'low_toner' ? 'bg-yellow-50' : 'bg-red-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Print Status</span>
                      <span className={`text-lg font-bold ${
                        metrics.print_status === 'online' ? 'text-green-600' :
                        metrics.print_status === 'low_toner' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {metrics.print_status === 'online' ? '✓ Online' :
                         metrics.print_status === 'offline' ? '✗ Offline' :
                         metrics.print_status === 'paper_jam' ? '⚠ Paper Jam' :
                         metrics.print_status === 'low_toner' ? '⚠ Low Toner' : '✗ Error'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Usage Hours</span>
                    <span className="text-lg font-bold text-blue-600">
                      {metrics.usage_hours ? `${metrics.usage_hours.toFixed(1)} hrs` : 'N/A'}
                    </span>
                  </div>
                </div>

                {metrics.peripheral_error && (
                  <div className="bg-red-50 p-4 rounded-lg col-span-1 md:col-span-2">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-700 mr-2">Error:</span>
                      <span className="text-sm text-red-600 font-medium">
                        {metrics.peripheral_error}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!metrics && !loading && (
          <div className="card mb-6 bg-gray-50">
            <p className="text-center text-gray-500 py-4">
              No real-time metrics available for this asset yet. Metrics will appear once the monitoring system starts collecting data.
            </p>
          </div>
        )}
      </main>
  )
}

export default AssetDetail