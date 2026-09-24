import React from 'react'
import { Link } from 'react-router-dom'

const AlertIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

export default function AssetAnomalyBanner({ latestTelemetry, onOpenSimulator }) {
  if (!latestTelemetry || !latestTelemetry.is_anomaly) return null

  const reasons = latestTelemetry.anomaly_reasons || []
  const raw = latestTelemetry.anomaly_score
  const score = Number.isFinite(Number(raw)) ? Number(raw).toFixed(1) : (raw || '3.0+')

  return (
    <div className="anomaly-banner" role="alert">
      <span className="rail" aria-hidden="true" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="icon-well"><AlertIcon /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-[13px] font-bold m-0" style={{ color: 'var(--danger)' }}>
                Anomaly detected — {score}σ from baseline
              </h4>
              <span className="badge-code badge-danger">SRE alert</span>
            </div>

            {reasons.length > 0 ? (
              <ul className="reason-list">
                {reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            ) : (
              <p className="text-[12px] mt-1 mb-0" style={{ color: 'var(--text-soft)' }}>
                Telemetry metrics exceeded the rolling historical baseline for this asset.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {/* Was labelled "View Incident" but navigates to the whole queue —
              nothing here identifies a single incident to open. */}
          <Link to="/incidents" className="btn-danger btn-sm">Open incident queue</Link>
          <button type="button" onClick={onOpenSimulator} className="btn-secondary btn-sm">
            Chaos simulator
          </button>
        </div>
      </div>

      <style>{`
        .anomaly-banner {
          position: relative;
          overflow: hidden;
          margin-bottom: 20px;
          padding: 14px 16px 14px 18px;
          border-radius: 14px;
          background: var(--danger-soft);
          border: 1px solid var(--danger-line);
          /* Enters once, when telemetry arrives — animating it stops the
             page from jolting as a new block appears mid-scroll. */
          opacity: 1;
          transform: translateY(0);
          transition:
            opacity var(--t-panel) var(--ease-out),
            transform var(--t-panel) var(--ease-out);
        }
        @starting-style {
          .anomaly-banner { opacity: 0; transform: translateY(-6px); }
        }

        /* A solid rail carries the alarm. The banner used to animate-pulse,
           which made its own text hard to read while it faded. */
        .rail {
          position: absolute;
          top: 0; left: 0; bottom: 0;
          width: 3px;
          background: var(--danger);
        }

        .icon-well {
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          width: 28px; height: 28px;
          border-radius: 9px;
          color: var(--danger);
          background: var(--surface);
          border: 1px solid var(--danger-line);
        }

        .reason-list {
          margin: 5px 0 0;
          padding: 0;
          list-style: none;
          display: flex; flex-direction: column; gap: 2px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 11.5px;
          color: var(--text-soft);
        }
        .reason-list li { position: relative; padding-left: 11px; }
        .reason-list li::before {
          content: '';
          position: absolute; left: 0; top: 6px;
          width: 4px; height: 4px;
          border-radius: 50%;
          background: var(--danger);
        }

        @media (prefers-reduced-motion: reduce) {
          .anomaly-banner { transition-duration: 1ms; }
        }
      `}</style>
    </div>
  )
}
