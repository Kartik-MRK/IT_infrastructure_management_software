import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import SLACountdownTimer from '../../components/SLACountdownTimer';
import SLAPolicyConfigModal from '../../components/SLAPolicyConfigModal';
import SLAComplianceWidget from '../../components/SLAComplianceWidget';
import PostMortemModal from '../../components/PostMortemModal';

const SEVERITY_RAIL = {
  critical: '#dc2626',
  high:     '#d97706',
  medium:   '#2563eb',
  low:      '#64748b',
};

const SEVERITY_FILTERS = [
  { value: '',         label: 'All'      },
  { value: 'critical', label: 'Critical' },
  { value: 'high',     label: 'High'     },
  { value: 'medium',   label: 'Medium'   },
  { value: 'low',      label: 'Low'      },
];

const IncidentList = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    category: ''
  });
  const [searchText, setSearchText] = useState('');
  
  // Post-Mortem & RCA State
  const [selectedIncidentForPostmortem, setSelectedIncidentForPostmortem] = useState(null);

  // SLA Policies Modal State
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [slaRefreshKey, setSlaRefreshKey] = useState(0);

  // Status change modal state
  const resolutionRef = useRef(null);
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    incidentId: null,
    currentStatus: '',
    newStatus: '',
    description: ''
  });

  useEffect(() => {
    fetchIncidents();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchIncidents(true); // Silent refresh
    }, 30000);

    return () => clearInterval(interval);
  }, [filters]); // Only re-fetch when API filters change, not on search text

  const fetchIncidents = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const token = localStorage.getItem('token') || localStorage.getItem('flask_jwt_token');

      // Build query parameters
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.category) params.append('category', filters.category);

      let fetched = false;

      if (token) {
        try {
          const response = await fetch(`http://localhost:5000/api/incidents?${params.toString()}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const result = await response.json();
            // Search is applied to the rendered list, not here — filtering at
            // fetch time meant a keystroke did nothing until the next refresh.
            setIncidents(result.incidents || []);
            fetched = true;
          }
        } catch (apiErr) {
          console.warn('Backend incidents API offline, using direct Supabase query');
        }
      }

      if (!fetched) {
        await fetchIncidentsFallback();
      }
    } catch (error) {
      console.error('Error fetching incidents:', error);
      await fetchIncidentsFallback();
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchIncidentsFallback = async () => {
    try {
      let query = supabase
        .from('incidents')
        .select(`
          *,
          asset:assets(id, name, type),
          reporter:profiles!incidents_reported_by_fkey(id, full_name, email),
          assignee:profiles!incidents_assigned_to_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.severity) query = query.eq('severity', filters.severity);
      if (filters.category) query = query.eq('category', filters.category);

      const { data, error } = await query;

      if (error) throw error;

      setIncidents(data || []);
    } catch (fallbackError) {
      console.error('Error fetching incidents from Supabase:', fallbackError);
      toast.error('Failed to load incidents');
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStatusUpdate = async (incidentId, newStatus) => {
    try {
      const incident = incidents.find(inc => inc.id === incidentId);
      
      if (newStatus === 'resolved' || newStatus === 'closed') {
        setStatusModal({
          isOpen: true,
          incidentId: incidentId,
          currentStatus: incident?.status || 'open',
          newStatus: newStatus,
          description: ''
        });
        return;
      }

      const token = localStorage.getItem('token') || localStorage.getItem('flask_jwt_token');
      let success = false;

      if (token) {
        try {
          const response = await fetch(`http://localhost:5000/api/incidents/${incidentId}/status`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
          });

          if (response.ok) {
            success = true;
          }
        } catch (apiErr) {
          console.warn('Backend API status update failed, fallback to Supabase');
        }
      }

      if (!success) {
        const { error } = await supabase
          .from('incidents')
          .update({
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', incidentId);

        if (error) throw error;
        success = true;
      }

      if (success) {
        toast.success(`Incident status updated to ${newStatus.replace('_', ' ')}`);
        fetchIncidents(true);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(error.message || 'Failed to update status');
    }
  };

  const handleStatusModalSubmit = async () => {
    try {
      const { incidentId, newStatus, description } = statusModal;

      if (!description.trim()) {
        toast.error('Please provide a description');
        return;
      }

      const token = localStorage.getItem('token') || localStorage.getItem('flask_jwt_token');
      let success = false;

      const payload = {
        status: newStatus,
        ...(newStatus === 'resolved' && { resolution_notes: description }),
        ...(newStatus === 'closed' && { resolution_notes: description })
      };

      if (token) {
        try {
          const response = await fetch(`http://localhost:5000/api/incidents/${incidentId}/status`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            success = true;
          }
        } catch (apiErr) {
          console.warn('Backend API status update failed, fallback to Supabase');
        }
      }

      if (!success) {
        const updateData = {
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...(newStatus === 'resolved' && {
            resolution_notes: description,
            resolved_at: new Date().toISOString()
          }),
          ...(newStatus === 'closed' && {
            resolution_notes: description
          })
        };

        const { error } = await supabase
          .from('incidents')
          .update(updateData)
          .eq('id', incidentId);

        if (error) throw error;
        success = true;
      }

      if (success) {
        toast.success(`Incident marked as ${newStatus}`);
        closeStatusModal();
        fetchIncidents(true);
      }
    } catch (error) {
      console.error('Error updating status with description:', error);
      toast.error(error.message || 'Failed to update status');
    }
  };

  const closeStatusModal = () => {
    setStatusModal({
      isOpen: false,
      incidentId: null,
      currentStatus: '',
      newStatus: '',
      description: ''
    });
  };

  const handleResolve = async (incidentId) => {
    try {
      const incident = incidents.find(inc => inc.id === incidentId);
      setStatusModal({
        isOpen: true,
        incidentId: incidentId,
        currentStatus: incident?.status || 'open',
        newStatus: 'resolved',
        description: ''
      });
    } catch (error) {
      console.error('Error resolving incident:', error);
      toast.error('An error occurred while resolving the incident');
    }
  };

  const handleDelete = async (incidentId) => {
    if (!window.confirm('Are you sure you want to delete this incident? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in to delete incidents');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/incidents/${incidentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Incident deleted successfully!');
        fetchIncidents(true);
      } else if (response.status === 403) {
        toast.error('Only admins can delete incidents');
      } else {
        const result = await response.json();
        toast.error(result.error || 'Failed to delete incident');
      }
    } catch (error) {
      console.error('Error deleting incident:', error);
      toast.error('An error occurred while deleting the incident');
    }
  };

  const severityBadge = (severity) => {
    switch (severity) {
      case 'critical': return 'badge-code badge-danger';
      case 'high':     return 'badge-code badge-warning';
      case 'medium':   return 'badge-code badge-info';
      default:         return 'badge-code badge-neutral';
    }
  };

  const statusBadge = (status) => {
    switch (status) {
      case 'open':        return 'badge-code badge-danger';
      case 'in_progress': return 'badge-code badge-warning';
      case 'resolved':    return 'badge-code badge-success';
      default:            return 'badge-code badge-neutral';
    }
  };

  const handleAcknowledge = async (incidentId) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('flask_jwt_token');
      const response = await fetch(`http://localhost:5000/api/incidents/${incidentId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || 'Incident response recorded!');
        fetchIncidents(true);
        setSlaRefreshKey(k => k + 1);
      } else {
        toast.error(data.error || 'Failed to acknowledge incident');
      }
    } catch (error) {
      toast.error('An error occurred while acknowledging incident');
    }
  };

  // Search filters what's on screen, so a keystroke shows its result on the
  // next frame instead of waiting for the 30s refresh.
  const visibleIncidents = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return incidents;
    return incidents.filter(inc =>
      inc.title?.toLowerCase().includes(q) ||
      inc.description?.toLowerCase().includes(q)
    );
  }, [incidents, searchText]);

  const hasFilters = Boolean(filters.status || filters.severity || filters.category || searchText);

  const clearFilters = () => {
    setSearchText('');
    setFilters({ status: '', severity: '', category: '' });
  };

  // Escape closes the resolution modal. Keyboard-driven, so no animation delay
  // stands between the key and the dismissal.
  useEffect(() => {
    if (!statusModal.isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') closeStatusModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [statusModal.isOpen]);

  useEffect(() => {
    if (statusModal.isOpen) resolutionRef.current?.focus();
  }, [statusModal.isOpen]);

  return (
    <main className="max-w-[1400px] mx-auto py-7 px-4 sm:px-6 lg:px-8 animate-fade-in flex flex-col gap-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate('/dashboard')} className="btn btn-ghost btn-sm !px-2 -ml-2 mb-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Dashboard
          </button>
          <h1 className="page-title flex items-center gap-2.5">
            Incident Command
            <span className="badge-code" style={{ color: 'var(--brand)', background: 'var(--brand-soft)', borderColor: 'var(--brand-line)' }}>
              {visibleIncidents.length} shown
            </span>
          </h1>
          <p className="page-subtitle">Response queue, SLA breach countdowns, and post-mortem triage.</p>
        </div>

        <button onClick={() => navigate('/incidents/report')} className="btn-primary shrink-0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Report Incident
        </button>
      </div>

      {/* SLA Reliability Scorecard & Policies Widget */}
      <SLAComplianceWidget
        onOpenPolicyModal={() => setIsPolicyModalOpen(true)}
        canManagePolicy={isAdmin}
        refreshKey={slaRefreshKey}
      />

      {/* Filter dock */}
      <div className="card !p-4 flex flex-col gap-3.5">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div>
            <label htmlFor="search" className="field-label">Search</label>
            <input
              type="text"
              id="search"
              name="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Title or description…"
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="status" className="field-label">Status</label>
            <select id="status" name="status" value={filters.status} onChange={handleFilterChange} className="input-field">
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div>
            <label htmlFor="category" className="field-label">Category</label>
            <select id="category" name="category" value={filters.category} onChange={handleFilterChange} className="input-field">
              <option value="">All categories</option>
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
              <option value="network">Network</option>
              <option value="security">Security</option>
              <option value="performance">Performance</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Severity as pills, not a select — it is the field people reach for
            most, and one tap beats open-scan-pick. */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="field-label !mb-0">Severity</span>
            {hasFilters && (
              <button onClick={clearFilters} className="btn btn-ghost btn-sm !px-2 !py-1 !text-[11px]">
                Clear all
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {SEVERITY_FILTERS.map(({ value, label }) => (
              <button
                key={value || 'all'}
                type="button"
                onClick={() => setFilters(prev => ({ ...prev, severity: value }))}
                className="severity-pill"
                data-sev={value || 'all'}
                data-active={filters.severity === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Incident queue */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card flex flex-col gap-3">
              <div className="flex justify-between items-center gap-4">
                <div className="skeleton h-[13px] w-1/3" />
                <div className="skeleton h-[16px] w-[90px] !rounded-full" />
              </div>
              <div className="skeleton h-[10px] w-3/4" />
              <div className="skeleton h-[10px] w-1/2" />
            </div>
          ))}
        </div>
      ) : visibleIncidents.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ background: 'var(--ok-soft)', borderColor: 'var(--ok-line)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <p className="empty-state-title">{hasFilters ? 'No incidents match those filters' : 'No open incidents'}</p>
            <p className="empty-state-text">
              {hasFilters
                ? 'Try widening the severity or status filter.'
                : 'All infrastructure nodes are healthy and responding within SLA.'}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="btn-secondary btn-sm mt-4">Clear filters</button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 stagger">
          {visibleIncidents.map(incident => {
            const rail = SEVERITY_RAIL[incident.severity] || 'var(--line-strong)';
            const canAct = isAdmin || incident.assigned_to === user?.id;
            const isOwner = isAdmin || incident.assigned_to === user?.id || incident.reported_by === user?.id;
            const isDone = incident.status === 'resolved' || incident.status === 'closed';

            return (
              <article key={incident.id} className="card incident-card" style={{ borderLeft: `3px solid ${rail}` }}>

                <div className="flex flex-wrap items-center gap-2 mb-2.5">
                  <h3 className="text-[14px] font-bold m-0 mr-1" style={{ color: 'var(--text)' }}>
                    {incident.title}
                  </h3>
                  <SLACountdownTimer incident={incident} type="resolution" />
                  <SLACountdownTimer incident={incident} type="response" />
                  <span className={severityBadge(incident.severity)}>{incident.severity}</span>
                  <span className={statusBadge(incident.status)}>{incident.status.replace('_', ' ')}</span>
                </div>

                <p className="text-[13px] leading-relaxed m-0" style={{ color: 'var(--text-soft)' }}>
                  {incident.description}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-mono mt-3" style={{ color: 'var(--text-faint)' }}>
                  {incident.category && <span>{incident.category}</span>}
                  {incident.asset && <span>{incident.asset.name}</span>}
                  {incident.reporter && <span>{incident.reporter.full_name || incident.reporter.email}</span>}
                  <span className="tnum">{new Date(incident.reported_at || incident.created_at).toLocaleString()}</span>
                </div>

                {/* Actions */}
                <div
                  className="flex flex-wrap items-center justify-between gap-2 mt-3.5 pt-3"
                  style={{ borderTop: '1px solid var(--line)' }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {!incident.first_responded_at && !isDone && (
                      <button
                        onClick={() => handleAcknowledge(incident.id)}
                        className="btn btn-sm btn-ack"
                        title="Acknowledge incident to fulfill response SLA"
                      >
                        Acknowledge SLA
                      </button>
                    )}

                    {isDone && (
                      <button
                        onClick={() => setSelectedIncidentForPostmortem(incident.id)}
                        className="btn btn-sm btn-postmortem"
                        title="View or edit 5-Whys Root Cause Analysis and Action Items"
                      >
                        Post-Mortem &amp; RCA
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isOwner && incident.status !== 'resolved' && (
                      <>
                        <select
                          value={incident.status}
                          onChange={(e) => handleStatusUpdate(incident.id, e.target.value)}
                          className="input-field !w-auto !py-1.5 !pl-2.5 !pr-8 !text-[12px]"
                          disabled={!canAct}
                          aria-label="Change status"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>

                        <button onClick={() => handleResolve(incident.id)} className="btn-success btn-sm" disabled={!canAct}>
                          Mark Resolved
                        </button>
                      </>
                    )}

                    {isAdmin && (
                      <button onClick={() => handleDelete(incident.id)} className="btn btn-danger-soft btn-sm">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Resolution / close modal */}
      {statusModal.isOpen && (
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeStatusModal(); }}>
          <div className="modal max-w-lg" role="dialog" aria-modal="true" aria-label="Update incident status">
            <div className="modal-header">
              <h3 className="text-[15px] font-bold m-0" style={{ color: 'var(--text)' }}>
                {statusModal.newStatus === 'closed' ? 'Close incident' : 'Resolve incident'}
              </h3>
              <button onClick={closeStatusModal} className="btn btn-ghost btn-icon" aria-label="Close">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="modal-body">
              <label htmlFor="resolution" className="field-label">
                {statusModal.newStatus === 'closed' ? 'Closing description' : 'Resolution notes'}
                <span style={{ color: 'var(--danger)' }}> *</span>
              </label>
              <textarea
                id="resolution"
                ref={resolutionRef}
                value={statusModal.description}
                onChange={(e) => setStatusModal(prev => ({ ...prev, description: e.target.value }))}
                rows="4"
                className="input-field"
                placeholder={
                  statusModal.newStatus === 'closed'
                    ? 'Why is this incident being closed?'
                    : 'Root cause identified and remediation applied…'
                }
              />
            </div>

            <div className="modal-footer">
              <button onClick={closeStatusModal} className="btn-secondary">Cancel</button>
              <button
                onClick={handleStatusModalSubmit}
                className={statusModal.newStatus === 'closed' ? 'btn-primary' : 'btn-success'}
                disabled={!statusModal.description.trim()}
              >
                {statusModal.newStatus === 'closed' ? 'Confirm close' : 'Confirm resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enterprise SLA Policy Configuration Modal */}
      <SLAPolicyConfigModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        onPoliciesUpdated={() => {
          setSlaRefreshKey(k => k + 1);
          fetchIncidents(true);
        }}
      />

      {/* SRE Post-Mortem & 5-Whys RCA Modal */}
      <PostMortemModal
        isOpen={!!selectedIncidentForPostmortem}
        incidentId={selectedIncidentForPostmortem}
        onClose={() => setSelectedIncidentForPostmortem(null)}
        onUpdated={() => fetchIncidents(true)}
      />

      <style>{`
        .incident-card {
          transition: box-shadow var(--t-pop) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .incident-card:hover {
            box-shadow: 0 2px 6px rgba(15,23,42,0.05), 0 10px 24px rgba(15,23,42,0.07);
          }
        }
        .btn-ack {
          color: #0e7490;
          background: #ecfeff;
          border-color: #a5f3fc;
        }
        @media (hover: hover) and (pointer: fine) {
          .btn-ack:hover { background: #0e7490; border-color: #0e7490; color: #fff; }
        }
        .btn-postmortem {
          color: #7c3aed;
          background: #f5f3ff;
          border-color: #ddd6fe;
        }
        @media (hover: hover) and (pointer: fine) {
          .btn-postmortem:hover { background: #7c3aed; border-color: #7c3aed; color: #fff; }
        }
      `}</style>
    </main>
  );
};

export default IncidentList;
