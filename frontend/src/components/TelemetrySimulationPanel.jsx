import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

export default function TelemetrySimulationPanel({
  isOpen,
  onClose,
  onSimulationTick,
  targetAsset = null,
  assets = []
}) {
  const [scenario, setScenario] = useState('normal')
  const [selectedAssetId, setSelectedAssetId] = useState(targetAsset?.id || '')
  const [isSimulating, setIsSimulating] = useState(false)
  const [isAutoStreaming, setIsAutoStreaming] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  useEffect(() => {
    if (targetAsset) {
      setSelectedAssetId(targetAsset.id)
    }
  }, [targetAsset])

  useEffect(() => {
    let interval = null
    if (isAutoStreaming) {
      interval = setInterval(() => {
        handleRunSimulation(true)
      }, 5000)
    }
    return () => clearInterval(interval)
  }, [isAutoStreaming, scenario, selectedAssetId])

  async function handleRunSimulation(silent = false) {
    try {
      setIsSimulating(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }

      const payload = {
        scenario,
        target_asset_id: selectedAssetId || undefined
      }

      const res = await fetch('http://localhost:5000/api/telemetry/simulate', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to execute simulation tick')
      }

      setLastResult(json)
      const anomalyFound = json.results?.some(r => r.evaluation?.is_anomaly)
      if (anomalyFound) {
        if (!silent) {
          toast.error('⚠️ Statistical Anomaly Detected! Automated incident created.', { duration: 4000 })
        }
      } else if (!silent) {
        toast.success(`Generated telemetry for ${json.simulated_count} asset(s)`)
      }

      onSimulationTick && onSimulationTick(json)
    } catch (err) {
      if (!silent) toast.error(err.message)
    } finally {
      setIsSimulating(false)
    }
  }

  if (!isOpen) return null

  const scenarios = [
    {
      id: 'normal',
      title: 'Normal Operations',
      desc: 'Nominal telemetry baselines with ±3% gaussian variation',
      icon: '🟢',
      border: 'border-emerald-500/40 hover:border-emerald-500'
    },
    {
      id: 'cpu_spike',
      title: 'CPU Throttling Surge',
      desc: 'Spikes CPU to 97-99% triggering Z-Score > 3.5σ outlier',
      icon: '🔴',
      border: 'border-rose-500/40 hover:border-rose-500'
    },
    {
      id: 'memory_leak',
      title: 'Gradual Memory Leak',
      desc: 'RAM usage exceeds 94% critical exhaustion ceiling',
      icon: '🟣',
      border: 'border-purple-500/40 hover:border-purple-500'
    },
    {
      id: 'ddos_surge',
      title: 'DDoS SYN Flood & Latency Spike',
      desc: 'Bandwidth > 1 Gbps, 200ms+ latency, 15% HTTP errors',
      icon: '🟡',
      border: 'border-amber-500/40 hover:border-amber-500'
    },
    {
      id: 'disk_exhaustion',
      title: 'Disk Volume Exhaustion',
      desc: 'Storage usage hits 98% requiring emergency cleanup',
      icon: '🟠',
      border: 'border-orange-500/40 hover:border-orange-500'
    }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-space">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧪</span>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                SRE Telemetry & Chaos Simulation Suite
              </h3>
              <p className="text-[11px] text-slate-400">
                Inject realistic chaos workloads to validate outlier detection and automated incident creation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Target Asset Selector */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Target Asset for Scenario Injection
          </label>
          <select
            value={selectedAssetId}
            onChange={e => setSelectedAssetId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">⚡ All Active Infrastructure Assets</option>
            {assets.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.type})
              </option>
            ))}
          </select>
        </div>

        {/* Scenario Grid */}
        <div className="space-y-2 mb-5">
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Select Chaos Injection Scenario
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {scenarios.map(sc => (
              <div
                key={sc.id}
                onClick={() => setScenario(sc.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  scenario === sc.id
                    ? 'bg-slate-800/90 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                    : `bg-slate-950/60 ${sc.border}`
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{sc.icon}</span>
                  <span className="text-xs font-bold text-white">{sc.title}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 pl-6 leading-relaxed">
                  {sc.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Last Simulation Feedback */}
        {lastResult && (
          <div className="mb-5 p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-slate-300">Latest Simulation Run:</span>
              <span className="font-mono text-cyan-400">
                {lastResult.simulated_count} Assets Evaluated
              </span>
            </div>
            {lastResult.results?.some(r => r.evaluation?.is_anomaly) ? (
              <div className="text-[11px] text-rose-400 font-mono flex items-center gap-1.5 mt-1">
                <span className="animate-ping w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Anomaly Triggered: Z-Score Outlier Evaluated • Automated Incident Dispatched!</span>
              </div>
            ) : (
              <div className="text-[11px] text-emerald-400 font-mono mt-1">
                ✓ All telemetry metrics within healthy standard deviation boundaries.
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer self-start sm:self-auto">
            <input
              type="checkbox"
              checked={isAutoStreaming}
              onChange={e => setIsAutoStreaming(e.target.checked)}
              className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400"
            />
            <span className="flex items-center gap-1.5">
              <span>Auto-Stream (Every 5s)</span>
              {isAutoStreaming && (
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              )}
            </span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all flex-1 sm:flex-none cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isSimulating}
              onClick={() => handleRunSimulation(false)}
              className="px-4 py-2 text-xs font-bold text-slate-900 bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 flex-1 sm:flex-none cursor-pointer"
            >
              <span>⚡</span>
              <span>{isSimulating ? 'Evaluating...' : 'Run Simulation Tick'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
