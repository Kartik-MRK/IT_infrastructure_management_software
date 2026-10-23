import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../config/api'

// Minutes stop being readable somewhere past 90. Several of these fields can
// also arrive undefined, which used to render the string "undefinedm".
function fmtMinutes(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  if (n < 60) return `${Math.round(n)}m`
  const h = Math.floor(n / 60)
  const m = Math.round(n % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

const pct = (n) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`

// Written out rather than built with a template literal: Tailwind tree-shakes
// @layer components, so a class name it never sees as a literal can be
// dropped from the build.
const TONE_BADGE = { ok: 'badge-success', warn: 'badge-warning', danger: 'badge-danger' }

const Stat = ({ label, value, sub, tone }) => (
  <div className="sla-stat">
    <span className="sla-stat-label">{label}</span>
    <span className="sla-stat-value" data-tone={tone || 'default'}>{value}</span>
    <span className="sla-stat-sub">{sub}</span>
  </div>
)

export default function SLAComplianceWidget({ onOpenPolicyModal, canManagePolicy, refreshKey }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSummary()
  }, [refreshKey])

  async function fetchSummary() {
    try {
      setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE_URL}/sla/summary`, { headers })
      if (res.ok) {
        const json = await res.json()
        setSummary(json)
      }
    } catch (err) {
      console.error('Failed to load SLA summary:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    /* A sweep reads as "loading". The pulse it replaced read as "broken". */
    return <div className="skeleton" style={{ height: 168, borderRadius: 14, marginBottom: 24 }} />
  }

  if (!summary) return null

  const compliancePercent = parseFloat(summary.sla_compliance_percentage || 100)
  const activeBreaches = parseInt(summary.active_breached_count || 0)
  const approachingBreaches = parseInt(summary.active_approaching_count || 0)

  const complianceTone = compliancePercent >= 95 ? 'ok' : compliancePercent >= 80 ? 'warn' : 'danger'
  const alertTone = activeBreaches > 0 ? 'danger' : approachingBreaches > 0 ? 'warn' : 'ok'

  return (
    <div className="card sla-widget">
      <div className="flex flex-col gap-3 pb-4 mb-4 sm:flex-row sm:items-start sm:justify-between"
           style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>
              SLA reliability
            </h3>
            <span className={`${TONE_BADGE[complianceTone]} tnum`}>
              {pct(compliancePercent)} met
            </span>
          </div>
          <p className="text-[12px] mt-1 m-0" style={{ color: 'var(--text-muted)' }}>
            Contractual response and resolution compliance, with live countdowns on every open incident.
          </p>
        </div>

        {canManagePolicy && (
          <button type="button" onClick={onOpenPolicyModal} className="btn-secondary btn-sm shrink-0 self-start">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 010-4h.09A1.65 1.65 0 004.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 3.68V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9v0a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            Configure policies
          </button>
        )}
      </div>

      <div className="sla-grid">
        <Stat
          label="SLA attainment"
          value={pct(compliancePercent)}
          sub={`${summary.resolved_within_sla ?? 0} of ${summary.resolved_incidents ?? 0} resolved in target`}
          tone={complianceTone}
        />
        {/* MTTD and MTTR were cyan and purple, which made colour mean
            "which metric is this" instead of "is this value bad". */}
        <Stat
          label="Avg MTTD"
          value={fmtMinutes(summary.avg_mttd_minutes)}
          sub="Mean time to acknowledge"
        />
        <Stat
          label="Avg MTTR"
          value={fmtMinutes(summary.avg_mttr_minutes)}
          sub="Mean time to resolution"
        />
        <Stat
          label="Active alerts"
          value={
            activeBreaches > 0
              ? `${activeBreaches} breached`
              : approachingBreaches > 0
                ? `${approachingBreaches} at risk`
                : 'All clear'
          }
          sub={`${approachingBreaches} approaching deadline`}
          tone={alertTone}
        />
      </div>

      <style>{`
        .sla-widget {
          margin-bottom: 24px;
          border-left: 3px solid var(--brand);
        }

        .sla-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1px;
          padding: 1px;
          border-radius: 12px;
          overflow: hidden;
          background: var(--line);
          border: 1px solid var(--line);
        }
        @media (min-width: 720px) {
          .sla-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }

        /* Hairlines instead of four floating tiles — these numbers are one
           reading of one system, not four unrelated cards. */
        .sla-stat {
          display: flex; flex-direction: column; gap: 3px;
          min-width: 0;
          padding: 12px 13px;
          background: var(--surface-sunk);
        }
        .sla-stat-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .sla-stat-value {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 20px; font-weight: 700; line-height: 1.1;
          font-variant-numeric: tabular-nums;
          color: var(--text);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        /* Colour encodes threshold state only. */
        .sla-stat-value[data-tone='ok']     { color: var(--ok); }
        .sla-stat-value[data-tone='warn']   { color: var(--warn); }
        .sla-stat-value[data-tone='danger'] { color: var(--danger); }
        .sla-stat-sub { font-size: 10.5px; color: var(--text-muted); }
      `}</style>
    </div>
  )
}
