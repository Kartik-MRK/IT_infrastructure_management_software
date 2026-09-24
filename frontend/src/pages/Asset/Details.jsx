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

// react-hot-toast has no `.warning` variant, so every warning-level threshold
// alert in this file threw a TypeError that the enclosing catch swallowed —
// meaning the "elevated CPU / high latency" warnings never actually appeared.
const warnToast = (message, opts = {}) =>
  toast(message, {
    ...opts,
    style: {
      background: 'var(--warn-soft)',
      border: '1px solid var(--warn-line)',
      color: 'var(--warn)',
      ...(opts.style || {}),
    },
  })

const STATUS_TONE = {
  active:      'badge-code badge-success',
  in_use:      'badge-code badge-info',
  maintenance: 'badge-code badge-warning',
  retired:     'badge-code badge-neutral',
  damaged:     'badge-code badge-danger',
  disposed:    'badge-code badge-neutral',
}

const TYPE_TONE = 'badge-code badge-neutral'

// A number's meaning should come from its value and label, not from a
// different pastel background per metric. One tile shape, one accent slot.
function Stat({ label, value, tone = 'var(--text)', meter, note }) {
  return (
    <div className="stat">
      <div className="flex items-baseline justify-between gap-3">
        <span className="stat-label">{label}</span>
        <span className="stat-value" style={{ color: tone }}>{value}</span>
      </div>
      {typeof meter === 'number' && (
        <div className="meter">
          <span
            className="meter-fill"
            style={{ width: `${Math.min(100, Math.max(0, meter))}%`, background: tone }}
          />
        </div>
      )}
      {note && <p className="stat-note">{note}</p>}
    </div>
  )
}

const tone = (v, warn, crit) =>
  v == null ? 'var(--text-faint)' : v >= crit ? 'var(--danger)' : v >= warn ? 'var(--warn)' : 'var(--ok)'

const pct = (v, digits = 1) => (v || v === 0 ? `${v.toFixed(digits)}%` : '—')

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
      const { data } = await supabase.from('assets').select('id, name, type').order('name')
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
        style: {
          background: 'var(--danger)',
          border: '1px solid var(--danger)',
          color: '#fff',
          fontWeight: 600,
        },
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
      
      warnToast(message, {
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
        warnToast(`⚠️ ${asset.name}: CPU usage high at ${cpuCurrent.toFixed(1)}%`, {
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
        warnToast(`⚠️ ${asset.name}: Memory usage high at ${memCurrent.toFixed(1)}%`, {
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
        warnToast(`⚠️ ${asset.name}: Temperature elevated at ${tempCurrent.toFixed(1)}°C`, {
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
        warnToast(`⚠️ ${asset.name}: Disk usage high at ${diskCurrent.toFixed(1)}%`, {
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
        warnToast(`⚠️ ${asset.name}: High packet loss at ${newMetrics.packet_loss_percent.toFixed(1)}%`, {
          duration: 4000
        })
      }

      // Network Latency
      if (newMetrics.latency_ms > 100 && (!previousMetrics.latency_ms || previousMetrics.latency_ms <= 100)) {
        warnToast(`⚠️ ${asset.name}: High latency at ${newMetrics.latency_ms.toFixed(0)}ms`, {
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
        warnToast(`⚠️ ${asset.name}: Service is degraded`, {
          duration: 4000,
          icon: '🟡'
        })
      }

      // Response Time
      if (newMetrics.response_time_ms > 500 && (!previousMetrics.response_time_ms || previousMetrics.response_time_ms <= 500)) {
        warnToast(`⚠️ ${asset.name}: Slow response time at ${newMetrics.response_time_ms.toFixed(0)}ms`, {
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

  const getStatusBadgeColor = (status) => STATUS_TONE[status] || STATUS_TONE.retired

  const getTypeBadgeColor = () => TYPE_TONE

  if (loading) {
    return (
      <main className="max-w-[1100px] mx-auto py-7 px-4 sm:px-6 lg:px-8 animate-fade-in flex flex-col gap-5">
        <div className="skeleton h-[13px] w-[110px]" />
        <div className="card flex flex-col gap-3">
          <div className="skeleton h-[22px] w-1/2" />
          <div className="skeleton h-[13px] w-1/3" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="skeleton h-[172px] !rounded-card" />
          <div className="skeleton h-[172px] !rounded-card" />
        </div>
      </main>
    )
  }

  if (error || !asset) {
    return (
      <main className="max-w-[1100px] mx-auto py-7 px-4 animate-fade-in">
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <p className="empty-state-title">Asset not found</p>
            <p className="empty-state-text">{error || 'The asset you are looking for does not exist, or has been deleted.'}</p>
            <button onClick={() => navigate('/assets')} className="btn-primary btn-sm mt-5">
              Back to inventory
            </button>
          </div>
        </div>
      </main>
    )
  }

  const healthTone =
    metrics?.health_status === 'healthy' ? { fg: 'var(--ok)',     cls: 'badge-code badge-success', label: 'Healthy telemetry' } :
    metrics?.health_status === 'warning' ? { fg: 'var(--warn)',   cls: 'badge-code badge-warning', label: 'Outlier warning'   } :
                                           { fg: 'var(--danger)', cls: 'badge-code badge-danger',  label: 'Critical outlier'  }

  const TABS = [
    { id: 'overview',        label: 'Overview & telemetry' },
    { id: 'topology',        label: 'Topology'             },
    { id: 'vulnerabilities', label: 'Vulnerabilities'      },
  ]

  return (
    <main className="max-w-[1100px] mx-auto py-7 px-4 sm:px-6 lg:px-8 animate-fade-in">

      <button onClick={() => navigate('/assets')} className="btn btn-ghost btn-sm !px-2 -ml-2 mb-3">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Asset inventory
      </button>

      {/* ── Asset header ── */}
      <div className="card-flush mb-5">
        <div className="p-5">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-[-0.02em] m-0 truncate" style={{ color: 'var(--text)' }}>
                {asset.name}
              </h1>
              <div className="flex items-center gap-1.5 mt-2">
                <span className={getTypeBadgeColor(asset.type)}>{asset.type}</span>
                <span className={getStatusBadgeColor(asset.status)}>{(asset.status || '').replace('_', ' ')}</span>
                {metrics && (
                  <span className={healthTone.cls}>
                    <span className="status-dot mr-1" style={{ background: healthTone.fg }} />
                    {healthTone.label}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {canEdit() && (
                <button onClick={() => setIsAddRelModalOpen(true)} className="btn-secondary btn-sm">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                  Map dependency
                </button>
              )}
              <button onClick={() => setIsTagModalOpen(true)} className="btn-secondary btn-sm" title="Generate QR code and printable asset tag">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="14" y1="14" x2="21" y2="21"/></svg>
                QR tag
              </button>
              {canEdit() && (
                <button onClick={() => setIsRecordAuditModalOpen(true)} className="btn-secondary btn-sm" title="Log a physical audit inspection">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                  Audit
                </button>
              )}
              {canEdit() && (
                <button onClick={() => navigate(`/assets/${id}/edit`)} className="btn-primary btn-sm">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
                  Edit
                </button>
              )}
              {canDelete() && (
                <button onClick={handleDelete} className="btn-danger-soft btn-sm">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  Delete
                </button>
              )}
            </div>
          </div>

          {asset.description && (
            <p className="text-[13px] leading-relaxed mt-3.5 mb-0" style={{ color: 'var(--text-soft)' }}>
              {asset.description}
            </p>
          )}
        </div>

        {/* Tabs — an underline that slides is the cheapest way to show
            which view you are in without repainting the whole header. */}
        <div className="flex gap-1 px-3" style={{ borderTop: '1px solid var(--line)' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="tab"
              data-active={activeTab === t.id}
            >
              {t.label}
              {t.id === 'topology' && blastRadiusData?.summary?.total_impacted > 0 && (
                <span className="badge-code badge-danger ml-1.5 !px-1.5 !py-0">
                  {blastRadiusData.summary.total_impacted}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

        {activeTab === 'overview' && (
          <>

        {/* ── Specification grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">

          <section className="card-flush">
            <div className="card-header"><p className="section-header !mb-0">Identity</p></div>
            <dl className="spec-list">
              <div><dt>Serial number</dt><dd className="font-mono">{asset.serial_number || '—'}</dd></div>
              <div><dt>Location</dt><dd>{asset.location || '—'}</dd></div>
              <div>
                <dt>Purchase cost</dt>
                <dd className="font-mono tnum">
                  {asset.cost
                    ? `₹${parseFloat(asset.cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : '—'}
                </dd>
              </div>
              <div><dt>Asset ID</dt><dd className="font-mono !text-[11px] truncate">{asset.id}</dd></div>
            </dl>
          </section>

          <section className="card-flush">
            <div className="card-header"><p className="section-header !mb-0">Lifecycle dates</p></div>
            <dl className="spec-list">
              <div>
                <dt>Purchased</dt>
                <dd className="tnum">{asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : '—'}</dd>
              </div>
              <div>
                <dt>Warranty expires</dt>
                <dd className="tnum">{asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString() : '—'}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd className="tnum">{new Date(asset.created_at).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd className="tnum">{new Date(asset.updated_at).toLocaleString()}</dd>
              </div>
            </dl>
          </section>

          <section className="card-flush md:col-span-2">
            <div className="card-header"><p className="section-header !mb-0">Accountability</p></div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { role: 'Assigned to', person: asset.assignee, fallback: 'Not assigned' },
                { role: 'Created by',  person: asset.creator,  fallback: 'Unknown'      },
              ].map(({ role, person, fallback }) => (
                <div key={role}>
                  <p className="field-label">{role}</p>
                  {person ? (
                    <div className="flex items-center gap-2.5">
                      <span className="avatar">
                        {(person.full_name || person.email || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                          {person.full_name || '—'}
                        </span>
                        <span className="block text-[11.5px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {person.email}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <p className="text-[13px] m-0" style={{ color: 'var(--text-faint)' }}>{fallback}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Software licensing (software assets only) ── */}
        {asset.type === 'software' && (
          <section className="card-flush mb-5" style={{ borderLeft: '3px solid var(--brand)' }}>
            <div className="card-header">
              <div>
                <div className="flex items-center gap-2">
                  <p className="section-header !mb-0">Licensing &amp; seat compliance</p>
                  <span className="badge-code badge-neutral">
                    {licenses.length} {licenses.length === 1 ? 'pool' : 'pools'}
                  </span>
                </div>
                <p className="text-[11.5px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>
                  Multi-seat licenses, activation keys, renewal dates, and device allocations.
                </p>
              </div>

              {canEdit() && (
                <button onClick={() => setIsCreateLicenseModalOpen(true)} className="btn-primary btn-sm">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Register pool
                </button>
              )}
            </div>

            {licenses && licenses.length > 0 ? (
              <div className="p-5 grid grid-cols-1 gap-4 stagger">
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
              <div className="empty-state !py-10">
                <div className="empty-state-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v6a4 4 0 00-4 4v6H8v-6a4 4 0 00-4-4z"/></svg>
                </div>
                <p className="empty-state-title">No licenses registered</p>
                <p className="empty-state-text">
                  Register a license key and seat capacity to start tracking hardware allocations and compliance.
                </p>
                {canEdit() && (
                  <button onClick={() => setIsCreateLicenseModalOpen(true)} className="btn-secondary btn-sm mt-5">
                    Register first license
                  </button>
                )}
              </div>
            )}
          </section>
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

        {/* ── Real-time telemetry ── */}
        {metrics && (
          <section className="card-flush mb-5">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <p className="section-header !mb-0">Real-time telemetry</p>
                <span className="pulse-dot" style={{ background: healthTone.fg }} />
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-mono tnum" style={{ color: 'var(--text-faint)' }}>
                  {new Date(metrics.last_updated).toLocaleTimeString()}
                </span>
                <button type="button" onClick={() => setIsSimulationPanelOpen(true)} className="btn-secondary btn-sm">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.5L4.5 19A2 2 0 006.2 22h11.6a2 2 0 001.7-3L14 9.5V2"/><path d="M8.5 2h7"/></svg>
                  Chaos simulator
                </button>
              </div>
            </div>

            <div className="p-5">

              {/* Hardware */}
              {asset.type === 'hardware' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Stat
                    label="CPU load"
                    value={pct(metrics.cpu_usage)}
                    tone={tone(metrics.cpu_usage, 75, 90)}
                    meter={metrics.cpu_usage || 0}
                  />
                  <Stat
                    label="Memory"
                    value={pct(metrics.memory_usage)}
                    tone={tone(metrics.memory_usage, 75, 90)}
                    meter={metrics.memory_usage || 0}
                  />
                  <Stat
                    label="Disk"
                    value={pct(metrics.disk_usage)}
                    tone={tone(metrics.disk_usage, 80, 95)}
                    meter={metrics.disk_usage || 0}
                  />
                  <Stat
                    label="Temperature"
                    value={metrics.temperature ? `${metrics.temperature.toFixed(1)}°C` : '—'}
                    tone={tone(metrics.temperature, 65, 75)}
                    meter={metrics.temperature ? (metrics.temperature / 100) * 100 : 0}
                  />
                </div>
              )}

              {/* Software */}
              {asset.type === 'software' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Stat
                    label="Operational status"
                    value={metrics.is_operational ? 'Working' : 'Not working'}
                    tone={metrics.is_operational ? 'var(--ok)' : 'var(--danger)'}
                    note={metrics.last_error ? `Last error — ${metrics.last_error}` : null}
                  />
                  <Stat
                    label="Uptime"
                    value={metrics.uptime_hours ? `${metrics.uptime_hours.toFixed(1)} h` : '—'}
                    tone="var(--info)"
                  />
                </div>
              )}

              {/* Network */}
              {asset.type === 'network' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Stat
                    label="Bandwidth"
                    value={metrics.bandwidth_usage_mbps ? `${metrics.bandwidth_usage_mbps.toFixed(1)} Mbps` : '—'}
                    tone="var(--info)"
                  />
                  <Stat
                    label="Packet loss"
                    value={pct(metrics.packet_loss_percent, 2)}
                    tone={tone(metrics.packet_loss_percent, 2, 5)}
                  />
                  <Stat
                    label="Latency"
                    value={metrics.latency_ms ? `${metrics.latency_ms.toFixed(1)} ms` : '—'}
                    tone={tone(metrics.latency_ms, 50, 100)}
                  />
                  <Stat
                    label="Active connections"
                    value={metrics.active_connections ?? '—'}
                    tone="var(--text)"
                  />
                </div>
              )}

              {/* Infrastructure */}
              {asset.type === 'infrastructure' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Stat
                    label="Service status"
                    value={
                      metrics.service_status === 'healthy'  ? 'Healthy'  :
                      metrics.service_status === 'degraded' ? 'Degraded' : 'Down'
                    }
                    tone={
                      metrics.service_status === 'healthy'  ? 'var(--ok)'   :
                      metrics.service_status === 'degraded' ? 'var(--warn)' : 'var(--danger)'
                    }
                  />
                  <Stat
                    label="Response time"
                    value={metrics.response_time_ms ? `${metrics.response_time_ms.toFixed(1)} ms` : '—'}
                    tone={tone(metrics.response_time_ms, 300, 500)}
                  />
                  <Stat
                    label="Error rate"
                    value={pct(metrics.error_rate_percent, 2)}
                    tone={tone(metrics.error_rate_percent, 1, 5)}
                  />
                  <Stat
                    label="Availability"
                    value={pct(metrics.availability_percent, 2)}
                    tone={
                      metrics.availability_percent == null ? 'var(--text-faint)'
                        : metrics.availability_percent < 99 ? 'var(--danger)' : 'var(--ok)'
                    }
                    meter={metrics.availability_percent || 0}
                  />
                </div>
              )}

              {/* Peripherals */}
              {asset.type === 'peripherals' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Stat
                    label="Connection"
                    value={
                      metrics.connection_status === 'connected'    ? 'Connected'    :
                      metrics.connection_status === 'intermittent' ? 'Intermittent' : 'Disconnected'
                    }
                    tone={
                      metrics.connection_status === 'connected'    ? 'var(--ok)'   :
                      metrics.connection_status === 'intermittent' ? 'var(--warn)' : 'var(--danger)'
                    }
                  />
                  {metrics.print_status && (
                    <Stat
                      label="Print status"
                      value={
                        metrics.print_status === 'online'     ? 'Online'     :
                        metrics.print_status === 'offline'    ? 'Offline'    :
                        metrics.print_status === 'paper_jam'  ? 'Paper jam'  :
                        metrics.print_status === 'low_toner'  ? 'Low toner'  : 'Error'
                      }
                      tone={
                        metrics.print_status === 'online'    ? 'var(--ok)'   :
                        metrics.print_status === 'low_toner' ? 'var(--warn)' : 'var(--danger)'
                      }
                    />
                  )}
                  <Stat
                    label="Usage hours"
                    value={metrics.usage_hours ? `${metrics.usage_hours.toFixed(1)} h` : '—'}
                    tone="var(--info)"
                  />
                  {metrics.peripheral_error && (
                    <div className="md:col-span-2">
                      <Stat label="Reported error" value="Attention" tone="var(--danger)" note={metrics.peripheral_error} />
                    </div>
                  )}
                </div>
              )}

              {/* Sparkline trends */}
              <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--line)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <p className="section-header !mb-0">Trends — 30-point rolling window</p>
                  <span className="badge-code badge-info">z-score σ</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <TelemetrySparkline
                    data={telemetryHistory}
                    metricKey="cpu_usage"
                    label="CPU Core Load"
                    unit="%"
                    color="#4f46e5"
                    fillGradientId="grad-sparkline-cpu"
                    threshold={90}
                    maxScale={100}
                  />
                  <TelemetrySparkline
                    data={telemetryHistory}
                    metricKey="memory_usage"
                    label="RAM Allocation"
                    unit="%"
                    color="#0891b2"
                    fillGradientId="grad-sparkline-mem"
                    threshold={92}
                    maxScale={100}
                  />
                  <TelemetrySparkline
                    data={telemetryHistory}
                    metricKey="disk_usage"
                    label="Storage Volume"
                    unit="%"
                    color="#7c3aed"
                    fillGradientId="grad-sparkline-disk"
                    threshold={95}
                    maxScale={100}
                  />
                  <TelemetrySparkline
                    data={telemetryHistory}
                    metricKey="latency_ms"
                    label="Network Latency"
                    unit="ms"
                    color="#d97706"
                    fillGradientId="grad-sparkline-lat"
                    threshold={50}
                    maxScale={150}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {!metrics && !loading && (
          <section className="card-flush mb-5">
            <div className="empty-state !py-10">
              <div className="empty-state-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <p className="empty-state-title">No telemetry yet</p>
              <p className="empty-state-text">
                Readings appear here once the monitoring agent reports for this asset.
              </p>
              <button onClick={() => setIsSimulationPanelOpen(true)} className="btn-secondary btn-sm mt-5">
                Open chaos simulator
              </button>
            </div>
          </section>
        )}
          </>
        )}

        {/* ── Topology & blast radius ── */}
        {activeTab === 'topology' && (
          <div className="flex flex-col gap-5 animate-fade-in">

            <section className="card-flush">
              <div className="card-header">
                <div>
                  <p className="section-header !mb-0">Dependency graph</p>
                  <p className="text-[11.5px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>
                    Direct connections and cascading downstream dependencies.
                  </p>
                </div>
                {canEdit() && (
                  <button onClick={() => setIsAddRelModalOpen(true)} className="btn-primary btn-sm">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add dependency
                  </button>
                )}
              </div>

              <div className="p-4">
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
            </section>

            {/* Blast radius */}
            {blastRadiusData && (
              <section
                className="card-flush"
                style={{
                  borderLeft: `3px solid ${
                    blastRadiusData.risk_level === 'CRITICAL' ? 'var(--danger)' :
                    blastRadiusData.risk_level === 'HIGH'     ? 'var(--warn)'   :
                    blastRadiusData.risk_level === 'MEDIUM'   ? '#ca8a04'       : 'var(--ok)'
                  }`,
                }}
              >
                <div className="card-header">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="section-header !mb-0">Blast radius</p>
                      <span className={
                        blastRadiusData.risk_level === 'CRITICAL' ? 'badge-code badge-danger'  :
                        blastRadiusData.risk_level === 'HIGH'     ? 'badge-code badge-warning' :
                        blastRadiusData.risk_level === 'MEDIUM'   ? 'badge-code badge-warning' :
                                                                    'badge-code badge-success'
                      }>
                        {blastRadiusData.risk_level} risk
                      </span>
                    </div>
                    <p className="text-[11.5px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>
                      Services affected if <strong style={{ color: 'var(--text-soft)' }}>{asset.name}</strong> goes down or enters maintenance.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {[
                      { label: 'Total',     value: blastRadiusData.summary.total_impacted,   fg: 'var(--text)'   },
                      { label: 'Direct',    value: blastRadiusData.summary.direct_impact,    fg: 'var(--danger)' },
                      { label: 'Cascading', value: blastRadiusData.summary.secondary_impact, fg: 'var(--warn)'   },
                    ].map(({ label, value, fg }) => (
                      <div key={label} className="blast-stat">
                        <span className="font-mono tnum text-[15px] font-bold" style={{ color: fg }}>{value}</span>
                        <span className="metric-label !text-[9.5px]">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {blastRadiusData.impacted_assets && blastRadiusData.impacted_assets.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Impacted asset</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Impact</th>
                          <th>Relationship</th>
                        </tr>
                      </thead>
                      <tbody>
                        {blastRadiusData.impacted_assets.map(item => (
                          <tr key={item.asset_id}>
                            <td>
                              <button
                                onClick={() => navigate(`/assets/${item.asset_id}`)}
                                className="link-cell"
                              >
                                {item.asset_name}
                              </button>
                            </td>
                            <td className="uppercase text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              {item.asset_type}
                            </td>
                            <td>
                              <span className={getStatusBadgeColor(item.asset_status)}>
                                {(item.asset_status || '').replace('_', ' ')}
                              </span>
                            </td>
                            <td>
                              <span className={item.impact_level === 'DIRECT_IMPACT' ? 'badge-code badge-danger' : 'badge-code badge-warning'}>
                                {item.impact_level === 'DIRECT_IMPACT' ? 'direct' : 'cascading'} · d{item.depth}
                              </span>
                            </td>
                            <td className="font-mono text-[11px]" style={{ color: 'var(--brand)' }}>
                              {item.relationship_type}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state !py-10">
                    <div className="empty-state-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                    <p className="empty-state-title">Nothing downstream</p>
                    <p className="empty-state-text">
                      No other recorded asset is directly impacted if this one goes down.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* Configured dependencies */}
            <section className="card-flush">
              <div className="card-header">
                <p className="section-header !mb-0">Configured dependencies</p>
                <span className="text-[11px] font-mono tnum" style={{ color: 'var(--text-faint)' }}>
                  {relationships.outgoing.length + relationships.incoming.length}
                </span>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: 'Outgoing — this asset serves',
                    rows: relationships.outgoing,
                    name: rel => rel.child?.name,
                    fg: 'var(--brand)',
                    empty: 'No outgoing dependencies mapped.',
                  },
                  {
                    title: 'Incoming — this asset depends on',
                    rows: relationships.incoming,
                    name: rel => rel.parent?.name,
                    fg: 'var(--info)',
                    empty: 'No incoming dependencies mapped.',
                  },
                ].map(({ title, rows, name, fg, empty }) => (
                  <div key={title}>
                    <p className="field-label">{title}</p>
                    {rows && rows.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {rows.map(rel => (
                          <div key={rel.id} className="rel-row">
                            <div className="min-w-0">
                              <p className="text-[12.5px] font-semibold truncate m-0" style={{ color: 'var(--text)' }}>
                                {name(rel) || 'Unknown asset'}
                              </p>
                              <p className="text-[11px] font-mono truncate m-0" style={{ color: fg }}>
                                {rel.relationship_type}
                              </p>
                            </div>
                            {canDelete() && (
                              <button
                                onClick={() => handleDeleteRelationship(rel.id)}
                                className="btn btn-ghost btn-icon shrink-0"
                                title="Remove dependency"
                                aria-label="Remove dependency"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] m-0" style={{ color: 'var(--text-faint)' }}>{empty}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
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

      <style>{`
        /* ── Tabs ── */
        .tab {
          position: relative;
          padding: 11px 12px 12px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          background: none;
          border: none;
          color: var(--text-muted);
          display: inline-flex;
          align-items: center;
          transition: color var(--t-press) var(--ease-out);
        }
        .tab::after {
          content: '';
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 0;
          height: 2px;
          border-radius: 2px 2px 0 0;
          background: var(--brand);
          transform: scaleX(0);
          transform-origin: center;
          transition: transform var(--t-pop) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .tab:hover { color: var(--text); }
        }
        .tab[data-active='true'] { color: var(--brand); }
        .tab[data-active='true']::after { transform: scaleX(1); }

        /* ── Spec lists ── */
        .spec-list > div {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 16px;
          padding: 10px 20px;
          border-bottom: 1px solid var(--line);
        }
        .spec-list > div:last-child { border-bottom: none; }
        .spec-list dt {
          font-size: 12px;
          color: var(--text-muted);
          white-space: nowrap;
        }
        .spec-list dd {
          font-size: 12.5px;
          font-weight: 500;
          color: var(--text);
          text-align: right;
          min-width: 0;
        }

        .avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          flex-shrink: 0;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 700;
          color: var(--brand);
          background: var(--brand-soft);
          border: 1px solid var(--brand-line);
        }

        /* ── Metric tiles ── */
        .stat {
          padding: 12px 14px;
          border-radius: 11px;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
        }
        .stat-label {
          font-size: 11.5px;
          font-weight: 500;
          color: var(--text-muted);
        }
        .stat-value {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-variant-numeric: tabular-nums;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .stat-note {
          margin: 7px 0 0;
          font-size: 11px;
          line-height: 1.45;
          color: var(--text-muted);
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          word-break: break-word;
        }

        /* The meter animates its width because the value arrives on a 10s
           poll — a jump reads as a glitch, a slide reads as a reading. */
        .meter {
          margin-top: 9px;
          height: 5px;
          border-radius: 3px;
          overflow: hidden;
          background: var(--line);
        }
        .meter-fill {
          display: block;
          height: 100%;
          border-radius: 3px;
          transition: width var(--t-panel) var(--ease-out), background-color var(--t-panel) var(--ease-out);
        }

        .pulse-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          animation: pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }

        .blast-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          min-width: 62px;
          padding: 5px 9px;
          border-radius: 10px;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
        }

        .rel-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 10px;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
          transition: border-color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .rel-row:hover { border-color: var(--line-strong); }
        }

        .link-cell {
          font-weight: 600;
          text-align: left;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          color: var(--text);
          transition: color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .link-cell:hover { color: var(--brand); }
        }

        @media (prefers-reduced-motion: reduce) {
          .pulse-dot { animation: none; opacity: 1; }
          .meter-fill { transition: none; }
        }
      `}</style>
      </main>
  )
}

export default AssetDetail