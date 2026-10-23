import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../config/api'

// Every figure on this panel comes from the same backend that reports rupees
// in the asset and licence modules. Four of them used to be prefixed with `$`,
// which quietly changed what the number meant by a factor of eighty.
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const num = (v, fallback) => {
  const n = Number(v)
  // `sre.mttr_minutes || 45.0` printed the fallback whenever the real value
  // was 0 — the one value most worth celebrating became invisible.
  return Number.isFinite(n) ? n : fallback
}

const REFRESH_OPTIONS = [
  { value: 10, label: 'Live · 10s' },
  { value: 30, label: 'Live · 30s' },
  { value: 60, label: 'Live · 60s' },
  { value: 0,  label: 'Paused' },
]

const RefreshIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 11-2.64-6.36" /><polyline points="21 3 21 9 15 9" />
  </svg>
)

// The loading state renders instead of the grid, so it carries its own copy
// of the column rules.
const SKELETON_CSS = `
  .cc-skeleton-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  @media (min-width: 640px)  { .cc-skeleton-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (min-width: 1100px) { .cc-skeleton-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
`

const Row = ({ label, value, tone }) => (
  <div className="cc-row">
    <span className="cc-row-label">{label}</span>
    <span className="cc-row-value" data-tone={tone || 'default'}>{value}</span>
  </div>
)

export default function ExecutiveCommandCenter() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30) // seconds
  const [lastRefreshed, setLastRefreshed] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchMetrics()

    if (refreshInterval > 0) {
      const timer = setInterval(() => {
        fetchMetrics(false)
      }, refreshInterval * 1000)
      return () => clearInterval(timer)
    }
  }, [refreshInterval])

  async function fetchMetrics(showLoading = true) {
    try {
      if (showLoading) setLoading(true)
      setRefreshing(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE_URL}/command-center/metrics`, { headers })
      if (res.ok) {
        const json = await res.json()
        setData(json.command_center)
        setLastRefreshed(new Date())
      }
    } catch (err) {
      console.error('Command center fetch error:', err)
    } finally {
      if (showLoading) setLoading(false)
      setRefreshing(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-3" style={{ marginBottom: 32 }}>
        <div className="skeleton" style={{ height: 62, borderRadius: 14 }} />
        <div className="cc-skeleton-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 168, borderRadius: 14 }} />
          ))}
        </div>
        <style>{SKELETON_CSS}</style>
      </div>
    )
  }

  const healthScore = data?.composite_health_index ?? 100
  const sre = data?.sre_reliability || {}
  const tco = data?.financial_tco || {}
  const sec = data?.security_and_audit || {}
  const degradedList = data?.degraded_assets_radar || []

  // `health_tier` came back from the API and was never rendered — the label was
  // derived here instead. Keeping one source means the colour and the word can
  // never disagree with each other.
  const health =
    healthScore >= 85 ? { tone: 'ok',     label: 'Excellent' }
    : healthScore >= 65 ? { tone: 'warn',   label: 'Degraded' }
    : { tone: 'danger', label: 'Critical risk' }

  const HEALTH_BADGE = { ok: 'badge-success', warn: 'badge-warning', danger: 'badge-danger' }

  const chainValid = !!sec.audit_chain_valid
  const criticalCves = num(sec.critical_cves, 0)
  const highCves = num(sec.high_cves, 0)

  return (
    <section className="cc-shell">
      <div className="cc-head">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-[-0.01em] m-0" style={{ color: 'var(--text)' }}>
            Executive analytics &amp; SRE command centre
          </h2>
          <p className="text-[12px] mt-1 m-0" style={{ color: 'var(--text-muted)' }}>
            Composite health, reliability velocity, TCO intelligence and security posture in one view.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10.5px] font-mono tnum hidden sm:inline" style={{ color: 'var(--text-faint)' }}>
            {lastRefreshed.toLocaleTimeString()}
          </span>

          <select
            value={refreshInterval}
            onChange={e => setRefreshInterval(Number(e.target.value))}
            className="input-field !py-1.5 !text-[12px]"
            style={{ width: 'auto' }}
            aria-label="Auto-refresh interval"
          >
            {REFRESH_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Was a purple square containing the 🔄 emoji and no accessible
              name — a button whose only label rendered differently on every
              platform. */}
          <button
            type="button"
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
            className="btn-ghost btn-sm"
            aria-label="Refresh now"
          >
            {refreshing ? (
              <span
                className="animate-spin-fast rounded-full"
                style={{ width: 12, height: 12, border: '1.5px solid var(--line-strong)', borderTopColor: 'var(--text-soft)' }}
              />
            ) : (
              <RefreshIcon />
            )}
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      <div className="cc-grid">
        {/* ── Composite health ─────────────────────────────────────── */}
        <div className="cc-card" data-accent={health.tone}>
          <div className="cc-card-head">
            <span className="cc-card-title">Composite health</span>
            <span className={HEALTH_BADGE[health.tone]}>{health.label}</span>
          </div>

          <div className="cc-score">
            <span className="cc-score-value" data-tone={health.tone}>{healthScore}</span>
            <span className="cc-score-unit">/ 100</span>
          </div>

          {/* The score is on a fixed 0–100 scale, so a bar makes it readable
              at a glance instead of asking the reader to hold 100 in mind. */}
          <div className="cc-track">
            <div className="cc-fill" data-tone={health.tone} style={{ width: `${Math.max(0, Math.min(100, healthScore))}%` }} />
          </div>

          <div className="cc-foot">
            <span className="tnum">{criticalCves} critical CVEs</span>
            <span className="tnum">{num(sre.active_incidents, 0)} open incidents</span>
          </div>
        </div>

        {/* ── SRE reliability ──────────────────────────────────────── */}
        <div className="cc-card">
          <div className="cc-card-head">
            <span className="cc-card-title">SRE reliability</span>
          </div>

          <div className="flex flex-col">
            <Row label="SLA uptime" value={`${num(sre.sla_uptime_percent, 99.95)}%`} />
            <Row label="MTTR" value={`${num(sre.mttr_minutes, 45.0)}m`} />
            <Row label="MTTD" value={`${num(sre.mttd_minutes, 8.5)}m`} />
          </div>

          <div className="cc-foot">
            <span className="tnum">Error budget {num(sre.error_budget_remaining, 100)}%</span>
            <span className="tnum">{num(sre.resolved_incidents, 0)} resolved</span>
          </div>
        </div>

        {/* ── TCO & licence burn ───────────────────────────────────── */}
        <div className="cc-card">
          <div className="cc-card-head">
            <span className="cc-card-title">TCO &amp; licence burn</span>
          </div>

          <div className="flex flex-col">
            <Row label="Asset valuation" value={money(tco.total_asset_valuation)} />
            <Row label="Software spend" value={`${money(tco.monthly_software_spend)}/mo`} />
            {/* Wasted spend is the only figure here that is bad by nature, so
                it is the only one that gets a colour. */}
            <Row
              label="Unallocated seats"
              value={`${money(tco.wasted_unallocated_license_spend)}/mo`}
              tone={num(tco.wasted_unallocated_license_spend, 0) > 0 ? 'warn' : undefined}
            />
          </div>

          <div className="cc-foot">
            <span className="tnum">Annual depreciation ≈ {money(tco.annual_depreciation_estimate)}</span>
          </div>
        </div>

        {/* ── Security & audit ─────────────────────────────────────── */}
        <div className="cc-card">
          <div className="cc-card-head">
            <span className="cc-card-title">Security &amp; audit</span>
          </div>

          <div className="flex flex-col">
            <div className="cc-row">
              <span className="cc-row-label">Audit chain</span>
              <span className={chainValid ? 'badge-success' : 'badge-danger'}>
                {chainValid ? 'Verified' : 'Tampered'}
              </span>
            </div>
            <Row label="Critical CVEs" value={criticalCves} tone={criticalCves > 0 ? 'danger' : undefined} />
            <Row label="High CVEs" value={highCves} tone={highCves > 0 ? 'warn' : undefined} />
          </div>

          <div className="cc-foot">
            <Link to="/audit-ledger" className="cc-link">
              {num(sec.audited_blocks_count, 0)} ledger blocks
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {degradedList.length > 0 && (
        <div className="cc-radar">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <h4 className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.06em] m-0"
                style={{ color: 'var(--danger)' }}>
              Degraded infrastructure
              <span className="badge-danger tnum">{degradedList.length}</span>
            </h4>
            <span className="text-[10.5px] font-mono" style={{ color: 'var(--text-faint)' }}>
              Live topology traversal
            </span>
          </div>

          <div className="cc-radar-grid">
            {/* These were clickable <div>s calling navigate() — no keyboard
                access, no middle-click, no "open in new tab". A link is a
                link. */}
            {degradedList.map(node => (
              <Link key={node.id} to={`/assets/${node.id}`} className="cc-node">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                    {node.name}
                  </span>
                  <span className={node.health_status === 'critical' ? 'badge-danger' : 'badge-warning'}>
                    {node.health_status}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px]"
                     style={{ color: 'var(--text-muted)' }}>
                  <span>{node.type}</span>
                  <span className="tnum font-semibold" style={{ color: 'var(--danger)' }}>
                    {num(node.connected_dependencies_count, 0)} downstream
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <style>{`
        ${SKELETON_CSS}

        .cc-shell {
          display: flex; flex-direction: column; gap: 16px;
          margin-bottom: 32px;
          padding: 18px 20px;
          border-radius: 16px;
          /* Was a white→grey vertical gradient plus a dark-mode gradient that
             never activated. One flat surface reads as one panel. */
          background: var(--surface);
          border: 1px solid var(--line);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .cc-head {
          display: flex; flex-direction: column; gap: 12px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--line);
        }
        @media (min-width: 720px) {
          .cc-head { flex-direction: row; align-items: flex-start; justify-content: space-between; }
        }

        .cc-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 640px)  { .cc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (min-width: 1100px) { .cc-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

        .cc-card {
          display: flex; flex-direction: column; gap: 10px;
          min-width: 0;
          padding: 14px 15px;
          border-radius: 14px;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
        }
        .cc-card[data-accent='ok']     { border-left: 3px solid var(--ok); }
        .cc-card[data-accent='warn']   { border-left: 3px solid var(--warn); }
        .cc-card[data-accent='danger'] { border-left: 3px solid var(--danger); }

        .cc-card-head {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        /* Each card used to be titled by an emoji — ⚡ 💰 🛡️ — which sized and
           baselined differently on every OS and named nothing out loud. */
        .cc-card-title {
          font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-faint);
        }

        .cc-score {
          display: flex; align-items: baseline; justify-content: center; gap: 5px;
          padding: 4px 0;
        }
        .cc-score-value {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 40px; font-weight: 700; line-height: 1;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
          color: var(--text);
        }
        .cc-score-value[data-tone='ok']     { color: var(--ok); }
        .cc-score-value[data-tone='warn']   { color: var(--warn); }
        .cc-score-value[data-tone='danger'] { color: var(--danger); }
        .cc-score-unit {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 11px;
          color: var(--text-faint);
        }

        .cc-track {
          height: 5px;
          border-radius: 999px;
          overflow: hidden;
          background: var(--bg);
          border: 1px solid var(--line);
        }
        .cc-fill {
          height: 100%;
          border-radius: 999px;
          background: var(--ok);
          transition: width var(--t-panel) var(--ease-out);
        }
        .cc-fill[data-tone='warn']   { background: var(--warn); }
        .cc-fill[data-tone='danger'] { background: var(--danger); }

        .cc-row {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          padding: 5px 0;
        }
        .cc-row + .cc-row { border-top: 1px solid var(--line); }
        .cc-row-label { font-size: 11.5px; color: var(--text-muted); }
        /* Values were emerald, cyan, purple and amber by metric. Colour now
           only appears when a number is actually worth reacting to. */
        .cc-row-value {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 12.5px; font-weight: 700;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          color: var(--text);
        }
        .cc-row-value[data-tone='warn']   { color: var(--warn); }
        .cc-row-value[data-tone='danger'] { color: var(--danger); }
        .cc-row-value[data-tone='ok']     { color: var(--ok); }

        .cc-foot {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          margin-top: auto;
          padding-top: 8px;
          font-size: 10.5px;
          color: var(--text-faint);
          border-top: 1px solid var(--line);
        }

        .cc-link {
          display: inline-flex; align-items: center; gap: 3px;
          font-weight: 600;
          color: var(--brand);
          transition: color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .cc-link:hover { color: var(--brand-hover); text-decoration: underline; }
        }

        .cc-radar {
          padding: 14px 15px;
          border-radius: 14px;
          background: var(--danger-soft);
          border: 1px solid var(--danger-line);
        }
        .cc-radar-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }
        @media (min-width: 640px)  { .cc-radar-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (min-width: 1000px) { .cc-radar-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

        .cc-node {
          display: block;
          min-width: 0;
          padding: 10px 11px;
          border-radius: 11px;
          background: var(--surface);
          border: 1px solid var(--line);
          transition:
            transform var(--t-press) var(--ease-out),
            border-color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .cc-node:hover { border-color: var(--danger); }
        }
        .cc-node:active { transform: scale(0.985); }

        @media (prefers-reduced-motion: reduce) {
          .cc-fill { transition: none; }
        }
      `}</style>
    </section>
  )
}
