import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import SLACountdownTimer from '../../components/SLACountdownTimer';
import SLAPolicyConfigModal from '../../components/SLAPolicyConfigModal';
import SLAComplianceWidget from '../../components/SLAComplianceWidget';
import PostMortemModal from '../../components/PostMortemModal';

const IncidentList = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    category: '',
    search: ''
  });
  
  // Post-Mortem & RCA State
  const [selectedIncidentForPostmortem, setSelectedIncidentForPostmortem] = useState(null);

  // SLA Policies Modal State
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [slaRefreshKey, setSlaRefreshKey] = useState(0);

  // Status change modal state
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
  }, [filters]);

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
            
            let filteredIncidents = result.incidents || [];
            if (filters.search) {
              const searchLower = filters.search.toLowerCase();
              filteredIncidents = filteredIncidents.filter(inc =>
                inc.title.toLowerCase().includes(searchLower) ||
                inc.description?.toLowerCase().includes(searchLower)
              );
            }
            
            setIncidents(filteredIncidents);
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

      let filteredIncidents = data || [];
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredIncidents = filteredIncidents.filter(inc =>
          inc.title.toLowerCase().includes(searchLower) ||
          inc.description?.toLowerCase().includes(searchLower)
        );
      }

      setIncidents(filteredIncidents);
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
            method: 'PATCH',
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
        ...(newStatus === 'closed' && { closing_notes: description })
      };

      if (token) {
        try {
          const response = await fetch(`http://localhost:5000/api/incidents/${incidentId}/status`, {
            method: 'PATCH',
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
            closing_notes: description,
            closed_at: new Date().toISOString()
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

  const getSeverityBadgeClass = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/30';
      case 'high':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'medium':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'low':
        return 'bg-slate-500/10 text-slate-600 border-slate-500/30';
      default:
        return 'bg-slate-500/10 text-slate-600 border-slate-500/30';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'open':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/30';
      case 'in_progress':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'resolved':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
      case 'closed':
        return 'bg-slate-500/10 text-slate-600 border-slate-500/30';
      default:
        return 'bg-slate-500/10 text-slate-600 border-slate-500/30';
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

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 font-space animate-fade-in space-y-6">
      
      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1.5 cursor-pointer mb-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span>🚨</span> Incident Management & SLA Command
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time incident response queue, SLA breach countdown timers, and SRE post-mortem triage.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/incidents/report')}
            className="btn-primary flex items-center gap-2 text-xs"
          >
            <span>➕</span> Report New Incident
          </button>
        </div>
      </div>

      {/* SLA Reliability Scorecard & Policies Widget */}
      <SLAComplianceWidget
        onOpenPolicyModal={() => setIsPolicyModalOpen(true)}
        canManagePolicy={isAdmin}
        refreshKey={slaRefreshKey}
      />

      {/* Modern Filter Dock */}
      <div className="card !p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Search Keywords
            </label>
            <input
              type="text"
              id="search"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Search title, logs..."
              className="input-field"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="status" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Lifecycle Status
            </label>
            <select
              id="status"
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="input-field font-sans text-xs"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <label htmlFor="severity" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Severity Level
            </label>
            <select
              id="severity"
              name="severity"
              value={filters.severity}
              onChange={handleFilterChange}
              className="input-field font-sans text-xs"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical (P1)</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label htmlFor="category" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Infrastructure Category
            </label>
            <select
              id="category"
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="input-field font-sans text-xs"
            >
              <option value="">All Categories</option>
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
              <option value="network">Network</option>
              <option value="security">Security</option>
              <option value="performance">Performance</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incidents List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-24"></div>
              </div>
              <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="card py-16 text-center space-y-2">
          <span className="text-4xl block">🎉</span>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Zero Active Incidents</h3>
          <p className="text-xs text-slate-400">
            {filters.status || filters.severity || filters.category || filters.search
              ? 'No incidents matched your query parameters.'
              : 'All infrastructure nodes are healthy and responding within SLA.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {incidents.map(incident => (
            <div
              key={incident.id}
              className="card space-y-4 hover:border-purple-500/50 transition-all shadow-xs"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  
                  {/* Header Title & Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mr-2">
                      {incident.title}
                    </h3>
                    <SLACountdownTimer incident={incident} type="resolution" />
                    <SLACountdownTimer incident={incident} type="response" />
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase border ${getSeverityBadgeClass(incident.severity)}`}>
                      {incident.severity}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase border ${getStatusBadgeClass(incident.status)}`}>
                      {incident.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {incident.description}
                  </p>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono pt-1">
                    {incident.category && (
                      <span>📁 {incident.category}</span>
                    )}
                    {incident.asset && (
                      <span>🖥️ {incident.asset.name}</span>
                    )}
                    {incident.reporter && (
                      <span>👤 {incident.reporter.full_name || incident.reporter.email}</span>
                    )}
                    <span>📅 {new Date(incident.reported_at || incident.created_at).toLocaleString()}</span>
                  </div>

                </div>
              </div>

              {/* Actions Dock */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  {!incident.first_responded_at && incident.status !== 'resolved' && incident.status !== 'closed' && (
                    <button
                      onClick={() => handleAcknowledge(incident.id)}
                      className="px-3 py-1.5 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Acknowledge incident to fulfill response SLA"
                    >
                      <span>⚡</span> Acknowledge SLA
                    </button>
                  )}

                  {(incident.status === 'resolved' || incident.status === 'closed') && (
                    <button
                      onClick={() => setSelectedIncidentForPostmortem(incident.id)}
                      className="px-3 py-1.5 text-xs font-bold bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      title="View or edit 5-Whys Root Cause Analysis and Action Items"
                    >
                      <span>📋</span> SRE Post-Mortem & RCA
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {(isAdmin || incident.assigned_to === user?.id || incident.reported_by === user?.id) && incident.status !== 'resolved' && (
                    <>
                      <select
                        value={incident.status}
                        onChange={(e) => handleStatusUpdate(incident.id, e.target.value)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                        disabled={!isAdmin && incident.assigned_to !== user?.id}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>

                      <button
                        onClick={() => handleResolve(incident.id)}
                        className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all cursor-pointer"
                        disabled={!isAdmin && incident.assigned_to !== user?.id}
                      >
                        Mark Resolved
                      </button>
                    </>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(incident.id)}
                      className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Status Change Modal with Backdrop Blur */}
      {statusModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="card !p-6 max-w-lg w-full space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-fade-in">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{statusModal.newStatus === 'closed' ? '🔒' : '✅'}</span>
                {statusModal.newStatus === 'closed' ? 'Close Incident Ticket' : 'Resolve Incident Ticket'}
              </h3>
              <button
                onClick={closeStatusModal}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                {statusModal.newStatus === 'closed' ? 'Closing Description' : 'Resolution Notes'} <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={statusModal.description}
                onChange={(e) => setStatusModal(prev => ({ ...prev, description: e.target.value }))}
                rows="4"
                className="input-field font-sans"
                placeholder={
                  statusModal.newStatus === 'closed'
                    ? 'Describe why this incident is being closed...'
                    : 'Describe root cause identified and remediation applied to resolve the outage...'
                }
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeStatusModal}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusModalSubmit}
                className={`btn-primary ${
                  statusModal.newStatus === 'closed'
                    ? '!bg-slate-700 hover:!bg-slate-600'
                    : '!bg-emerald-600 hover:!bg-emerald-500'
                }`}
              >
                {statusModal.newStatus === 'closed' ? 'Confirm Close' : 'Confirm Resolution'}
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

    </main>
  );
};

export default IncidentList;
