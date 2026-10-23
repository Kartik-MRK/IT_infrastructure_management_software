import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../config/api'

// Values are rupees, so the grouping has to be Indian (1,00,000 not 100,000).
// `toLocaleString(undefined, …)` followed whatever locale the browser was set
// to, which put western grouping on a ₹ figure.
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const KPI = ({ label, value, sub, tone }) => (
  <div className="fin-kpi">
    <span className="fin-kpi-label">{label}</span>
    <span className="fin-kpi-value" data-tone={tone || 'default'}>{value}</span>
    <span className="fin-kpi-sub">{sub}</span>
  </div>
)

export default function ExecutiveFinancialWidget() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExecutiveSummary()
  }, [])

  async function fetchExecutiveSummary() {
    try {
      setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE_URL}/financials/executive-summary`, { headers })
      if (res.ok) {
        const json = await res.json()
        setSummary(json)
      }
    } catch (err) {
      console.error('Failed to load executive financial summary:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="skeleton" style={{ height: 260, borderRadius: 14, marginBottom: 24 }} />
  }

  if (!summary || !summary.overview) return null

  const ov = summary.overview
  const byType = summary.by_type || {}

  const capex = parseFloat(ov.total_capitalized_investment) || 0
  const bookVal = parseFloat(ov.total_current_book_value) || 0
  const depPercent = parseFloat(ov.overall_depreciation_percent) || 0
  const maintOpex = parseFloat(ov.total_maintenance_expenditure) || 0
  const tco = parseFloat(ov.total_infrastructure_tco) || 0
  const assetCount = ov.total_assets_tracked || 0

  const retained = Math.max(0, 100 - depPercent)
  // Colour follows how far the portfolio has been written down, which is the
  // only one of these five numbers that has a good and a bad direction.
  const depTone = depPercent >= 75 ? 'danger' : depPercent >= 50 ? 'warn' : 'ok'

  return (
    <div className="card fin-widget">
      <div className="flex flex-col gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>
            Financial position &amp; TCO
          </h3>
          <span className="badge-neutral tnum">{assetCount} capital assets</span>
        </div>
        <p className="text-[12px] m-0" style={{ color: 'var(--text-muted)' }}>
          Book valuation, accumulated depreciation, maintenance spend and total cost of ownership.
        </p>
      </div>

      <div className="fin-grid mb-4">
        <KPI label="Capitalised value" value={money(capex)} sub="Initial procurement CapEx" />
        <KPI label="Net book value" value={money(bookVal)} sub="Current depreciated balance" />
        <KPI label="Maintenance OpEx" value={money(maintOpex)} sub="Incident repair spend to date" />
        <KPI label="Total TCO" value={money(tco)} sub="CapEx + repairs + software" />
      </div>

      <div className="fin-meter">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
          <span className="text-[11.5px] font-semibold" style={{ color: 'var(--text-soft)' }}>
            Capital written down
          </span>
          <span className="text-[11.5px] tnum" style={{ color: 'var(--text-muted)' }}>
            <strong style={{ color: `var(--${depTone === 'ok' ? 'ok' : depTone})` }}>{depPercent}%</strong> depreciated
            {' · '}
            <strong style={{ color: 'var(--text-soft)' }}>{retained.toFixed(1)}%</strong> retained
          </span>
        </div>

        <div className="meter-track">
          {/* Width used to be floored at 5%, so a fully written-down
              portfolio still showed a sliver of retained value. */}
          <div className="meter-fill" data-tone={depTone} style={{ width: `${retained}%` }} />
        </div>
      </div>

      {Object.keys(byType).length > 0 && (
        <div className="pt-3 mt-4" style={{ borderTop: '1px solid var(--line)' }}>
          <h4 className="text-[11px] font-bold uppercase tracking-[0.06em] mb-2.5 m-0"
              style={{ color: 'var(--text-faint)' }}>
            Capital allocation by category
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {Object.entries(byType).map(([type, stats]) => (
              <div key={type} className="fin-cat">
                <div className="text-[12px] font-bold capitalize" style={{ color: 'var(--text)' }}>{type}</div>
                <div className="text-[11.5px] font-mono tnum mt-0.5" style={{ color: 'var(--text-soft)' }}>
                  {money(stats.total_cost)}
                </div>
                <div className="text-[10.5px] mt-0.5 tnum" style={{ color: 'var(--text-faint)' }}>
                  {stats.asset_count} {stats.asset_count === 1 ? 'asset' : 'assets'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .fin-widget {
          margin-bottom: 24px;
          border-left: 3px solid var(--ok);
        }

        .fin-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1px;
          padding: 1px;
          border-radius: 12px;
          overflow: hidden;
          background: var(--line);
          border: 1px solid var(--line);
        }
        @media (min-width: 820px) {
          .fin-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }

        .fin-kpi {
          display: flex; flex-direction: column; gap: 3px;
          min-width: 0;
          padding: 12px 13px;
          background: var(--surface-sunk);
        }
        .fin-kpi-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        /* All four were a different colour — white, emerald, amber, purple —
           which made hue mean "which metric" instead of "how is it doing".
           Money is money; none of these four has a bad direction. */
        .fin-kpi-value {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 18px; font-weight: 700; line-height: 1.15;
          font-variant-numeric: tabular-nums;
          color: var(--text);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .fin-kpi-sub { font-size: 10.5px; color: var(--text-muted); }

        .fin-meter {
          padding: 12px 13px;
          border-radius: 12px;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
        }
        .meter-track {
          height: 7px;
          border-radius: 999px;
          overflow: hidden;
          background: var(--bg);
          border: 1px solid var(--line);
        }
        /* Was a three-stop gradient, which implied a scale the number does
           not have. Width animates because it only changes on data arrival. */
        .meter-fill {
          height: 100%;
          border-radius: 999px;
          background: var(--ok);
          transition: width var(--t-panel) var(--ease-out);
        }
        .meter-fill[data-tone='warn']   { background: var(--warn); }
        .meter-fill[data-tone='danger'] { background: var(--danger); }

        .fin-cat {
          padding: 9px 10px;
          border-radius: 11px;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
        }

        @media (prefers-reduced-motion: reduce) {
          .meter-fill { transition: none; }
        }
      `}</style>
    </div>
  )
}
