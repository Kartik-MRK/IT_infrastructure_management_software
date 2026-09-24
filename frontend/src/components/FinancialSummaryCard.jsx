import React, { useState, useEffect } from 'react'

// Headline figures round to whole rupees — two decimal places on a six-figure
// number is four characters of noise nobody reads. The amortization table
// keeps its paise, because that is a ledger and the cents have to tie out.
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const moneyExact = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Written out as literals: Tailwind tree-shakes @layer components, so a class
// name assembled from a template string can be dropped from the build.
const VERDICT = {
  REPLACEMENT_RECOMMENDED: { label: 'Replacement recommended', badge: 'badge-danger' },
  ELEVATED_MAINTENANCE:    { label: 'Elevated maintenance',    badge: 'badge-warning' },
  HEALTHY:                 { label: 'Healthy',                 badge: 'badge-success' },
}

const Chevron = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
       style={{
         transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
         transition: 'transform var(--t-press) var(--ease-out)',
       }}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const KPI = ({ label, value, sub }) => (
  <div className="afin-kpi">
    <span className="afin-kpi-label">{label}</span>
    <span className="afin-kpi-value">{value}</span>
    <span className="afin-kpi-sub">{sub}</span>
  </div>
)

export default function FinancialSummaryCard({ assetId, refreshKey }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showIncidents, setShowIncidents] = useState(false)

  useEffect(() => {
    if (assetId) {
      fetchFinancials()
    }
  }, [assetId, refreshKey])

  async function fetchFinancials() {
    try {
      setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`http://localhost:5000/api/assets/${assetId}/financials`, { headers })
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error('Failed to load asset financials:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    /* A sweep reads as "loading". The pulse it replaced read as "broken". */
    return <div className="skeleton" style={{ height: 300, borderRadius: 14, marginBottom: 24 }} />
  }

  if (!data || !data.financials) return null

  const f = data.financials
  const healthVerdict = data.health_verdict || 'HEALTHY'
  const schedule = data.depreciation_schedule || []
  const incidents = data.maintenance_incidents || []

  const purchaseCost = parseFloat(f.purchase_cost) || 0
  const bookValue = parseFloat(f.current_book_value) || 0
  const accumDep = parseFloat(f.accumulated_depreciation) || 0
  const maintTotal = parseFloat(f.maintenance_cost_total) || 0
  const tco = parseFloat(f.total_cost_of_ownership) || 0

  const bookPercent = purchaseCost > 0 ? Math.max(0, Math.min(100, Math.round((bookValue / purchaseCost) * 100))) : 100

  const verdict = VERDICT[healthVerdict] || { label: healthVerdict.replace(/_/g, ' '), badge: 'badge-neutral' }
  const barTone = bookPercent <= 20 ? 'danger' : bookPercent <= 45 ? 'warn' : 'ok'

  return (
    <div className="card afin-card">
      <div className="flex flex-col gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>
            Financial lifecycle &amp; TCO
          </h3>
          {/* The replacement verdict used to animate-pulse. A throbbing badge
              is harder to read than a still one, and this is the sentence the
              reader most needs to actually read. */}
          <span className={verdict.badge}>{verdict.label}</span>
        </div>

        <dl className="afin-meta">
          <div><dt>Method</dt><dd className="font-mono">{f.depreciation_method || 'straight_line'}</dd></div>
          <div><dt>Useful life</dt><dd className="tnum">{f.useful_life_years || 5} yrs</dd></div>
          <div><dt>Age</dt><dd className="tnum">{f.age_years || 0} yrs ({f.age_months || 0} mo)</dd></div>
        </dl>
      </div>

      <div className="afin-grid mb-4">
        <KPI label="Purchase CapEx" value={money(purchaseCost)} sub="Initial capital cost" />
        <KPI label="Net book value" value={money(bookValue)} sub={`${bookPercent}% of original value`} />
        <KPI
          label="Maintenance OpEx"
          value={money(maintTotal)}
          sub={`${incidents.length} repair ${incidents.length === 1 ? 'incident' : 'incidents'}`}
        />
        <KPI label="Total TCO" value={money(tco)} sub="CapEx + repairs + licences" />
      </div>

      <div className="afin-meter">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
          <span className="text-[11.5px] font-semibold" style={{ color: 'var(--text-soft)' }}>
            Remaining book value
          </span>
          <span className="text-[11.5px] tnum" style={{ color: 'var(--text-muted)' }}>
            Accumulated {moneyExact(accumDep)} · salvage floor {moneyExact(f.salvage_value)}
          </span>
        </div>

        <div className="afin-track">
          {/* Was a three-stop emerald→teal→purple gradient, which implied a
              scale the number does not have. One colour, and it changes only
              when the value crosses a threshold worth noticing. */}
          <div className="afin-fill" data-tone={barTone} style={{ width: `${bookPercent}%` }} />
        </div>

        <div className="flex items-center justify-between text-[10.5px] tnum mt-1" style={{ color: 'var(--text-faint)' }}>
          <span>{bookPercent}% remaining</span>
          <span>{100 - bookPercent}% depreciated</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-3 mt-4" style={{ borderTop: '1px solid var(--line)' }}>
        <button
          type="button"
          onClick={() => setShowSchedule(!showSchedule)}
          className="btn-ghost btn-sm"
          aria-expanded={showSchedule}
        >
          <Chevron open={showSchedule} />
          Depreciation schedule
        </button>

        {maintTotal > 0 && (
          <button
            type="button"
            onClick={() => setShowIncidents(!showIncidents)}
            className="btn-ghost btn-sm"
            aria-expanded={showIncidents}
          >
            <Chevron open={showIncidents} />
            Maintenance costs ({incidents.length})
          </button>
        )}
      </div>

      {showSchedule && schedule.length > 0 && (
        <div className="afin-panel">
          <h4 className="afin-panel-title">
            {f.useful_life_years || 5}-year amortization schedule
          </h4>
          {/* The table scrolls inside its own box so five money columns can
              never push the page sideways on a phone. */}
          <div className="afin-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Year</th>
                  <th className="text-right">Expense</th>
                  <th className="text-right">Accumulated</th>
                  <th className="text-right">Ending book value</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {schedule.map(row => (
                  <tr key={row.year_index}>
                    <td style={{ color: 'var(--text-muted)' }}>Year {row.year_index}</td>
                    <td className="tnum font-sans" style={{ color: 'var(--text-soft)' }}>{row.calendar_year}</td>
                    <td className="text-right tnum" style={{ color: 'var(--danger)' }}>
                      −{moneyExact(row.depreciation_expense)}
                    </td>
                    <td className="text-right tnum" style={{ color: 'var(--text-soft)' }}>
                      {moneyExact(row.accumulated_depreciation)}
                    </td>
                    <td className="text-right tnum font-bold" style={{ color: 'var(--text)' }}>
                      {moneyExact(row.ending_book_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showIncidents && incidents.length > 0 && (
        <div className="afin-panel">
          <h4 className="afin-panel-title">Incident repair history</h4>
          <div className="flex flex-col gap-2">
            {incidents.map(inc => (
              <div key={inc.id} className="afin-row">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                    {inc.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="badge-neutral">{inc.severity}</span>
                    <span className="badge-neutral">{String(inc.status || '').replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <span className="text-[12.5px] font-mono font-bold tnum shrink-0" style={{ color: 'var(--text)' }}>
                  {moneyExact(inc.maintenance_cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .afin-card {
          margin-bottom: 24px;
          border-left: 3px solid var(--ok);
        }

        .afin-meta {
          display: flex; flex-wrap: wrap; gap: 4px 16px;
          margin: 0;
        }
        .afin-meta > div { display: flex; align-items: baseline; gap: 5px; }
        .afin-meta dt {
          font-size: 10.5px; font-weight: 600;
          color: var(--text-faint);
        }
        /* The old line was one paragraph with purple, slate and cyan <strong>
           tags separated by interpuncts — three colours for three facts that
           carry no status at all. */
        .afin-meta dd {
          margin: 0;
          font-size: 11.5px; font-weight: 600;
          color: var(--text-soft);
        }

        .afin-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1px;
          padding: 1px;
          border-radius: 12px;
          overflow: hidden;
          background: var(--line);
          border: 1px solid var(--line);
        }
        @media (min-width: 780px) {
          .afin-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }

        .afin-kpi {
          display: flex; flex-direction: column; gap: 3px;
          min-width: 0;
          padding: 12px 13px;
          background: var(--surface-sunk);
        }
        .afin-kpi-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        /* Four values, four different colours — white, emerald, amber, purple —
           made hue mean "which metric is this" instead of "is this bad". */
        .afin-kpi-value {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 17px; font-weight: 700; line-height: 1.15;
          font-variant-numeric: tabular-nums;
          color: var(--text);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .afin-kpi-sub { font-size: 10.5px; color: var(--text-muted); }

        .afin-meter {
          padding: 12px 13px;
          border-radius: 12px;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
        }
        .afin-track {
          height: 7px;
          border-radius: 999px;
          overflow: hidden;
          background: var(--bg);
          border: 1px solid var(--line);
        }
        /* Width transitions because it only ever changes when new data lands —
           never while the user is interacting with it. */
        .afin-fill {
          height: 100%;
          border-radius: 999px;
          background: var(--ok);
          transition: width var(--t-panel) var(--ease-out);
        }
        .afin-fill[data-tone='warn']   { background: var(--warn); }
        .afin-fill[data-tone='danger'] { background: var(--danger); }

        .afin-panel {
          margin-top: 12px;
          padding: 12px 13px;
          border-radius: 12px;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
          opacity: 1;
          transform: translateY(0);
          transition:
            opacity var(--t-panel) var(--ease-out),
            transform var(--t-panel) var(--ease-out);
        }
        @starting-style {
          .afin-panel { opacity: 0; transform: translateY(-5px); }
        }
        .afin-panel-title {
          margin: 0 0 9px;
          font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-faint);
        }

        .afin-scroll {
          overflow-x: auto;
          border-radius: 10px;
          background: var(--surface);
          border: 1px solid var(--line);
        }

        .afin-row {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 9px 11px;
          border-radius: 10px;
          background: var(--surface);
          border: 1px solid var(--line);
          transition: border-color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .afin-row:hover { border-color: var(--line-strong); }
        }

        @media (prefers-reduced-motion: reduce) {
          .afin-fill { transition: none; }
          .afin-panel { transition-duration: 1ms; }
        }
      `}</style>
    </div>
  )
}
