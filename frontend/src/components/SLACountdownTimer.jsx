import React, { useState, useEffect } from 'react'

export default function SLACountdownTimer({
  incident,
  type = 'resolution', // 'response' | 'resolution'
  compact = false
}) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    // Refresh timer every second
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (!incident) return null

  const isResolved = incident.status === 'resolved' || incident.status === 'closed'
  const isResponded = !!incident.first_responded_at

  // 1. Response SLA Timer
  if (type === 'response') {
    if (isResponded) {
      const respondedAt = new Date(incident.first_responded_at).getTime()
      const createdAt = new Date(incident.reported_at || incident.created_at).getTime()
      const durationMin = Math.max(0, Math.round((respondedAt - createdAt) / (1000 * 60)))
      const wasBreached = incident.sla_response_breached

      return (
        <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded-full border ${
          wasBreached
            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
        }`}>
          <span>{wasBreached ? '⚠️' : '✓'}</span>
          <span>Resp: {durationMin}m {wasBreached ? '(Breached)' : '(Met)'}</span>
        </span>
      )
    }

    if (!incident.response_deadline) {
      return <span className="text-[11px] text-slate-500 font-mono">No SLA</span>
    }

    const deadline = new Date(incident.response_deadline).getTime()
    const diffMs = deadline - now

    if (diffMs <= 0) {
      const overtimeMin = Math.floor(Math.abs(diffMs) / (1000 * 60))
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/60 animate-pulse">
          <span>⛔</span>
          <span>Resp Breached +{overtimeMin}m</span>
        </span>
      )
    }

    const remainingMin = Math.ceil(diffMs / (1000 * 60))
    const isUrgent = remainingMin <= 15

    return (
      <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
        isUrgent
          ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 animate-pulse'
          : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
      }`}>
        <span>{isUrgent ? '⏳' : '⚡'}</span>
        <span>Resp in {remainingMin}m</span>
      </span>
    )
  }

  // 2. Resolution SLA Timer
  if (isResolved) {
    const resolvedAt = new Date(incident.resolved_at || incident.updated_at).getTime()
    const createdAt = new Date(incident.reported_at || incident.created_at).getTime()
    const durationMin = Math.max(0, Math.round((resolvedAt - createdAt) / (1000 * 60)))
    const wasBreached = incident.sla_resolution_breached

    return (
      <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
        wasBreached
          ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
      }`}>
        <span>{wasBreached ? '⚠️' : '✓'}</span>
        <span>Resolved in {durationMin > 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin}m`} {wasBreached ? '(SLA Breached)' : '(SLA Met)'}</span>
      </span>
    )
  }

  if (!incident.resolution_deadline) {
    return <span className="text-[11px] text-slate-500 font-mono">No SLA</span>
  }

  const deadline = new Date(incident.resolution_deadline).getTime()
  const diffMs = deadline - now

  if (diffMs <= 0) {
    const overtimeTotalSec = Math.floor(Math.abs(diffMs) / 1000)
    const hours = Math.floor(overtimeTotalSec / 3600)
    const minutes = Math.floor((overtimeTotalSec % 3600) / 60)
    const seconds = overtimeTotalSec % 60

    return (
      <div className={`inline-flex items-center gap-1.5 font-mono text-xs font-bold px-3 py-1 rounded-full bg-rose-950/80 text-rose-400 border border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse`}>
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
        <span>BREACHED +{hours > 0 ? `${hours}h ` : ''}{minutes}m {seconds}s</span>
      </div>
    )
  }

  const totalSec = Math.floor(diffMs / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  const totalDuration = deadline - new Date(incident.reported_at || incident.created_at).getTime()
  const percentRemaining = totalDuration > 0 ? (diffMs / totalDuration) * 100 : 100
  const isApproaching = percentRemaining < 20 || totalSec < 900 // < 15 mins

  return (
    <div className={`inline-flex items-center gap-1.5 font-mono text-xs font-bold px-3 py-1 rounded-full border transition-all ${
      isApproaching
        ? 'bg-amber-950/60 text-amber-300 border-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.25)] animate-pulse'
        : 'bg-slate-900/90 text-cyan-300 border-cyan-500/40 shadow-sm'
    }`}>
      <span className={`w-2 h-2 rounded-full ${isApproaching ? 'bg-amber-400' : 'bg-cyan-400'}`}></span>
      <span>{hours > 0 ? `${hours}h ` : ''}{minutes}m {seconds}s left</span>
    </div>
  )
}
