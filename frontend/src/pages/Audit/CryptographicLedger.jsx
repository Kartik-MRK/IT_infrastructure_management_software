import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { API_BASE_URL } from '../../config/api'

const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 012-2h8" />
  </svg>
)

const CloseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const LockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="10.5" width="16" height="10.5" rx="2" />
    <path d="M8 10.5V7a4 4 0 018 0v3.5" />
  </svg>
)

const fmtWhen = (value) => {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

export default function CryptographicLedger() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [integrityReport, setIntegrityReport] = useState(null)
  const [selectedLogPayload, setSelectedLogPayload] = useState(null)
  const [certificateModal, setCertificateModal] = useState(null)
  const [actionFilter, setActionFilter] = useState('')
  const [auditorName, setAuditorName] = useState('Enterprise Compliance Auditor')

  useEffect(() => {
    handleVerifyChain(false) // silent initial verify
  }, [])

  useEffect(() => {
    // The filter used to call fetchLogs() from onChange, so typing "ASSET"
    // fired five overlapping requests whose responses could land out of
    // order — leaving the table showing results for a prefix the user had
    // already typed past. One request, 300ms after they stop.
    const id = setTimeout(() => fetchLogs(actionFilter), 300)
    return () => clearTimeout(id)
  }, [actionFilter])

  useEffect(() => {
    const open = selectedLogPayload || certificateModal
    if (!open) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setSelectedLogPayload(null)
      setCertificateModal(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedLogPayload, certificateModal])

  async function fetchLogs(filter = '') {
    try {
      setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const url = filter
        ? `${API_BASE_URL}/audit-ledger?action=${encodeURIComponent(filter)}`
        : `${API_BASE_URL}/audit-ledger`
      const res = await fetch(url, { headers })
      if (res.ok) {
        const json = await res.json()
        setLogs(json.audit_logs || [])
      }
    } catch (err) {
      toast.error('Failed to load cryptographic audit ledger')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyChain(showToast = true) {
    try {
      setVerifying(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE_URL}/audit-ledger/verify`, {
        method: 'POST',
        headers
      })
      const json = await res.json()
      if (res.ok) {
        setIntegrityReport(json.integrity_report)
        if (showToast) {
          if (json.integrity_report?.is_valid) {
            toast.success(`Chain verified — ${json.integrity_report.total_records} blocks intact`)
          } else {
            const broken = json.integrity_report?.broken_sequence_numbers?.join(', ') || 'unknown'
            toast.error(`Tamper alert — broken sequence at #${broken}`)
          }
        }
      }
    } catch (err) {
      if (showToast) toast.error('Failed to run chain integrity sweep')
    } finally {
      setVerifying(false)
    }
  }

  async function handleGenerateCertificate() {
    try {
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE_URL}/audit-ledger/compliance-certificate?auditor_name=${encodeURIComponent(auditorName)}`, { headers })
      const json = await res.json()
      if (res.ok) {
        setCertificateModal(json.certificate)
      } else {
        toast.error('Failed to generate compliance certificate')
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleCopyHash(hash) {
    try {
      await navigator.clipboard.writeText(hash)
      toast.success('Hash copied')
    } catch {
      // clipboard is unavailable outside a secure context. The old version let
      // the rejection go unhandled and reported success regardless.
      toast.error('Clipboard unavailable — select the hash to copy it manually')
    }
  }

  // Until the first sweep returns, `integrityReport?.is_valid` is undefined —
  // which the old badge rendered as "Integrity Compromised". Announcing a
  // tamper alert because data has not arrived yet is the worst possible
  // false positive on a page like this.
  const chain =
    integrityReport == null ? { badge: 'badge-neutral', label: verifying ? 'Verifying…' : 'Not yet verified' }
    : integrityReport.is_valid ? { badge: 'badge-success', label: 'Chain verified' }
    : { badge: 'badge-danger', label: 'Integrity compromised' }

  const tampered = integrityReport?.tampered_records_count || 0
  const tipHash = integrityReport?.merkle_head_hash

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="card mb-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-[19px] font-bold tracking-[-0.01em] m-0"
                style={{ color: 'var(--text)' }}>
              <span className="led-glyph"><LockIcon /></span>
              Cryptographic audit ledger
              {/* Was animate-pulse when compromised. A throbbing badge is the
                  hardest thing on the page to read, and this is the one word
                  a compliance auditor most needs to read. */}
              <span className={chain.badge}>{chain.label}</span>
            </h1>
            <p className="text-[12px] mt-1.5 m-0" style={{ color: 'var(--text-muted)' }}>
              Immutable SHA-256 hash-chained event trail for SOC 2 Type II and ISO 27001 Annex A.12.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2 shrink-0">
            <button
              type="button"
              disabled={verifying}
              onClick={() => handleVerifyChain(true)}
              className="btn-primary btn-sm"
            >
              {verifying && (
                <span
                  className="animate-spin-fast rounded-full"
                  style={{ width: 12, height: 12, border: '1.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
                />
              )}
              {verifying ? 'Verifying hashes…' : 'Run integrity sweep'}
            </button>

            {/* The auditor name was state with no input attached to it, so
                every certificate this app has ever issued was addressed to
                the hardcoded default. */}
            <div className="flex flex-col gap-1">
              <label htmlFor="auditor" className="text-[10px] font-bold uppercase tracking-[0.05em]"
                     style={{ color: 'var(--text-faint)' }}>
                Issue to
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="auditor"
                  type="text"
                  value={auditorName}
                  onChange={e => setAuditorName(e.target.value)}
                  placeholder="Auditor name"
                  className="input-field !py-1.5 !text-[12px]"
                  style={{ width: 200 }}
                />
                <button
                  type="button"
                  onClick={handleGenerateCertificate}
                  disabled={!auditorName.trim()}
                  className="btn-ghost btn-sm"
                >
                  Export certificate
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="led-grid mt-4">
          <div className="led-stat">
            <span className="led-stat-label">Audited events</span>
            <span className="led-stat-value">{integrityReport?.total_records ?? logs.length}</span>
            <span className="led-stat-sub">Sequentially chained</span>
          </div>

          <div className="led-stat">
            <span className="led-stat-label">Tampered records</span>
            <span className="led-stat-value" data-tone={tampered === 0 ? 'ok' : 'danger'}>{tampered}</span>
            <span className="led-stat-sub">Zero tolerance</span>
          </div>

          <div className="led-stat led-stat-wide">
            <span className="led-stat-label">Merkle head hash</span>
            <div className="flex items-center gap-2 min-w-0">
              <code className="led-hash">{tipHash || 'Awaiting first sweep'}</code>
              {tipHash && (
                <button type="button" onClick={() => handleCopyHash(tipHash)}
                        className="led-copy" aria-label="Copy tip hash">
                  <CopyIcon />
                </button>
              )}
            </div>
            <span className="led-stat-sub">SHA-256 canonical chaining</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <h2 className="text-[11.5px] font-bold uppercase tracking-[0.06em] m-0" style={{ color: 'var(--text-muted)' }}>
          Ledger timeline ({logs.length} blocks)
        </h2>

        <input
          type="text"
          placeholder="Filter by action — ASSET, INCIDENT…"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="input-field font-mono !text-[12px]"
          style={{ maxWidth: 260 }}
          aria-label="Filter ledger by action"
        />
      </div>

      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 flex flex-col gap-2">
            <div className="skeleton" style={{ height: 44, borderRadius: 10 }} />
            <div className="skeleton" style={{ height: 44, borderRadius: 10 }} />
            <div className="skeleton" style={{ height: 44, borderRadius: 10 }} />
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)"
                 strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h9l5 5v13H6z" /><path d="M15 3v5h5" /><path d="M9 13h6M9 17h4" />
            </svg>
            <h4>{actionFilter ? 'No blocks match that action' : 'No audit records yet'}</h4>
            <p>
              {actionFilter
                ? 'Clear the filter to see the whole chain.'
                : 'Every privileged change writes a hash-chained block here as soon as it happens.'}
            </p>
          </div>
        ) : (
          <div className="led-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Seq</th>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Hash chain</th>
                  <th className="text-right">Payload</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="font-mono font-bold tnum" style={{ color: 'var(--text)' }}>
                      #{String(log.sequence_number).padStart(4, '0')}
                    </td>

                    <td className="font-mono tnum whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {fmtWhen(log.created_at)}
                    </td>

                    <td>
                      <div className="text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                        {log.actor_email}
                      </div>
                      <div className="text-[10.5px] font-mono tnum" style={{ color: 'var(--text-faint)' }}>
                        {log.client_ip}
                      </div>
                    </td>

                    <td><span className="badge-code">{log.action}</span></td>

                    <td>
                      <div className="text-[12px] font-mono font-semibold" style={{ color: 'var(--text-soft)' }}>
                        {log.entity_type}
                      </div>
                      <div className="text-[10.5px] font-mono truncate" style={{ color: 'var(--text-faint)', maxWidth: 120 }}>
                        {log.entity_id}
                      </div>
                    </td>

                    <td>
                      <div className="led-chain">
                        <span className="led-chain-key">prev</span>
                        <span className="led-chain-val" title={log.prev_hash}>{log.prev_hash}</span>
                      </div>
                      <div className="led-chain">
                        <span className="led-chain-key">hash</span>
                        <span className="led-chain-val" data-strong="true" title={log.entry_hash}>{log.entry_hash}</span>
                        <button type="button" onClick={() => handleCopyHash(log.entry_hash)}
                                className="led-copy" aria-label={`Copy hash for block ${log.sequence_number}`}>
                          <CopyIcon />
                        </button>
                      </div>
                    </td>

                    <td className="text-right">
                      <button type="button" onClick={() => setSelectedLogPayload(log)} className="btn-ghost btn-sm">
                        View JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Payload inspector ────────────────────────────────────────── */}
      {selectedLogPayload && (
        <div className="overlay" onClick={() => setSelectedLogPayload(null)}>
          <div className="modal max-w-lg" role="dialog" aria-modal="true" aria-labelledby="payload-title"
               onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="min-w-0">
                <h4 id="payload-title" className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>
                  Block #{selectedLogPayload.sequence_number}
                </h4>
                <p className="text-[11.5px] font-mono mt-1 m-0" style={{ color: 'var(--text-muted)' }}>
                  {selectedLogPayload.action}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedLogPayload(null)} className="led-close" aria-label="Close">
                <CloseIcon />
              </button>
            </div>

            <div className="modal-body flex flex-col gap-3">
              <div>
                <span className="led-field-label">Entry hash · SHA-256</span>
                <code className="led-block">{selectedLogPayload.entry_hash}</code>
              </div>

              <div>
                <span className="led-field-label">Payload</span>
                <pre className="led-json">{JSON.stringify(selectedLogPayload.payload, null, 2)}</pre>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setSelectedLogPayload(null)} className="btn-ghost">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SOC 2 certificate ───────────────────────────────────────── */}
      {certificateModal && (
        <div className="overlay" onClick={() => setCertificateModal(null)}>
          <div className="modal max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="cert-title"
               onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="min-w-0">
                <h2 id="cert-title" className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>
                  Cryptographic audit certificate
                </h2>
                <p className="text-[11.5px] mt-1 m-0" style={{ color: 'var(--text-muted)' }}>
                  SOC 2 Type II · ISO 27001 Annex A.12
                </p>
              </div>
              <button type="button" onClick={() => setCertificateModal(null)} className="led-close" aria-label="Close">
                <CloseIcon />
              </button>
            </div>

            <div className="modal-body" id="printable-certificate">
              <div className="cert-seal">
                <span className="cert-seal-glyph"><LockIcon /></span>
                <div>
                  {/* Was a three-stop gradient clipped to the text. Gradient
                      text is unreadable at small sizes and disappears
                      entirely on a printed page. */}
                  <h3 className="text-[15px] font-bold m-0" style={{ color: 'var(--text)' }}>
                    Chain integrity attested
                  </h3>
                  <p className="text-[11.5px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>
                    Verified from the genesis block forward.
                  </p>
                </div>
              </div>

              <dl className="cert-facts">
                <div><dt>Certificate ID</dt><dd className="font-mono">{certificateModal.certificate_id}</dd></div>
                <div><dt>Chain status</dt><dd>{certificateModal.chain_status}</dd></div>
                <div><dt>Audited events</dt><dd className="tnum">{certificateModal.total_audited_events} blocks</dd></div>
                <div><dt>Hashing standard</dt><dd className="font-mono">{certificateModal.hashing_algorithm}</dd></div>
                <div><dt>Issued to</dt><dd>{certificateModal.auditor}</dd></div>
                <div><dt>Issued at</dt><dd className="tnum">{new Date(certificateModal.issued_at).toUTCString()}</dd></div>
              </dl>

              <div className="mt-3">
                <span className="led-field-label">Merkle tip hash · cryptographic seal</span>
                <code className="led-block">{certificateModal.cryptographic_tip_hash}</code>
              </div>

              <p className="cert-note">
                This certificate attests that the entire sequential audit chain was cryptographically
                validated and confirmed tamper-proof from the genesis block.
              </p>
            </div>

            <div className="modal-footer !justify-between">
              <button type="button" onClick={() => setCertificateModal(null)} className="btn-ghost">Close</button>
              <button type="button" onClick={() => window.print()} className="btn-primary">
                Print / save PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .led-glyph {
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          width: 26px; height: 26px;
          border-radius: 8px;
          color: var(--brand);
          background: var(--brand-soft);
          border: 1px solid var(--brand-line);
        }

        .led-grid {
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
          .led-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .led-stat-wide { grid-column: span 2; }
        }

        .led-stat {
          display: flex; flex-direction: column; gap: 3px;
          min-width: 0;
          padding: 12px 13px;
          background: var(--surface-sunk);
        }
        .led-stat-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .led-stat-value {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 20px; font-weight: 700; line-height: 1.1;
          font-variant-numeric: tabular-nums;
          color: var(--text);
        }
        .led-stat-value[data-tone='ok']     { color: var(--ok); }
        .led-stat-value[data-tone='danger'] { color: var(--danger); }
        .led-stat-sub { font-size: 10.5px; color: var(--text-muted); }

        .led-hash {
          flex: 1; min-width: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 11.5px; font-weight: 600;
          color: var(--text-soft);
        }

        .led-copy {
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          width: 22px; height: 22px;
          border-radius: 6px;
          color: var(--text-faint);
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          transition:
            transform var(--t-press) var(--ease-out),
            color var(--t-press) var(--ease-out),
            background-color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .led-copy:hover { color: var(--text); background: var(--surface-hover); }
        }
        .led-copy:active { transform: scale(0.92); }

        .led-scroll { overflow-x: auto; }

        .led-chain {
          display: flex; align-items: center; gap: 5px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 10.5px;
        }
        .led-chain + .led-chain { margin-top: 2px; }
        .led-chain-key {
          flex-shrink: 0;
          font-size: 9px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .led-chain-val {
          max-width: 110px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          color: var(--text-muted);
        }
        .led-chain-val[data-strong='true'] { font-weight: 700; color: var(--text-soft); }

        .led-close {
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
          .led-close:hover { color: var(--text); background: var(--surface-hover); }
        }
        .led-close:active { transform: scale(0.94); }

        .led-field-label {
          display: block;
          margin-bottom: 4px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .led-block {
          display: block;
          padding: 8px 10px;
          border-radius: 9px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 11px; line-height: 1.6;
          word-break: break-all;
          color: var(--text-soft);
          background: var(--surface-sunk);
          border: 1px solid var(--line);
        }
        .led-json {
          margin: 0;
          max-height: 260px;
          overflow: auto;
          padding: 10px 12px;
          border-radius: 11px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 11px; line-height: 1.6;
          color: var(--text-soft);
          background: var(--surface-sunk);
          border: 1px solid var(--line);
        }

        .cert-seal {
          display: flex; align-items: center; gap: 11px;
          padding: 12px 13px;
          margin-bottom: 14px;
          border-radius: 12px;
          background: var(--brand-soft);
          border: 1px solid var(--brand-line);
        }
        .cert-seal-glyph {
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          width: 30px; height: 30px;
          border-radius: 9px;
          color: var(--brand);
          background: var(--surface);
          border: 1px solid var(--brand-line);
        }

        .cert-facts {
          display: flex; flex-direction: column;
          margin: 0;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--line);
        }
        .cert-facts > div {
          display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
          padding: 9px 12px;
          background: var(--surface-sunk);
        }
        .cert-facts > div + div { border-top: 1px solid var(--line); }
        .cert-facts dt { font-size: 11.5px; color: var(--text-muted); }
        /* Six values in five colours — cyan, emerald, white, purple, slate —
           on a document whose whole job is to be believed. */
        .cert-facts dd {
          margin: 0;
          font-size: 12px; font-weight: 600; text-align: right;
          color: var(--text);
        }

        .cert-note {
          margin: 14px 0 0;
          font-size: 11.5px; line-height: 1.65; text-align: center;
          color: var(--text-muted);
        }

        /* window.print() printed the entire page behind the modal — the old
           print: utilities only tidied up the certificate's own chrome.
           Everything but the certificate is hidden at the document level. */
        @media print {
          body * { visibility: hidden !important; }
          #printable-certificate, #printable-certificate * { visibility: visible !important; }
          #printable-certificate {
            position: absolute !important;
            top: 0; left: 0; width: 100%;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </main>
  )
}
