import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { API_BASE_URL } from '../config/api'

// Emoji circles were doing the work of a legend nobody could read: 🟢 🔴 🟣 🟡 🟠
// told you a colour, not a severity. Each scenario now declares the tone the
// rest of the app already uses, so "this one is destructive" is legible.
const SCENARIOS = [
  {
    id: 'normal',
    title: 'Normal operations',
    desc: 'Nominal baselines with ±3% gaussian variation',
    tone: 'ok',
  },
  {
    id: 'cpu_spike',
    title: 'CPU throttling surge',
    desc: 'Drives CPU to 97–99%, tripping a Z-score above 3.5σ',
    tone: 'danger',
  },
  {
    id: 'memory_leak',
    title: 'Gradual memory leak',
    desc: 'RAM climbs past the 94% exhaustion ceiling',
    tone: 'danger',
  },
  {
    id: 'ddos_surge',
    title: 'DDoS flood & latency spike',
    desc: 'Bandwidth over 1 Gbps, 200 ms latency, 15% HTTP errors',
    tone: 'warn',
  },
  {
    id: 'disk_exhaustion',
    title: 'Disk volume exhaustion',
    desc: 'Storage hits 98%, requiring emergency cleanup',
    tone: 'warn',
  },
]

const CloseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

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

  const handleRunSimulation = useCallback(async (silent = false) => {
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

      const res = await fetch(`${API_BASE_URL}/telemetry/simulate`, {
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
          toast.error('Anomaly detected — an incident was created automatically.', { duration: 4000 })
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
  }, [scenario, selectedAssetId, onSimulationTick])

  useEffect(() => {
    let interval = null
    // `isOpen` belongs in this condition: the early return below is after the
    // hooks, so closing the panel used to leave the 5s stream firing forever
    // with nothing on screen to say it was still writing telemetry.
    if (isOpen && isAutoStreaming) {
      interval = setInterval(() => {
        handleRunSimulation(true)
      }, 5000)
    }
    return () => clearInterval(interval)
  }, [isOpen, isAutoStreaming, handleRunSimulation])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const anomalyInLast = lastResult?.results?.some(r => r.evaluation?.is_anomaly)

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal max-w-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sim-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="min-w-0">
            <h3 id="sim-title" className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>
              Telemetry &amp; chaos simulation
            </h3>
            <p className="text-[12px] mt-1 m-0" style={{ color: 'var(--text-muted)' }}>
              Inject realistic workloads to validate outlier detection and automated incident creation.
            </p>
          </div>
          <button type="button" onClick={onClose} className="sim-close" aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body flex flex-col gap-4">
          <div>
            <label htmlFor="sim-target" className="sim-label">Target</label>
            <select
              id="sim-target"
              value={selectedAssetId}
              onChange={e => setSelectedAssetId(e.target.value)}
              className="input-field"
            >
              <option value="">All active infrastructure assets</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="sim-label">Scenario</span>
            {/* These were clickable <div>s — unreachable by keyboard, and
                invisible to assistive tech. A radiogroup of real buttons
                keeps the same one-tap behaviour and adds arrow-key access. */}
            <div className="sim-grid" role="radiogroup" aria-label="Chaos injection scenario">
              {SCENARIOS.map(sc => (
                <button
                  key={sc.id}
                  type="button"
                  role="radio"
                  aria-checked={scenario === sc.id}
                  onClick={() => setScenario(sc.id)}
                  className="sim-card"
                  data-active={scenario === sc.id}
                  data-tone={sc.tone}
                >
                  <span className="flex items-center gap-2">
                    <span className="sim-dot" aria-hidden="true" />
                    <span className="sim-card-title">{sc.title}</span>
                    {scenario === sc.id && (
                      <span className="sim-check" aria-hidden="true"><CheckIcon /></span>
                    )}
                  </span>
                  <span className="sim-card-desc">{sc.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {lastResult && (
            <div className="sim-result" data-tone={anomalyInLast ? 'danger' : 'ok'} role="status">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11.5px] font-bold" style={{ color: 'var(--text-soft)' }}>
                  Latest run
                </span>
                <span className="text-[11px] font-mono tnum" style={{ color: 'var(--text-muted)' }}>
                  {lastResult.simulated_count} evaluated
                </span>
              </div>
              {/* The anomaly line used to lead with an animate-ping dot. A
                  dot expanding out of the text made the sentence beside it
                  harder to read at exactly the moment it mattered most. */}
              <p className="text-[11.5px] mt-1 m-0"
                 style={{ color: anomalyInLast ? 'var(--danger)' : 'var(--ok)' }}>
                {anomalyInLast
                  ? 'Z-score outlier confirmed — an incident was dispatched automatically.'
                  : 'All metrics sit inside their standard-deviation envelope.'}
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer !justify-between">
          <label className="sim-stream">
            <input
              type="checkbox"
              checked={isAutoStreaming}
              onChange={e => setIsAutoStreaming(e.target.checked)}
            />
            <span>Auto-stream every 5s</span>
            {/* A pulse reads as "broken". A slow sweep is the one shape that
                reliably reads as "still running". */}
            {isAutoStreaming && <span className="sim-live" aria-hidden="true" />}
          </label>

          <div className="flex items-center gap-2.5">
            <button type="button" onClick={onClose} className="btn-ghost">Close</button>
            <button
              type="button"
              disabled={isSimulating}
              onClick={() => handleRunSimulation(false)}
              className="btn-primary"
            >
              {isSimulating && (
                <span
                  className="animate-spin-fast rounded-full"
                  style={{ width: 12, height: 12, border: '1.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
                />
              )}
              {isSimulating ? 'Evaluating…' : 'Run tick'}
            </button>
          </div>
        </div>

        <style>{`
          .sim-close {
            display: inline-flex; align-items: center; justify-content: center;
            flex-shrink: 0;
            width: 28px; height: 28px;
            border-radius: 8px;
            color: var(--text-muted);
            background: transparent;
            border: 1px solid transparent;
            cursor: pointer;
            transition:
              transform var(--t-press) var(--ease-out),
              color var(--t-press) var(--ease-out),
              background-color var(--t-press) var(--ease-out);
          }
          @media (hover: hover) and (pointer: fine) {
            .sim-close:hover { color: var(--text); background: var(--surface-hover); }
          }
          .sim-close:active { transform: scale(0.94); }

          .sim-label {
            display: block;
            margin-bottom: 5px;
            font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
            text-transform: uppercase;
            color: var(--text-muted);
          }

          .sim-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }
          @media (min-width: 640px) {
            .sim-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }

          .sim-card {
            display: flex; flex-direction: column; gap: 4px;
            padding: 10px 12px;
            border-radius: 12px;
            text-align: left;
            cursor: pointer;
            background: var(--surface-sunk);
            border: 1px solid var(--line);
            /* Named properties only — transition-all also eased the border
               colour, the shadow and the layout together, which is what made
               the old cards feel mushy on click. */
            transition:
              transform var(--t-press) var(--ease-out),
              border-color var(--t-press) var(--ease-out),
              box-shadow var(--t-press) var(--ease-out);
          }
          @media (hover: hover) and (pointer: fine) {
            .sim-card:hover { border-color: var(--line-strong); }
          }
          .sim-card:active { transform: scale(0.985); }
          .sim-card[data-active='true'] {
            background: var(--brand-soft);
            border-color: var(--brand);
            box-shadow: 0 0 0 1px var(--brand);
          }

          .sim-dot {
            flex-shrink: 0;
            width: 7px; height: 7px;
            border-radius: 999px;
            background: var(--text-faint);
          }
          .sim-card[data-tone='ok'] .sim-dot     { background: var(--ok); }
          .sim-card[data-tone='warn'] .sim-dot   { background: var(--warn); }
          .sim-card[data-tone='danger'] .sim-dot { background: var(--danger); }

          .sim-card-title {
            font-size: 12.5px; font-weight: 600;
            color: var(--text);
          }
          .sim-check {
            display: inline-flex;
            margin-left: auto;
            color: var(--brand);
          }
          .sim-card-desc {
            padding-left: 15px;
            font-size: 11px; line-height: 1.5;
            color: var(--text-muted);
          }

          .sim-result {
            padding: 10px 12px;
            border-radius: 12px;
            background: var(--surface-sunk);
            border: 1px solid var(--line);
            border-left-width: 3px;
            opacity: 1;
            transform: translateY(0);
            transition:
              opacity var(--t-panel) var(--ease-out),
              transform var(--t-panel) var(--ease-out);
          }
          .sim-result[data-tone='ok']     { border-left-color: var(--ok); }
          .sim-result[data-tone='danger'] { border-left-color: var(--danger); }
          @starting-style {
            .sim-result { opacity: 0; transform: translateY(-5px); }
          }

          .sim-stream {
            display: inline-flex; align-items: center; gap: 7px;
            font-size: 12px;
            color: var(--text-soft);
            cursor: pointer;
          }
          .sim-stream input {
            width: 15px; height: 15px;
            accent-color: var(--brand);
            cursor: pointer;
          }

          .sim-live {
            width: 34px; height: 3px;
            border-radius: 999px;
            overflow: hidden;
            background: var(--line-strong);
            position: relative;
          }
          .sim-live::after {
            content: '';
            position: absolute; inset: 0;
            border-radius: 999px;
            background: var(--brand);
            /* Constant motion is the one case keyframes beat transitions,
               and constant motion wants linear — anything eased would read
               as repeatedly starting over. */
            animation: sim-sweep 1.4s linear infinite;
          }
          @keyframes sim-sweep {
            from { transform: translateX(-100%); }
            to   { transform: translateX(100%); }
          }

          @media (prefers-reduced-motion: reduce) {
            .sim-result { transition-duration: 1ms; }
            .sim-live::after { animation-duration: 3s; }
          }
        `}</style>
      </div>
    </div>
  )
}
