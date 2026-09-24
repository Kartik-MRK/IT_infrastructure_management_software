import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

const STATUS_META = {
  draft:        { label: 'Draft',        tone: 'badge-neutral' },
  under_review: { label: 'Under review', tone: 'badge-warning' },
  published:    { label: 'Published',    tone: 'badge-success' },
}

const ITEM_STATUS = [
  { id: 'pending',     label: 'Pending',     dot: 'var(--warn)' },
  { id: 'in_progress', label: 'In progress', dot: 'var(--info)' },
  { id: 'completed',   label: 'Completed',   dot: 'var(--ok)'   },
]

// Every one of these fields can be absent on a freshly generated document,
// and `undefined % 60` used to render "NaNm" straight into the scorecard.
function fmtMinutes(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  if (n < 60) return `${n}m`
  const h = Math.floor(n / 60)
  const m = n % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// W1 asks about the failure; every later Why asks about the previous answer.
// The old placeholder read "Why did step 1 happen?", which pointed at nothing.
const whyPlaceholder = (i) =>
  i === 0 ? 'Why did the failure happen?' : 'Why did that happen?'

const Stat = ({ label, value, sub, tone }) => (
  <div className="pm-stat">
    <span className="pm-stat-label">{label}</span>
    <span className="pm-stat-value" data-tone={tone || 'default'}>{value}</span>
    <span className="pm-stat-sub">{sub}</span>
  </div>
)

export default function PostMortemModal({ isOpen, onClose, incidentId, onUpdated }) {
  const [postmortem, setPostmortem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && incidentId) {
      fetchPostMortem()
    }
  }, [isOpen, incidentId])

  // Escape closes the dialog
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

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
      toast.success(statusToSet === 'published' ? 'Post-mortem published' : 'Post-mortem saved')
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
        toast.success('Markdown copied to clipboard')
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
  const status = postmortem?.status || 'draft'
  const statusMeta = STATUS_META[status] || STATUS_META.draft
  const isPublished = status === 'published'

  // Publishing a post-mortem with no root cause and no summary is the one
  // failure mode this document exists to prevent, so the button says what
  // is missing instead of silently shipping an empty report.
  const missing = []
  if (!postmortem?.executive_summary?.trim()) missing.push('an executive summary')
  if (!rca.root_cause_statement?.trim()) missing.push('a root cause statement')
  const canPublish = missing.length === 0

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal max-w-4xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Incident post-mortem"
      >
        <div className="modal-header">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* Was a transparent borderless input that read as static text */}
              <input
                type="text"
                aria-label="Post-mortem title"
                value={postmortem?.title || ''}
                onChange={e => setPostmortem(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Post-mortem title"
                className="input-field !py-1 !text-[13px] !font-bold"
                style={{ maxWidth: 380 }}
              />
              <span className={statusMeta.tone}>{statusMeta.label}</span>
            </div>
            <p className="text-[12px] mt-1 m-0" style={{ color: 'var(--text-muted)' }}>
              Root cause analysis and preventative action tracking.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button type="button" onClick={handleCopyMarkdown} className="btn-secondary btn-sm" title="Copy as markdown">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              <span className="hidden sm:inline">Markdown</span>
            </button>
            <button type="button" onClick={() => window.print()} className="btn-secondary btn-sm" title="Print report">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              <span className="hidden sm:inline">Print</span>
            </button>
            <button onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div className="modal-body flex flex-col gap-5" id="printable-postmortem">
          {loading ? (
            <>
              <div className="skeleton" style={{ height: 86, borderRadius: 12 }} />
              <div className="skeleton" style={{ height: 108, borderRadius: 12 }} />
              <div className="skeleton" style={{ height: 160, borderRadius: 12 }} />
            </>
          ) : !postmortem ? (
            <div className="empty-state">
              <div className="empty-state-title">Post-mortem unavailable</div>
              <p className="empty-state-text">
                The document could not be loaded for this incident. Close and reopen once the API is reachable.
              </p>
            </div>
          ) : (
            <>
              {/* ── Impact scorecard ─────────────────────────────── */}
              <div className="pm-scorecard">
                <Stat
                  label="Total outage"
                  value={fmtMinutes(impact.duration_minutes)}
                  sub="Downtime"
                  tone="danger"
                />
                <Stat
                  label="Time to detect"
                  value={fmtMinutes(impact.mttd_minutes)}
                  sub="MTTD"
                />
                <Stat
                  label="SLA"
                  value={impact.sla_breached ? 'Breached' : 'Met'}
                  sub={[impact.severity, impact.category].filter(Boolean).join(' · ') || '—'}
                  tone={impact.sla_breached ? 'danger' : 'ok'}
                />
                <Stat
                  label="Primary asset"
                  value={impact.primary_asset || '—'}
                  sub="Target infrastructure"
                />
              </div>

              {/* ── 1. Executive summary ─────────────────────────── */}
              <section className="flex flex-col gap-2">
                <h4 className="pm-heading">1 · Executive summary</h4>
                <textarea
                  rows="3"
                  value={postmortem.executive_summary || ''}
                  onChange={e => setPostmortem(prev => ({ ...prev, executive_summary: e.target.value }))}
                  placeholder="Scope of the incident, who was affected, and how it was resolved…"
                  className="input-field leading-relaxed"
                />
              </section>

              {/* ── 2. Timeline ──────────────────────────────────── */}
              <section className="flex flex-col gap-2">
                <h4 className="pm-heading">2 · Timeline</h4>
                <div className="pm-panel">
                  {timeline.length === 0 ? (
                    <p className="text-[12px] m-0" style={{ color: 'var(--text-muted)' }}>
                      No milestone events recorded for this incident.
                    </p>
                  ) : (
                    <ol className="pm-timeline">
                      {timeline.map((ev, i) => (
                        <li key={i} className="pm-event">
                          <span className="pm-event-rail" aria-hidden="true" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>{ev.title}</span>
                              <span className="font-mono text-[11px] tnum" style={{ color: 'var(--text-muted)' }}>
                                {new Date(ev.timestamp).toLocaleString()}
                              </span>
                            </div>
                            {ev.description && (
                              <p className="text-[12px] mt-0.5 mb-0 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                {ev.description}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>

              {/* ── 3. Five whys ─────────────────────────────────── */}
              <section className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h4 className="pm-heading">3 · Root cause — five whys</h4>
                  <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                    Each answer feeds the next question
                  </span>
                </div>
                <div className="pm-panel flex flex-col gap-2">
                  {(rca.whys || ['', '', '', '', '']).map((whyText, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="why-index">W{index + 1}</span>
                      <input
                        type="text"
                        aria-label={`Why ${index + 1}`}
                        value={whyText}
                        onChange={e => handleWhyChange(index, e.target.value)}
                        placeholder={whyPlaceholder(index)}
                        className="input-field !py-1.5"
                      />
                    </div>
                  ))}

                  <div className="pt-3 mt-1" style={{ borderTop: '1px solid var(--line)' }}>
                    <label htmlFor="pm_root_cause" className="field-label">Root cause statement</label>
                    <input
                      id="pm_root_cause"
                      type="text"
                      value={rca.root_cause_statement || ''}
                      onChange={e => setPostmortem(prev => ({
                        ...prev,
                        root_cause_analysis: {
                          ...prev.root_cause_analysis,
                          root_cause_statement: e.target.value
                        }
                      }))}
                      placeholder="The single underlying cause, in one sentence…"
                      className="input-field"
                      style={{ borderColor: rca.root_cause_statement?.trim() ? undefined : 'var(--warn-line)' }}
                    />
                  </div>
                </div>
              </section>

              {/* ── 4. Mitigation ────────────────────────────────── */}
              <section className="flex flex-col gap-2">
                <h4 className="pm-heading">4 · Mitigation &amp; recovery</h4>
                <textarea
                  rows="2"
                  value={postmortem.immediate_resolution_steps || ''}
                  onChange={e => setPostmortem(prev => ({ ...prev, immediate_resolution_steps: e.target.value }))}
                  placeholder="Technical actions taken to restore service…"
                  className="input-field font-mono leading-relaxed"
                />
              </section>

              {/* ── 5. Action items ──────────────────────────────── */}
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="pm-heading">5 · Preventative actions ({actionItems.length})</h4>
                  <button type="button" onClick={handleAddActionItem} className="btn-secondary btn-sm">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add task
                  </button>
                </div>

                {actionItems.length === 0 ? (
                  <div className="pm-panel">
                    <p className="text-[12px] m-0" style={{ color: 'var(--text-muted)' }}>
                      No preventative actions yet. A post-mortem without follow-up tasks does not stop the incident
                      recurring — add at least one.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {actionItems.map(item => {
                      const meta = ITEM_STATUS.find(s => s.id === item.status) || ITEM_STATUS[0]
                      return (
                        <div key={item.id} className="pm-task" data-done={item.status === 'completed'}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* The dot lives outside the select — native option
                                styling is unreliable, so colour was carried by
                                emoji before. */}
                            <span className="task-dot" style={{ background: meta.dot }} aria-hidden="true" />
                            <select
                              aria-label="Task status"
                              value={item.status}
                              onChange={e => handleActionItemChange(item.id, 'status', e.target.value)}
                              className="input-field !py-1 !text-[11.5px] !font-semibold"
                              style={{ width: 118, flexShrink: 0 }}
                            >
                              {ITEM_STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                            <input
                              type="text"
                              aria-label="Task description"
                              value={item.task_description}
                              onChange={e => handleActionItemChange(item.id, 'task_description', e.target.value)}
                              placeholder="What will be done to prevent this?"
                              className="input-field !py-1"
                            />
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="text"
                              aria-label="Owner"
                              value={item.owner}
                              onChange={e => handleActionItemChange(item.id, 'owner', e.target.value)}
                              placeholder="Owner"
                              className="input-field !py-1"
                              style={{ width: 104 }}
                            />
                            <input
                              type="date"
                              aria-label="Due date"
                              value={item.due_date || ''}
                              onChange={e => handleActionItemChange(item.id, 'due_date', e.target.value)}
                              className="input-field !py-1 tnum"
                              style={{ width: 132 }}
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteActionItem(item.id)}
                              className="btn btn-ghost btn-icon"
                              title="Remove task"
                              aria-label="Remove task"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <div className="modal-footer !justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <label htmlFor="pm_status" className="text-[11.5px] shrink-0" style={{ color: 'var(--text-muted)' }}>
              Status
            </label>
            <select
              id="pm_status"
              value={status}
              onChange={e => setPostmortem(prev => ({ ...prev, status: e.target.value }))}
              disabled={!postmortem}
              className="input-field !py-1 !text-[11.5px] !font-semibold"
              style={{ width: 132 }}
            >
              <option value="draft">Draft</option>
              <option value="under_review">Under review</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {!canPublish && postmortem && (
              <span className="text-[11.5px] hidden md:inline" style={{ color: 'var(--warn)' }}>
                Needs {missing.join(' and ')}
              </span>
            )}
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">Close</button>
            <button
              type="button"
              disabled={saving || !postmortem}
              onClick={() => handleSave()}
              className="btn-secondary btn-sm"
            >
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="button"
              disabled={saving || !postmortem || !canPublish}
              onClick={() => handleSave('published')}
              className="btn-success btn-sm"
              title={canPublish ? undefined : `Needs ${missing.join(' and ')}`}
            >
              {saving && (
                <span
                  className="animate-spin-fast w-3 h-3 rounded-full"
                  style={{ border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
                />
              )}
              {isPublished ? 'Republish' : 'Publish'}
            </button>
          </div>
        </div>

        <style>{`
          .pm-scorecard {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1px;
            padding: 1px;
            border-radius: 12px;
            overflow: hidden;
            background: var(--line);
            border: 1px solid var(--line);
          }
          @media (min-width: 640px) {
            .pm-scorecard { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          }
          /* Hairline dividers instead of four separate cards — these four
             numbers are one reading, not four unrelated tiles. */
          .pm-stat {
            display: flex; flex-direction: column; gap: 2px;
            padding: 11px 12px;
            min-width: 0;
            background: var(--surface-sunk);
          }
          .pm-stat-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
            text-transform: uppercase; color: var(--text-faint);
          }
          .pm-stat-value {
            font-family: 'JetBrains Mono', ui-monospace, monospace;
            font-size: 16px; font-weight: 700;
            font-variant-numeric: tabular-nums;
            color: var(--text);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          /* Colour encodes state, never identity — a metric only goes red
             when its value is actually bad. */
          .pm-stat-value[data-tone='danger'] { color: var(--danger); }
          .pm-stat-value[data-tone='ok']     { color: var(--ok); }
          .pm-stat-sub { font-size: 10.5px; color: var(--text-muted); }

          .pm-heading {
            margin: 0;
            font-size: 11px; font-weight: 700; letter-spacing: 0.07em;
            text-transform: uppercase;
            color: var(--text-soft);
          }

          .pm-panel {
            padding: 13px;
            border-radius: 12px;
            background: var(--surface-sunk);
            border: 1px solid var(--line);
          }

          .pm-timeline { list-style: none; margin: 0; padding: 0; }
          .pm-event {
            position: relative;
            display: flex; gap: 12px;
            padding-bottom: 13px;
          }
          .pm-event:last-child { padding-bottom: 0; }
          /* One rail element draws both the dot and the connector, so the
             line always stops exactly at the last event. */
          .pm-event-rail {
            position: relative;
            flex-shrink: 0;
            width: 9px; height: 9px;
            margin-top: 4px;
            border-radius: 50%;
            background: var(--brand);
          }
          .pm-event:not(:last-child) .pm-event-rail::after {
            content: '';
            position: absolute;
            top: 13px; left: 4px;
            width: 1px; height: calc(100% + 13px);
            background: var(--line-strong);
          }

          .why-index {
            flex-shrink: 0;
            width: 26px;
            font-family: 'JetBrains Mono', ui-monospace, monospace;
            font-size: 11px; font-weight: 700;
            text-align: center;
            color: var(--brand);
          }

          .pm-task {
            display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
            padding: 8px 9px;
            border-radius: 11px;
            background: var(--surface-sunk);
            border: 1px solid var(--line);
            transition: border-color var(--t-press) var(--ease-out);
          }
          @media (hover: hover) and (pointer: fine) {
            .pm-task:hover { border-color: var(--line-strong); }
          }
          .pm-task[data-done='true'] { background: var(--ok-soft); border-color: var(--ok-line); }
          .task-dot { flex-shrink: 0; width: 7px; height: 7px; border-radius: 50%; }

          /* Print used to send the dashboard behind this dialog to paper
             alongside the report. Only the document should print. */
          @media print {
            body * { visibility: hidden !important; }
            #printable-postmortem, #printable-postmortem * { visibility: visible !important; }
            #printable-postmortem {
              position: absolute !important;
              top: 0; left: 0; width: 100%;
              max-height: none !important;
              overflow: visible !important;
              padding: 0 !important;
            }
            #printable-postmortem .input-field {
              border-color: transparent !important;
              background: transparent !important;
              padding-left: 0 !important;
            }
          }
        `}</style>
      </div>
    </div>
  )
}
