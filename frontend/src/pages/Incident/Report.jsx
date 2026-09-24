import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// Severity sets the SLA clock, so say what each one costs rather than
// leaving the user to guess between four identical-looking buttons.
const SEVERITY_HINT = {
  low:      'Minor annoyance. No SLA countdown.',
  medium:   'Degraded but usable. Standard response window.',
  high:     'Major function unavailable. Escalated response.',
  critical: 'Production outage. Pages the on-call rotation immediately.',
};

const IncidentReport = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'medium',
    priority: 3,
    category: 'hardware',
    asset_id: ''
  });
  
  const [assets, setAssets] = useState([]);
  const [myIncidents, setMyIncidents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAssets();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchMyIncidents();
    }
  }, [currentUserId]);

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('id, name, type, status')
        .order('name');

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
    }
  };

  const fetchMyIncidents = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('flask_jwt_token');
      let fetched = false;

      if (token) {
        try {
          const response = await fetch('http://localhost:5000/api/incidents', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const result = await response.json();
            const userIncidents = (result.incidents || []).filter(
              inc => inc.reported_by === currentUserId
            );
            setMyIncidents(userIncidents);
            fetched = true;
          }
        } catch (apiErr) {
          console.warn('Backend incidents API offline, using direct Supabase query');
        }
      }

      if (!fetched && currentUserId) {
        const { data, error } = await supabase
          .from('incidents')
          .select('*')
          .eq('reported_by', currentUserId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setMyIncidents(data);
        }
      }
    } catch (error) {
      console.error('Error fetching incidents:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.title?.trim() || !formData.description?.trim()) {
        toast.error('Title and description are required');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token') || localStorage.getItem('flask_jwt_token');

      const incidentPayload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        severity: formData.severity,
        priority: parseInt(formData.priority, 10),
        category: formData.category || 'other',
        asset_id: formData.asset_id || null
      };

      let success = false;

      if (token) {
        try {
          const response = await fetch('http://localhost:5000/api/incidents', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(incidentPayload)
          });

          if (response.ok) {
            success = true;
          }
        } catch (apiErr) {
          console.warn('Backend API submission failed, fallback to Supabase');
        }
      }

      if (!success) {
        const { error } = await supabase
          .from('incidents')
          .insert([{
            ...incidentPayload,
            status: 'open',
            created_at: new Date().toISOString()
          }]);

        if (error) throw error;
        success = true;
      }

      if (success) {
        toast.success('Incident reported successfully!');
        setFormData({
          title: '',
          description: '',
          severity: 'medium',
          priority: 3,
          category: 'hardware',
          asset_id: ''
        });
        fetchMyIncidents();
      }
    } catch (error) {
      console.error('Error submitting incident:', error);
      toast.error(error.message || 'Failed to report incident');
    } finally {
      setLoading(false);
    }
  };

  const severityPills = [
    { id: 'low',      label: 'Low'      },
    { id: 'medium',   label: 'Medium'   },
    { id: 'high',     label: 'High'     },
    { id: 'critical', label: 'Critical' },
  ];

  const categories = [
    { id: 'hardware',    label: 'Hardware failure'      },
    { id: 'software',    label: 'Software glitch'       },
    { id: 'network',     label: 'Network outage'        },
    { id: 'security',    label: 'Security vulnerability'},
    { id: 'performance', label: 'Performance degraded'  },
    { id: 'other',       label: 'Other'                 },
  ];

  const STATUS_BADGE = {
    open:        'badge-code badge-danger',
    in_progress: 'badge-code badge-warning',
    resolved:    'badge-code badge-success',
    closed:      'badge-code badge-neutral',
  };

  return (
    <main className="max-w-[1400px] mx-auto py-7 px-4 sm:px-6 lg:px-8 animate-fade-in">

      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/dashboard')} className="btn btn-ghost btn-sm !px-2 -ml-2 mb-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Dashboard
        </button>
        <h1 className="page-title">Report an Incident</h1>
        <p className="page-subtitle">
          Outages, hardware failures, and security alerts enter the SLA response queue immediately.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Submission form */}
        <div className="lg:col-span-2">
          <div className="card-flush">
            <div className="card-header">
              <div>
                <h2 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>Incident details</h2>
                <p className="text-[12px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>
                  Severity sets the SLA clock, so pick it deliberately.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">

              <div>
                <label htmlFor="title" className="field-label">
                  Summary <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="input-field"
                  placeholder="e.g. Core switch on Floor 2 dropping packets"
                />
              </div>

              <div>
                <label htmlFor="description" className="field-label">
                  Symptoms &amp; impact <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows="4"
                  className="input-field"
                  placeholder="Error logs, affected services, steps to reproduce, who is impacted…"
                />
              </div>

              {/* Severity — pills, because this is a choice among four, not a list */}
              <div>
                <label className="field-label">
                  Severity <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div className="flex gap-2">
                  {severityPills.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, severity: s.id }))}
                      className="severity-pill"
                      data-sev={s.id}
                      data-active={formData.severity === s.id}
                      aria-pressed={formData.severity === s.id}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                  {SEVERITY_HINT[formData.severity]}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="category" className="field-label">Category</label>
                  <select id="category" name="category" value={formData.category} onChange={handleChange} className="input-field">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>

                <div>
                  <label htmlFor="asset_id" className="field-label">Affected asset</label>
                  <select id="asset_id" name="asset_id" value={formData.asset_id} onChange={handleChange} className="input-field">
                    <option value="">General / infrastructure-wide</option>
                    {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 mt-1" style={{ borderTop: '1px solid var(--line)' }}>
                <button type="button" onClick={() => navigate('/incidents')} className="btn-secondary">View board</button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading && (
                    <span
                      className="animate-spin-fast w-3 h-3 rounded-full"
                      style={{ border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
                    />
                  )}
                  {loading ? 'Dispatching…' : 'Dispatch ticket'}
                </button>
              </div>

            </form>
          </div>
        </div>

        {/* Sidebar: my tickets */}
        <div>
          <div className="card-flush">
            <div className="card-header">
              <p className="section-header !mb-0">My Recent Tickets</p>
              <span className="text-[11px] font-mono tnum" style={{ color: 'var(--text-faint)' }}>
                {myIncidents.length}
              </span>
            </div>

            {myIncidents.length === 0 ? (
              <div className="empty-state !py-10">
                <div className="empty-state-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <p className="empty-state-title">No tickets yet</p>
                <p className="empty-state-text">Incidents you report will be listed here.</p>
              </div>
            ) : (
              <div className="p-2.5 flex flex-col gap-1.5 stagger" style={{ maxHeight: 480, overflowY: 'auto' }}>
                {myIncidents.map(inc => (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => navigate('/incidents')}
                    className="ticket-row"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[12.5px] font-semibold truncate m-0" style={{ color: 'var(--text)' }}>
                        {inc.title}
                      </h4>
                      <span className={STATUS_BADGE[inc.status] || STATUS_BADGE.open}>
                        {(inc.status || 'open').replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] line-clamp-2 mt-1 mb-0" style={{ color: 'var(--text-muted)' }}>
                      {inc.description}
                    </p>
                    <div className="flex items-center justify-between text-[10.5px] font-mono mt-1.5" style={{ color: 'var(--text-faint)' }}>
                      <span className="uppercase">{inc.severity}</span>
                      <span className="tnum">{new Date(inc.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      <style>{`
        .ticket-row {
          display: block;
          width: 100%;
          text-align: left;
          padding: 10px 11px;
          border-radius: 10px;
          cursor: pointer;
          background: var(--surface-sunk);
          border: 1px solid var(--line);
          transition:
            transform var(--t-press) var(--ease-out),
            border-color var(--t-press) var(--ease-out),
            background-color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .ticket-row:hover { border-color: var(--brand-line); background: var(--brand-soft); }
        }
        .ticket-row:active { transform: scale(0.985); }
        @media (prefers-reduced-motion: reduce) {
          .ticket-row:active { transform: none; }
        }
      `}</style>
    </main>
  );
};

export default IncidentReport;
