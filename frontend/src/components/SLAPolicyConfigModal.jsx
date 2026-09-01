import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

export default function SLAPolicyConfigModal({ isOpen, onClose, onPoliciesUpdated }) {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchPolicies()
    }
  }, [isOpen])

  async function fetchPolicies() {
    try {
      setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch('http://localhost:5000/api/sla/policies', { headers })
      if (res.ok) {
        const json = await res.json()
        setPolicies(json.policies || [])
      }
    } catch (err) {
      toast.error('Failed to load SLA policies')
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePolicy(policy) {
    try {
      setSavingId(policy.id)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }

      const res = await fetch(`http://localhost:5000/api/sla/policies/${policy.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          policy_name: policy.policy_name,
          max_response_time_minutes: parseInt(policy.max_response_time_minutes),
          max_resolution_time_minutes: parseInt(policy.max_resolution_time_minutes),
          business_hours_only: policy.business_hours_only,
          escalation_email: policy.escalation_email
        })
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update SLA policy')
      }

      toast.success(`${policy.severity.toUpperCase()} SLA policy updated!`)
      onPoliciesUpdated && onPoliciesUpdated()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingId(null)
    }
  }

  function handleFieldChange(id, field, value) {
    setPolicies(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  if (!isOpen) return null

  const severityBadges = {
    critical: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/40'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-space">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏱️</span>
            <h3 className="text-base font-bold text-white tracking-tight">
              Enterprise Service Level Agreement (SLA) Policies
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Define maximum response and resolution targets for each incident severity. SLA countdown timers and automated breach notifications will strictly adhere to these policies.
        </p>

        {loading ? (
          <div className="space-y-4 py-4 animate-pulse">
            <div className="h-20 bg-slate-800 rounded-xl"></div>
            <div className="h-20 bg-slate-800 rounded-xl"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {policies.map(policy => (
              <div
                key={policy.id}
                className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 text-xs font-bold uppercase rounded-full border ${severityBadges[policy.severity] || severityBadges.low}`}>
                      {policy.severity}
                    </span>
                    <input
                      type="text"
                      value={policy.policy_name}
                      onChange={e => handleFieldChange(policy.id, 'policy_name', e.target.value)}
                      className="bg-transparent text-xs font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-purple-500 focus:outline-none px-1"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={savingId === policy.id}
                    onClick={() => handleSavePolicy(policy)}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === policy.id ? 'Saving...' : 'Save Policy'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                      Max Response (Minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={policy.max_response_time_minutes}
                      onChange={e => handleFieldChange(policy.id, 'max_response_time_minutes', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                      Max Resolution (Minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={policy.max_resolution_time_minutes}
                      onChange={e => handleFieldChange(policy.id, 'max_resolution_time_minutes', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                      Escalation On-Call Email
                    </label>
                    <input
                      type="email"
                      value={policy.escalation_email || ''}
                      onChange={e => handleFieldChange(policy.id, 'escalation_email', e.target.value)}
                      placeholder="oncall@domain.com"
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={policy.business_hours_only}
                      onChange={e => handleFieldChange(policy.id, 'business_hours_only', e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Business Hours Only (Pause SLA timer on nights/weekends)</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 mt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
