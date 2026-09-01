import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

export default function PostMortemModal({ isOpen, onClose, incidentId, onUpdated }) {
  const [postmortem, setPostmortem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('editor') // 'editor' | 'preview'

  useEffect(() => {
    if (isOpen && incidentId) {
      fetchPostMortem()
    }
  }, [isOpen, incidentId])

  async function fetchPostMortem() {
    try {
      setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`http://localhost:5000/api/incidents/${incidentId}/postmortem`, { headers })
      if (res.ok) {
        const json = await res.json()
        setPostmortem(json.postmortem)
      } else {
        toast.error('Failed to load post-mortem document')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(statusToSet = null) {
    if (!postmortem) return

    try {
      setSaving(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }

      const payload = {
        title: postmortem.title,
        executive_summary: postmortem.executive_summary,
        immediate_resolution_steps: postmortem.immediate_resolution_steps,
        status: statusToSet || postmortem.status,
        root_cause_analysis: postmortem.root_cause_analysis,
        preventative_action_items: postmortem.preventative_action_items
      }

      const res = await fetch(`http://localhost:5000/api/incidents/${incidentId}/postmortem`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update post-mortem')
      }

      setPostmortem(json.postmortem)
      toast.success(statusToSet === 'published' ? '🎉 Post-Mortem published successfully!' : 'Post-Mortem saved!')
      onUpdated && onUpdated()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyMarkdown() {
    try {
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`http://localhost:5000/api/incidents/${incidentId}/postmortem/export`, { headers })
      if (res.ok) {
        const json = await res.json()
        await navigator.clipboard.writeText(json.markdown)
        toast.success('📋 Markdown copied to clipboard!')
      }
    } catch (err) {
      toast.error('Failed to export markdown')
    }
  }

  function handleWhyChange(index, value) {
    if (!postmortem?.root_cause_analysis) return
    const whys = [...(postmortem.root_cause_analysis.whys || ['', '', '', '', ''])]
    whys[index] = value
    setPostmortem(prev => ({
      ...prev,
      root_cause_analysis: {
        ...prev.root_cause_analysis,
        whys
      }
    }))
  }

  function handleAddActionItem() {
    const newItem = {
      id: crypto.randomUUID(),
      task_description: '',
      owner: 'Unassigned',
      status: 'pending',
      priority: 'medium',
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    }
    setPostmortem(prev => ({
      ...prev,
      preventative_action_items: [...(prev.preventative_action_items || []), newItem]
    }))
  }

  function handleActionItemChange(id, field, value) {
    setPostmortem(prev => ({
      ...prev,
      preventative_action_items: prev.preventative_action_items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    }))
  }

  function handleDeleteActionItem(id) {
    setPostmortem(prev => ({
      ...prev,
      preventative_action_items: prev.preventative_action_items.filter(item => item.id !== id)
    }))
  }

  if (!isOpen) return null

  const impact = postmortem?.impact_summary || {}
  const timeline = postmortem?.timeline_events || []
  const rca = postmortem?.root_cause_analysis || { whys: ['', '', '', '', ''] }
  const actionItems = postmortem?.preventative_action_items || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-space print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-h-[92vh] flex flex-col print:border-none print:shadow-none print:max-h-full print:bg-white">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={postmortem?.title || ''}
                  onChange={e => setPostmortem(prev => ({ ...prev, title: e.target.value }))}
                  className="text-base font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:outline-none px-1"
                />
                <span className={`px-2.5 py-0.5 text-xs font-bold uppercase rounded-full border ${
                  postmortem?.status === 'published'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : postmortem?.status === 'under_review'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  {postmortem?.status || 'draft'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated SRE Root Cause Analysis & Preventative Action Item Tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Copy formatted markdown report"
            >
              <span>📄</span> Export MD
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Print post-mortem report"
            >
              <span>🖨️</span> Print
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-lg ml-2 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 print:p-0 print:overflow-visible">
          {loading ? (
            <div className="space-y-4 py-8 animate-pulse">
              <div className="h-24 bg-slate-800/60 rounded-xl"></div>
              <div className="h-32 bg-slate-800/60 rounded-xl"></div>
              <div className="h-40 bg-slate-800/60 rounded-xl"></div>
            </div>
          ) : postmortem ? (
            <>
              {/* 1. Impact & SLA Scorecard Banner */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Total Outage</span>
                  <div className="text-lg font-black text-rose-400 font-mono">
                    {impact.duration_minutes > 60
                      ? `${Math.floor(impact.duration_minutes / 60)}h ${impact.duration_minutes % 60}m`
                      : `${impact.duration_minutes}m`}
                  </div>
                  <span className="text-[10px] text-slate-400">Downtime Duration</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Time to Detect (MTTD)</span>
                  <div className="text-lg font-black text-cyan-400 font-mono">
                    {impact.mttd_minutes}m
                  </div>
                  <span className="text-[10px] text-slate-400">First Response</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Severity & SLA</span>
                  <div className={`text-sm font-bold font-mono uppercase mt-1 ${impact.sla_breached ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {impact.severity} • {impact.sla_breached ? 'Breached' : 'SLA Met'}
                  </div>
                  <span className="text-[10px] text-slate-400">{impact.category}</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Primary Asset</span>
                  <div className="text-sm font-bold text-white font-mono truncate mt-1">
                    {impact.primary_asset || 'N/A'}
                  </div>
                  <span className="text-[10px] text-slate-400">Target Infrastructure</span>
                </div>
              </div>

              {/* 2. Executive Summary */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  1. Executive Summary & Impact Narrative
                </label>
                <textarea
                  rows="3"
                  value={postmortem.executive_summary || ''}
                  onChange={e => setPostmortem(prev => ({ ...prev, executive_summary: e.target.value }))}
                  placeholder="Summarize the incident scope, customer impact, and timeline of resolution..."
                  className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white leading-relaxed focus:outline-none focus:border-cyan-500 font-sans"
                />
              </div>

              {/* 3. Chronological Milestone Ladder */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  2. Incident Timeline & Key Milestones
                </label>
                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-3">
                  {timeline.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No milestone events recorded.</p>
                  ) : (
                    timeline.map((ev, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs">
                        <div className="flex flex-col items-center mt-0.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]"></span>
                          {i < timeline.length - 1 && <span className="w-0.5 h-6 bg-slate-800 my-1"></span>}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">{ev.title}</span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {new Date(ev.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-slate-400 mt-0.5 leading-relaxed">{ev.description}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 4. 5-Whys Root Cause Analysis */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    3. Root Cause Analysis (5-Whys Methodology)
                  </label>
                  <span className="text-[10px] text-cyan-400 font-mono">Recursive Causality Ladder</span>
                </div>
                <div className="space-y-2 p-4 bg-slate-950/70 border border-slate-800 rounded-xl">
                  {(rca.whys || ['', '', '', '', '']).map((whyText, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-6 text-center font-mono font-bold text-cyan-400 text-xs">
                        W{index + 1}
                      </span>
                      <input
                        type="text"
                        value={whyText}
                        onChange={e => handleWhyChange(index, e.target.value)}
                        placeholder={`Why did step ${index === 0 ? 'the failure' : index} happen?`}
                        className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  ))}

                  <div className="pt-2 border-t border-slate-800 mt-3">
                    <label className="block text-[11px] font-bold text-purple-300 mb-1">
                      Final Root Cause Declaration:
                    </label>
                    <input
                      type="text"
                      value={rca.root_cause_statement || ''}
                      onChange={e => setPostmortem(prev => ({
                        ...prev,
                        root_cause_analysis: {
                          ...prev.root_cause_analysis,
                          root_cause_statement: e.target.value
                        }
                      }))}
                      placeholder="Concise fundamental root cause summary..."
                      className="w-full px-3 py-2 bg-slate-900 border border-purple-500/40 rounded-lg text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Immediate Fix & Mitigation */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  4. Immediate Mitigation & Recovery Steps Taken
                </label>
                <textarea
                  rows="2"
                  value={postmortem.immediate_resolution_steps || ''}
                  onChange={e => setPostmortem(prev => ({ ...prev, immediate_resolution_steps: e.target.value }))}
                  placeholder="Detail the technical actions taken to restore service operations..."
                  className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white leading-relaxed focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {/* 6. Preventative Action Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    5. Preventative Action Items & Corrective Tasks ({actionItems.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddActionItem}
                    className="px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span>+</span> Add Task
                  </button>
                </div>

                <div className="space-y-2">
                  {actionItems.map(item => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                        <select
                          value={item.status}
                          onChange={e => handleActionItemChange(item.id, 'status', e.target.value)}
                          className={`px-2 py-1 rounded text-[11px] font-bold uppercase border cursor-pointer ${
                            item.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : item.status === 'in_progress'
                              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          }`}
                        >
                          <option value="pending">🟡 Pending</option>
                          <option value="in_progress">🔵 In Progress</option>
                          <option value="completed">🟢 Completed</option>
                        </select>

                        <input
                          type="text"
                          value={item.task_description}
                          onChange={e => handleActionItemChange(item.id, 'task_description', e.target.value)}
                          placeholder="Action item task description..."
                          className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <input
                          type="text"
                          value={item.owner}
                          onChange={e => handleActionItemChange(item.id, 'owner', e.target.value)}
                          placeholder="Owner"
                          className="w-24 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none"
                        />
                        <input
                          type="date"
                          value={item.due_date || ''}
                          onChange={e => handleActionItemChange(item.id, 'due_date', e.target.value)}
                          className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteActionItem(item.id)}
                          className="text-slate-500 hover:text-rose-400 text-sm px-1 transition-colors cursor-pointer"
                          title="Delete action item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Status:</span>
            <select
              value={postmortem?.status || 'draft'}
              onChange={e => setPostmortem(prev => ({ ...prev, status: e.target.value }))}
              className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs font-semibold text-white focus:outline-none"
            >
              <option value="draft">Draft</option>
              <option value="under_review">Under Review</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave()}
              className="px-4 py-2 text-xs font-bold text-white bg-slate-700 hover:bg-slate-600 rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('published')}
              className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <span>🚀</span> Publish Post-Mortem
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
