import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import TopologyGraph from '../../components/TopologyGraph'
import AddRelationshipModal from '../../components/AddRelationshipModal'
import CreateLicenseModal from '../../components/CreateLicenseModal'
import AllocateSeatModal from '../../components/AllocateSeatModal'
import LicenseCard from '../../components/LicenseCard'
import FinancialSummaryCard from '../../components/FinancialSummaryCard'
import AssetTagModal from '../../components/AssetTagModal'
import RecordAuditModal from '../../components/RecordAuditModal'
import PhysicalAuditHistory from '../../components/PhysicalAuditHistory'
import TelemetrySparkline from '../../components/TelemetrySparkline'
import TelemetrySimulationPanel from '../../components/TelemetrySimulationPanel'
import AssetAnomalyBanner from '../../components/AssetAnomalyBanner'
import AssetVulnerabilitySection from '../../components/AssetVulnerabilitySection'
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

  // Telemetry Time-Series & Anomaly State
  const [telemetryHistory, setTelemetryHistory] = useState([])
  const [isSimulationPanelOpen, setIsSimulationPanelOpen] = useState(false)
  const [allAssets, setAllAssets] = useState([])

  // CMDB & Dependency Topology State
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'topology'
  const [isAddRelModalOpen, setIsAddRelModalOpen] = useState(false)
  const [relationships, setRelationships] = useState({ outgoing: [], incoming: [] })
  const [blastRadiusData, setBlastRadiusData] = useState(null)
  const [topologyRefreshKey, setTopologyRefreshKey] = useState(0)

  // Software Licensing State
  const [licenses, setLicenses] = useState([])
  const [isCreateLicenseModalOpen, setIsCreateLicenseModalOpen] = useState(false)
  const [selectedLicenseForAlloc, setSelectedLicenseForAlloc] = useState(null)

  // Physical Audit & QR Tag State
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [isRecordAuditModalOpen, setIsRecordAuditModalOpen] = useState(false)
  const [auditRefreshKey, setAuditRefreshKey] = useState(0)

  useEffect(() => {
    fetchAsset()
    fetchRelationships()
    fetchLicenses()
    fetchTelemetryHistory()
    fetchAllAssets()
  }, [id])

  async function fetchTelemetryHistory() {
    try {
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`http://localhost:5000/api/assets/${id}/telemetry/history?limit=30`, { headers })
      if (res.ok) {
        const data = await res.json()
        setTelemetryHistory(data.history || [])
      }
    } catch (err) {
      console.error('Failed to load telemetry history:', err)
    }
  }

  async function fetchAllAssets() {
    try {
      const { data } = await supabase.from('assets').select('id, name, type').eq('is_active', true)
      if (data) setAllAssets(data)
    } catch (err) {
      console.error('Failed to fetch assets list:', err)
    }
  }

  async function fetchLicenses() {
    try {
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`http://localhost:5000/api/licenses?software_asset_id=${id}`, { headers })
      if (res.ok) {
        const data = await res.json()
        setLicenses(data.licenses || [])
      }
    } catch (err) {
      console.error('Failed to load software licenses:', err)
    }
  }

  async function fetchRelationships() {
    try {
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const [relRes, blastRes] = await Promise.all([
        fetch(`http://localhost:5000/api/assets/${id}/relationships`, { headers }),
        fetch(`http://localhost:5000/api/assets/${id}/blast-radius`, { headers })
      ])
      if (relRes.ok) {
        const data = await relRes.json()
        setRelationships(data)
      }
      if (blastRes.ok) {
        const data = await blastRes.json()
        setBlastRadiusData(data)
      }
    } catch (err) {
      console.error('Failed to load CMDB relationships:', err)
    }
  }

  async function handleDeleteRelationship(relId) {
    if (!window.confirm('Are you sure you want to remove this dependency relationship?')) return
    try {
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`http://localhost:5000/api/assets/relationships/${relId}`, {
        method: 'DELETE',
        headers
      })
      if (res.ok) {
        toast.success('Relationship removed')
        fetchRelationships()
        setTopologyRefreshKey(k => k + 1)
      } else {
        toast.error('Failed to remove relationship')
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

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
                  onClick={() => setIsAddRelModalOpen(true)}
                  className="px-3.5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <span>🔗</span> Map Dependency
                </button>
              )}
              <button
                onClick={() => setIsTagModalOpen(true)}
                className="px-3.5 py-2 bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 rounded-lg transition-colors text-sm font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Generate QR code and printable asset tag"
              >
                <span>🏷️</span> Asset Tag
              </button>
              {canEdit() && (
                <button
                  onClick={() => setIsRecordAuditModalOpen(true)}
                  className="px-3.5 py-2 bg-cyan-600 text-white hover:bg-cyan-500 rounded-lg transition-colors text-sm font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="Log a physical audit inspection"
                >
                  <span>📋</span> Audit Physical
                </button>
              )}
              {canEdit() && (
                <button
                  onClick={() => navigate(`/assets/${id}/edit`)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                >
                  ✏️ Edit
                </button>
              )}
              {canDelete() && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>

          {asset.description && (
            <p className="text-gray-700 mb-4">{asset.description}</p>
          )}

          {/* View Mode Tabs */}
          <div className="flex border-b border-gray-200 dark:border-slate-800 pt-2 gap-6 font-space">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 text-sm font-bold tracking-tight transition-all border-b-2 ${
                activeTab === 'overview'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              📋 Overview & Telemetry
            </button>
            <button
              onClick={() => setActiveTab('topology')}
              className={`pb-3 text-sm font-bold tracking-tight transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'topology'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>🌐 Topology & Dependencies</span>
              {blastRadiusData && blastRadiusData.summary?.total_impacted > 0 && (
                <span className="px-2 py-0.5 text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded-full font-bold">
                  {blastRadiusData.summary.total_impacted} impacted
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('vulnerabilities')}
              className={`pb-3 text-sm font-bold tracking-tight transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'vulnerabilities'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>🛡️ Vulnerabilities & CVEs</span>
            </button>
          </div>
        </div>

        {activeTab === 'overview' && (
          <>

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

        {/* Software Licensing & Seat Compliance Panel (for Software Assets) */}
        {asset.type === 'software' && (
          <div className="card mb-6 !p-6 font-space border-l-4 border-l-purple-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">📜</span>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Software Licensing & Seat Compliance
                  </h3>
                  <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 border border-purple-500/40 rounded-full font-bold">
                    {licenses.length} {licenses.length === 1 ? 'License Pool' : 'License Pools'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Manage multi-seat licenses, activation keys, vendor renewal dates, and device allocations.
                </p>
              </div>

              {canEdit() && (
                <button
                  onClick={() => setIsCreateLicenseModalOpen(true)}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all self-start sm:self-auto cursor-pointer"
                >
                  <span>+</span> Register License Pool
                </button>
              )}
            </div>

            {licenses && licenses.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {licenses.map(lic => (
                  <LicenseCard
                    key={lic.id}
                    license={lic}
                    canEdit={canEdit()}
                    onAllocateClick={(l) => setSelectedLicenseForAlloc(l)}
                    onReclaimSuccess={() => fetchLicenses()}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-slate-700/60 rounded-xl bg-slate-900/30">
                <span className="text-3xl">💺</span>
                <p className="text-sm font-semibold text-slate-300 mt-2">No Licenses Registered for this Software</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Register a license key and seat capacity to start tracking hardware allocations and compliance.
                </p>
                {canEdit() && (
                  <button
                    onClick={() => setIsCreateLicenseModalOpen(true)}
                    className="mt-3 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>+</span> Register First License
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Financial Lifecycle, Depreciation & TCO Summary */}
        <FinancialSummaryCard assetId={id} />

        {/* Physical Inventory Audit History */}
        <PhysicalAuditHistory
          assetId={id}
          refreshKey={auditRefreshKey}
          onOpenAuditModal={() => setIsRecordAuditModalOpen(true)}
          canAudit={canEdit()}
        />

        {/* Active Statistical Outlier Anomaly Banner */}
        <AssetAnomalyBanner
          latestTelemetry={telemetryHistory[0]}
          onOpenSimulator={() => setIsSimulationPanelOpen(true)}
        />

        {/* Real-time Metrics Section */}
        {metrics && (
          <div className="card mb-6 font-space">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">📊 Real-Time Metrics & Telemetry</h3>
                <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                  metrics.health_status === 'healthy' ? 'bg-emerald-500' :
                  metrics.health_status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
                }`}></span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 font-mono">
                  Updated {new Date(metrics.last_updated).toLocaleTimeString()}
                </span>
                <button
                  type="button"
                  onClick={() => setIsSimulationPanelOpen(true)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <span>🧪</span> Chaos Simulator
                </button>
              </div>
            </div>

            {/* Health Status Badge */}
            <div className="mb-4">
              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${
                metrics.health_status === 'healthy' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                metrics.health_status === 'warning' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              }`}>
                {metrics.health_status === 'healthy' ? '✓ Healthy Telemetry' :
                 metrics.health_status === 'warning' ? '⚠ Outlier Warning' : '❌ Critical Outlier'}
              </span>
            </div>

            {/* Hardware Metrics */}
            {asset.type === 'hardware' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-purple-50 dark:bg-slate-950/60 p-4 rounded-lg border border-purple-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">CPU Usage</span>
                    <span className={`text-lg font-bold font-mono ${
                      metrics.cpu_usage > 90 ? 'text-red-500' :
                      metrics.cpu_usage > 75 ? 'text-amber-500' : 'text-emerald-400'
                    }`}>
                      {metrics.cpu_usage ? `${metrics.cpu_usage.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        metrics.cpu_usage > 90 ? 'bg-red-500' :
                        metrics.cpu_usage > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${metrics.cpu_usage || 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-slate-950/60 p-4 rounded-lg border border-blue-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Memory Usage</span>
                    <span className={`text-lg font-bold font-mono ${
                      metrics.memory_usage > 90 ? 'text-red-500' :
                      metrics.memory_usage > 75 ? 'text-amber-500' : 'text-cyan-400'
                    }`}>
                      {metrics.memory_usage ? `${metrics.memory_usage.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        metrics.memory_usage > 90 ? 'bg-red-500' :
                        metrics.memory_usage > 75 ? 'bg-amber-500' : 'bg-cyan-500'
                      }`}
                      style={{ width: `${metrics.memory_usage || 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-indigo-50 dark:bg-slate-950/60 p-4 rounded-lg border border-indigo-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Disk Usage</span>
                    <span className="text-lg font-bold font-mono text-indigo-400">
                      {metrics.disk_usage ? `${metrics.disk_usage.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-orange-50 dark:bg-slate-950/60 p-4 rounded-lg border border-orange-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Temperature</span>
                    <span className={`text-lg font-bold font-mono ${
                      metrics.temperature > 70 ? 'text-red-500' : 'text-orange-400'
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
                  metrics.is_operational ? 'bg-green-50 dark:bg-slate-950/60' : 'bg-red-50 dark:bg-slate-950/60'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Operational Status</span>
                    <span className={`text-lg font-bold ${
                      metrics.is_operational ? 'text-green-600 dark:text-emerald-400' : 'text-red-600 dark:text-rose-400'
                    }`}>
                      {metrics.is_operational ? '✓ Working' : '✗ Not Working'}
                    </span>
                  </div>
                  {metrics.last_error && (
                    <p className="text-xs text-red-700 dark:text-rose-400 mt-2 font-mono">
                      <strong>Last Error:</strong> {metrics.last_error}
                    </p>
                  )}
                </div>

                <div className="bg-blue-50 dark:bg-slate-950/60 p-4 rounded-lg border border-blue-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Uptime</span>
                    <span className="text-lg font-bold text-blue-600 dark:text-cyan-400 font-mono">
                      {metrics.uptime_hours ? `${metrics.uptime_hours.toFixed(1)} hours` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Network Metrics */}
            {asset.type === 'network' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-cyan-50 dark:bg-slate-950/60 p-4 rounded-lg border border-cyan-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Bandwidth Usage</span>
                    <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400 font-mono">
                      {metrics.bandwidth_usage_mbps ? `${metrics.bandwidth_usage_mbps.toFixed(1)} Mbps` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-slate-950/60 p-4 rounded-lg border border-red-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Packet Loss</span>
                    <span className={`text-lg font-bold font-mono ${
                      metrics.packet_loss_percent > 5 ? 'text-red-600 dark:text-rose-400' :
                      metrics.packet_loss_percent > 2 ? 'text-yellow-600 dark:text-amber-400' : 'text-green-600 dark:text-emerald-400'
                    }`}>
                      {metrics.packet_loss_percent ? `${metrics.packet_loss_percent.toFixed(2)}%` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-indigo-50 dark:bg-slate-950/60 p-4 rounded-lg border border-indigo-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Latency</span>
                    <span className="text-lg font-bold text-indigo-600 dark:text-purple-400 font-mono">
                      {metrics.latency_ms ? `${metrics.latency_ms.toFixed(1)} ms` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-purple-50 dark:bg-slate-950/60 p-4 rounded-lg border border-purple-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Active Connections</span>
                    <span className="text-lg font-bold text-purple-600 dark:text-purple-400 font-mono">
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

            {/* Historical Telemetry Sparkline Grid with Anomaly Outlier Detection */}
            <div className="mt-6 pt-5 border-t border-gray-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    📈 Telemetry Trends & Outlier Sparklines (30-Point Rolling Window)
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-full font-mono">
                    Z-Score σ Engine
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <TelemetrySparkline
                  data={telemetryHistory}
                  metricKey="cpu_usage"
                  label="CPU Core Load"
                  unit="%"
                  color="#06b6d4"
                  fillGradientId="grad-sparkline-cpu"
                  threshold={90}
                  maxScale={100}
                />
                <TelemetrySparkline
                  data={telemetryHistory}
                  metricKey="memory_usage"
                  label="RAM Allocation"
                  unit="%"
                  color="#a855f7"
                  fillGradientId="grad-sparkline-mem"
                  threshold={92}
                  maxScale={100}
                />
                <TelemetrySparkline
                  data={telemetryHistory}
                  metricKey="disk_usage"
                  label="Storage Volume"
                  unit="%"
                  color="#6366f1"
                  fillGradientId="grad-sparkline-disk"
                  threshold={95}
                  maxScale={100}
                />
                <TelemetrySparkline
                  data={telemetryHistory}
                  metricKey="latency_ms"
                  label="Network Latency"
                  unit="ms"
                  color="#f59e0b"
                  fillGradientId="grad-sparkline-lat"
                  threshold={50}
                  maxScale={150}
                />
              </div>
            </div>
          </div>
        )}

        {!metrics && !loading && (
          <div className="card mb-6 bg-gray-50">
            <p className="text-center text-gray-500 py-4">
              No real-time metrics available for this asset yet. Metrics will appear once the monitoring system starts collecting data.
            </p>
          </div>
        )}
          </>
        )}

        {/* Tab 2: Topology & Blast Radius (CMDB) */}
        {activeTab === 'topology' && (
          <div className="space-y-6 animate-fade-in font-space">
            {/* Interactive Graph Canvas */}
            <div className="card !p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>🕸️</span> Interactive Dependency Graph
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Visual representation of direct connections and cascading downstream dependencies.
                  </p>
                </div>
                {canEdit() && (
                  <button
                    onClick={() => setIsAddRelModalOpen(true)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <span>+</span> Add Dependency
                  </button>
                )}
              </div>

              <TopologyGraph
                key={topologyRefreshKey}
                assetId={id}
                onNodeClick={(clickedId) => {
                  if (clickedId !== id) {
                    navigate(`/assets/${clickedId}`)
                  }
                }}
              />
            </div>

            {/* Blast Radius Impact Analysis Card */}
            {blastRadiusData && (
              <div className="card !p-5 border-l-4 border-l-rose-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💥</span>
                      <h4 className="text-base font-bold text-gray-900 dark:text-white">
                        Downstream Blast Radius Analysis
                      </h4>
                      <span className={`px-2.5 py-0.5 text-xs font-bold uppercase rounded-md ${
                        blastRadiusData.risk_level === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                        blastRadiusData.risk_level === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                        blastRadiusData.risk_level === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}>
                        {blastRadiusData.risk_level} RISK
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      If <strong>{asset.name}</strong> experiences an outage or enters maintenance, the following services will be affected:
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl text-center">
                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                        {blastRadiusData.summary.total_impacted}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-slate-400">
                        Total Affected
                      </div>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl text-center">
                      <div className="text-lg font-bold text-rose-500">
                        {blastRadiusData.summary.direct_impact}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-slate-400">
                        Direct
                      </div>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl text-center">
                      <div className="text-lg font-bold text-amber-500">
                        {blastRadiusData.summary.secondary_impact}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-slate-400">
                        Cascading
                      </div>
                    </div>
                  </div>
                </div>

                {blastRadiusData.impacted_assets && blastRadiusData.impacted_assets.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-slate-800 text-gray-400 uppercase font-semibold">
                          <th className="py-2 px-3">Impacted Asset</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Current Status</th>
                          <th className="py-2 px-3">Severity</th>
                          <th className="py-2 px-3">Relationship Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                        {blastRadiusData.impacted_assets.map(item => (
                          <tr key={item.asset_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">
                              <button
                                onClick={() => navigate(`/assets/${item.asset_id}`)}
                                className="hover:underline text-left cursor-pointer"
                              >
                                {item.asset_name}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 uppercase text-[11px] text-gray-500">{item.asset_type}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 text-[10px] rounded-md font-semibold ${getStatusBadgeColor(item.asset_status)}`}>
                                {item.asset_status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                item.impact_level === 'DIRECT_IMPACT'
                                  ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                                  : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                              }`}>
                                {item.impact_level} (Depth {item.depth})
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-purple-600 dark:text-purple-400">
                              {item.relationship_type}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-slate-400 italic py-2">
                    No downstream dependencies mapped. If this asset experiences downtime, no other recorded assets are directly impacted.
                  </p>
                )}
              </div>
            )}

            {/* Direct Relationships Management Card */}
            <div className="card !p-5">
              <h4 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span>🔗</span> Configured Dependencies ({relationships.outgoing.length + relationships.incoming.length})
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Outgoing (This asset -> Target) */}
                <div className="border border-gray-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/50">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Outgoing Links (This Asset ➔ Dependents)
                  </h5>
                  {relationships.outgoing && relationships.outgoing.length > 0 ? (
                    <div className="space-y-2">
                      {relationships.outgoing.map(rel => (
                        <div key={rel.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700/60 shadow-sm">
                          <div>
                            <div className="text-xs font-semibold text-gray-900 dark:text-white">
                              {rel.child?.name || 'Unknown Asset'}
                            </div>
                            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-mono">
                              Type: {rel.relationship_type}
                            </div>
                          </div>
                          {canDelete() && (
                            <button
                              onClick={() => handleDeleteRelationship(rel.id)}
                              className="text-rose-500 hover:text-rose-600 text-xs px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Delete dependency"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No outgoing dependencies mapped.</p>
                  )}
                </div>

                {/* Incoming (Source -> This asset) */}
                <div className="border border-gray-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/50">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Incoming Links (Providers ➔ This Asset)
                  </h5>
                  {relationships.incoming && relationships.incoming.length > 0 ? (
                    <div className="space-y-2">
                      {relationships.incoming.map(rel => (
                        <div key={rel.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700/60 shadow-sm">
                          <div>
                            <div className="text-xs font-semibold text-gray-900 dark:text-white">
                              {rel.parent?.name || 'Unknown Asset'}
                            </div>
                            <div className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono">
                              Type: {rel.relationship_type}
                            </div>
                          </div>
                          {canDelete() && (
                            <button
                              onClick={() => handleDeleteRelationship(rel.id)}
                              className="text-rose-500 hover:text-rose-600 text-xs px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Delete dependency"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No incoming dependencies mapped.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: CVE Vulnerabilities & Security Posture */}
        {activeTab === 'vulnerabilities' && (
          <AssetVulnerabilitySection asset={asset} />
        )}

        {/* Add Relationship Modal */}
        <AddRelationshipModal
          isOpen={isAddRelModalOpen}
          onClose={() => setIsAddRelModalOpen(false)}
          currentAsset={asset}
          onRelationshipAdded={() => {
            fetchRelationships()
            setTopologyRefreshKey(k => k + 1)
          }}
        />

        {/* Software License Modals */}
        <CreateLicenseModal
          isOpen={isCreateLicenseModalOpen}
          onClose={() => setIsCreateLicenseModalOpen(false)}
          softwareAsset={asset}
          onLicenseCreated={() => fetchLicenses()}
        />

        <AllocateSeatModal
          isOpen={!!selectedLicenseForAlloc}
          onClose={() => setSelectedLicenseForAlloc(null)}
          license={selectedLicenseForAlloc}
          onSeatAllocated={() => fetchLicenses()}
        />

        {/* Physical Asset Tag & Audit Modals */}
        <AssetTagModal
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          asset={asset}
        />

        <RecordAuditModal
          isOpen={isRecordAuditModalOpen}
          onClose={() => setIsRecordAuditModalOpen(false)}
          asset={asset}
          onAuditRecorded={() => {
            setAuditRefreshKey(k => k + 1)
            fetchAsset()
          }}
        />

        {/* Chaos Engineering & Telemetry Simulation Panel */}
        <TelemetrySimulationPanel
          isOpen={isSimulationPanelOpen}
          onClose={() => setIsSimulationPanelOpen(false)}
          targetAsset={asset}
          assets={allAssets}
          onSimulationTick={() => {
            fetchMetrics()
            fetchTelemetryHistory()
          }}
        />
      </main>
  )
}

export default AssetDetail