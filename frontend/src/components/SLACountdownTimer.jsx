import { useState, useEffect } from 'react'

// Shared by every branch so a 4-minute badge and a 4-hour badge read the
// same way. Seconds only appear on the live resolution countdown, where the
// user is watching the clock move.
function fmt(totalSec, withSeconds) {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (!withSeconds) return h > 0 ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`
}

const Dot = () => <span className="status-dot" style={{ background: 'currentColor' }} aria-hidden="true" />

export default function SLACountdownTimer({
  incident,
  type = 'resolution' // 'response' | 'resolution'
}) {
  const [now, setNow] = useState(Date.now())

  const isResolved = incident?.status === 'resolved' || incident?.status === 'closed'
  const isResponded = !!incident?.first_responded_at
  const settled = !incident || (type === 'response' ? isResponded : isResolved)
  const deadlineStr = type === 'response' ? incident?.response_deadline : incident?.resolution_deadline
  const live = !settled && !!deadlineStr

  // The old effect started a 1s interval for every incident on screen —
  // resolved ones and ones with no SLA included — so a 40-row table woke up
  // 40 times a second to re-render badges whose text could not change.
  // Response badges show whole minutes, so they tick at 30s.
  const tickMs = type === 'response' ? 30000 : 1000

  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setNow(Date.now()), tickMs)
    return () => clearInterval(id)
  }, [live, tickMs])

  if (!incident) return null

  // ── 1. Response SLA ───────────────────────────────────────────────────
  if (type === 'response') {
    if (isResponded) {
      const respondedAt = new Date(incident.first_responded_at).getTime()
      const createdAt = new Date(incident.reported_at || incident.created_at).getTime()
      const durationMin = Math.max(0, Math.round((respondedAt - createdAt) / (1000 * 60)))
      const wasBreached = incident.sla_response_breached

      return (
        <span
          className={`${wasBreached ? 'badge-danger' : 'badge-success'} tnum font-mono normal-case`}
          title={wasBreached ? 'Response SLA breached' : 'Response SLA met'}
        >
          <Dot />
          Ack {fmt(durationMin * 60, false)}
        </span>
      )
    }

    if (!incident.response_deadline) {
      return <span className="badge-neutral font-mono normal-case">No SLA</span>
    }

    const diffMs = new Date(incident.response_deadline).getTime() - now

    if (diffMs <= 0) {
      const overtimeMin = Math.floor(Math.abs(diffMs) / (1000 * 60))
      return (
        /* Was animate-pulse. A pill that throbs forever reads as a broken
           element, not an urgent one — the rising number is the urgency. */
        <span className="badge-danger tnum font-mono normal-case" title="Response SLA breached">
          <Dot />
          Ack overdue {fmt(overtimeMin * 60, false)}
        </span>
      )
    }

    const remainingMin = Math.ceil(diffMs / (1000 * 60))
    const isUrgent = remainingMin <= 15

    return (
      <span
        className={`${isUrgent ? 'badge-warning' : 'badge-info'} tnum font-mono normal-case`}
        title="Time left to acknowledge"
      >
        <Dot />
        Ack in {fmt(remainingMin * 60, false)}
      </span>
    )
  }

  // ── 2. Resolution SLA ─────────────────────────────────────────────────
  if (isResolved) {
    const resolvedAt = new Date(incident.resolved_at || incident.updated_at).getTime()
    const createdAt = new Date(incident.reported_at || incident.created_at).getTime()
    const durationMin = Math.max(0, Math.round((resolvedAt - createdAt) / (1000 * 60)))
    const wasBreached = incident.sla_resolution_breached

    return (
      <span
        className={`${wasBreached ? 'badge-danger' : 'badge-success'} tnum font-mono normal-case`}
        title={wasBreached ? 'Resolution SLA breached' : 'Resolution SLA met'}
      >
        <Dot />
        Closed in {fmt(durationMin * 60, false)}
      </span>
    )
  }

  if (!incident.resolution_deadline) {
    return <span className="badge-neutral font-mono normal-case">No SLA</span>
  }

  const deadline = new Date(incident.resolution_deadline).getTime()
  const diffMs = deadline - now

  if (diffMs <= 0) {
    const overtimeTotalSec = Math.floor(Math.abs(diffMs) / 1000)
    return (
      <span className="badge-danger tnum font-mono normal-case" title="Resolution SLA breached">
        <Dot />
        Breached +{fmt(overtimeTotalSec, true)}
      </span>
    )
  }

  const totalSec = Math.floor(diffMs / 1000)
  const totalDuration = deadline - new Date(incident.reported_at || incident.created_at).getTime()
  const percentRemaining = totalDuration > 0 ? (diffMs / totalDuration) * 100 : 100
  const isApproaching = percentRemaining < 20 || totalSec < 900 // < 15 mins

  return (
    <span
      className={`${isApproaching ? 'badge-warning' : 'badge-info'} tnum font-mono normal-case`}
      title="Time left to resolve"
    >
      <Dot />
      {fmt(totalSec, true)} left
    </span>
  )
}
