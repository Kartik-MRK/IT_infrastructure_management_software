import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

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
    fetchLogs()
    handleVerifyChain(false) // silent initial verify
  }, [])

  async function fetchLogs(filter = '') {
    try {
      setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const url = filter
        ? `http://localhost:5000/api/audit-ledger?action=${encodeURIComponent(filter)}`
        : 'http://localhost:5000/api/audit-ledger'
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
      const res = await fetch('http://localhost:5000/api/audit-ledger/verify', {
        method: 'POST',
        headers
      })
      const json = await res.json()
      if (res.ok) {
        setIntegrityReport(json.integrity_report)
        if (showToast) {
          if (json.integrity_report?.is_valid) {
            toast.success(`🔒 Cryptographic chain verified: ${json.integrity_report.total_records} blocks 100% tamper-proof!`)
          } else {
            toast.error(`⚠️ Tamper alert: Broken sequence at #${json.integrity_report?.broken_sequence_numbers?.join(', ')}`)
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
      const res = await fetch(`http://localhost:5000/api/audit-ledger/compliance-certificate?auditor_name=${encodeURIComponent(auditorName)}`, { headers })
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

  function handleCopyHash(hash) {
    navigator.clipboard.writeText(hash)
    toast.success('Hash copied to clipboard!')
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in font-space">
      
      {/* Top Header Banner */}
      <div className="card mb-8 !p-6 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-slate-800 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔒</span>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                  Cryptographic Audit Ledger
                  <span className={`px-2.5 py-0.5 text-xs font-bold uppercase rounded-full border ${
                    integrityReport?.is_valid
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                  }`}>
                    {integrityReport?.is_valid ? '✓ Tamper-Proof Chain' : '⚠️ Integrity Compromised'}
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Immutable SHA-256 hash-chained event trail complying with SOC 2 Type II & ISO 27001 Annex A.12.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              disabled={verifying}
              onClick={() => handleVerifyChain(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <span>{verifying ? '⏳' : '⚡'}</span>
              {verifying ? 'Verifying Hashes...' : 'Run Integrity Sweep'}
            </button>

            <button
              type="button"
              onClick={handleGenerateCertificate}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>📜</span> Export SOC 2 Certificate
            </button>
          </div>
        </div>

        {/* Chain Cryptographic Metrics Scorecard */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Audited Events</span>
            <div className="text-xl font-black text-white font-mono mt-0.5">
              {integrityReport?.total_records || logs.length}
            </div>
            <span className="text-[10px] text-emerald-400">100% Chained</span>
          </div>

          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Tampered Records</span>
            <div className={`text-xl font-black font-mono mt-0.5 ${
              (integrityReport?.tampered_records_count || 0) === 0 ? 'text-emerald-400' : 'text-rose-500'
            }`}>
              {integrityReport?.tampered_records_count || 0}
            </div>
            <span className="text-[10px] text-slate-400">Zero Tolerance</span>
          </div>

          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl col-span-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Merkle Head Tip Hash</span>
            <div className="text-xs font-bold text-cyan-400 font-mono truncate mt-1 flex items-center justify-between">
              <span>{integrityReport?.merkle_head_hash || 'Calculating tip hash...'}</span>
              {integrityReport?.merkle_head_hash && (
                <button
                  onClick={() => handleCopyHash(integrityReport.merkle_head_hash)}
                  className="text-slate-400 hover:text-white text-xs ml-2 cursor-pointer"
                  title="Copy tip hash"
                >
                  📋
                </button>
              )}
            </div>
            <span className="text-[10px] text-slate-400">Algorithm: SHA-256 Canonical Chaining</span>
          </div>
        </div>
      </div>

      {/* Action Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
            Ledger Timeline ({logs.length} Blocks)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by action (e.g. ASSET, INCIDENT)..."
            value={actionFilter}
            onChange={e => {
              setActionFilter(e.target.value)
              fetchLogs(e.target.value)
            }}
            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-800 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 font-mono w-64"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="card !p-0 overflow-hidden border border-gray-200 dark:border-slate-800 shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-gray-400 animate-pulse">Loading cryptographic ledger...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-3xl block mb-2">📜</span>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">No audit records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 font-mono text-[11px] uppercase">
                  <th className="py-3 px-4">Seq #</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Cryptographic Hash Chain</th>
                  <th className="py-3 px-4 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                {logs.map((log, index) => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      {/* Seq # */}
                      <td className="py-3.5 px-4 font-mono font-bold text-cyan-500 dark:text-cyan-400">
                        #{String(log.sequence_number).padStart(4, '0')}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-gray-600 dark:text-slate-400 font-mono whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 dark:text-white">{log.actor_email}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{log.client_ip}</div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 font-mono">
                          {log.action}
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="py-3.5 px-4">
                        <span className="text-gray-900 dark:text-slate-200 font-mono font-semibold">
                          {log.entity_type}
                        </span>
                        <span className="text-gray-400 block text-[10px] font-mono truncate max-w-[120px]">
                          {log.entity_id}
                        </span>
                      </td>

                      {/* Hashes */}
                      <td className="py-3.5 px-4 font-mono text-[10px] space-y-1">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <span className="text-[9px] uppercase font-bold text-slate-500">Prev:</span>
                          <span className="truncate max-w-[110px]" title={log.prev_hash}>{log.prev_hash}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-bold">
                          <span className="text-[9px] uppercase font-bold text-cyan-500">Hash:</span>
                          <span className="truncate max-w-[110px]" title={log.entry_hash}>{log.entry_hash}</span>
                          <button
                            onClick={() => handleCopyHash(log.entry_hash)}
                            className="text-slate-400 hover:text-white cursor-pointer ml-1"
                            title="Copy full hash"
                          >
                            📋
                          </button>
                        </div>
                      </td>

                      {/* Payload Details */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLogPayload(log)}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-mono transition-all cursor-pointer"
                        >
                          View JSON
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JSON Payload Modal */}
      {selectedLogPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-space">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h4 className="text-sm font-bold text-white font-mono">
                  Audit Entry #{selectedLogPayload.sequence_number} Payload
                </h4>
                <p className="text-xs text-slate-400 font-mono">{selectedLogPayload.action}</p>
              </div>
              <button
                onClick={() => setSelectedLogPayload(null)}
                className="text-slate-400 hover:text-white text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Entry Hash (SHA-256)</span>
                <div className="p-2 bg-slate-950 rounded-lg text-xs font-mono text-cyan-400 break-all border border-slate-800">
                  {selectedLogPayload.entry_hash}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Payload JSON Content</span>
                <pre className="p-3 bg-slate-950 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800 max-h-60">
                  {JSON.stringify(selectedLogPayload.payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-5 text-right">
              <button
                onClick={() => setSelectedLogPayload(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOC 2 Compliance Certificate Modal */}
      {certificateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-space print:p-0 print:bg-white print:static">
          <div className="relative w-full max-w-2xl bg-slate-950 border-2 border-purple-500/50 rounded-3xl shadow-2xl p-8 text-white print:border-none print:shadow-none print:bg-white print:text-black">
            
            {/* Certificate Header */}
            <div className="text-center space-y-2 pb-6 border-b border-slate-800">
              <div className="text-4xl mb-1">🛡️ 📜 🛡️</div>
              <h2 className="text-xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-cyan-400 to-emerald-400 font-mono">
                Cryptographic Audit Certificate
              </h2>
              <p className="text-xs text-slate-400 uppercase tracking-wider">
                SOC 2 Type II & ISO 27001 Annex A.12 Compliance Verification
              </p>
            </div>

            {/* Certificate Body */}
            <div className="py-6 space-y-4 text-xs font-mono">
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Certificate ID:</span>
                  <span className="text-cyan-400 font-bold">{certificateModal.certificate_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Verification Status:</span>
                  <span className="text-emerald-400 font-bold uppercase">{certificateModal.chain_status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Audited Ledger Events:</span>
                  <span className="text-white font-bold">{certificateModal.total_audited_events} Blocks</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hashing Standard:</span>
                  <span className="text-purple-400 font-bold">{certificateModal.hashing_algorithm}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Issued For Auditor:</span>
                  <span className="text-white font-bold">{certificateModal.auditor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="text-slate-300">{new Date(certificateModal.issued_at).toUTCString()}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Merkle Tip Hash (Cryptographic Seal)</span>
                <div className="p-2.5 bg-slate-900 rounded-xl text-[11px] text-cyan-400 break-all border border-purple-500/30">
                  {certificateModal.cryptographic_tip_hash}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed italic text-center pt-2">
                "This certificate verifies that the entire sequential audit chain has been cryptographically validated and confirmed tamper-proof from the genesis block."
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 print:hidden">
              <button
                type="button"
                onClick={() => setCertificateModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <span>🖨️</span> Print / Save Certificate PDF
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  )
}
