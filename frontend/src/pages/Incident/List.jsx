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
      let query = supabase.from('incidents').select(`
        *,
        reporter:reported_by(id, email, full_name),
        assignee:assigned_to(id, email, full_name),
        resolver:resolved_by(id, email, full_name),
        asset:asset_id(id, name, type)
      `);

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.severity) query = query.eq('severity', filters.severity);
      if (filters.category) query = query.eq('category', filters.category);

      query = query.order('priority', { ascending: false }).order('created_at', { ascending: false });

      const { data, error } = await query;
      if (!error && data) {
        let filtered = data;
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filtered = data.filter(inc =>
            inc.title.toLowerCase().includes(searchLower) ||
            inc.description?.toLowerCase().includes(searchLower)
          );
        }
        setIncidents(filtered);
      }
    } catch (err) {
      console.error('Fallback fetch incidents error:', err);
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
      // If changing to closed, open modal for description
      if (newStatus === 'closed') {
        const incident = incidents.find(inc => inc.id === incidentId);
        setStatusModal({
          isOpen: true,
          incidentId: incidentId,
          currentStatus: incident.status,
          newStatus: 'closed',
          description: ''
        });
        return;
      }

      // For other status changes, update directly
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in to update incidents');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/incidents/${incidentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Incident status updated successfully!');
        fetchIncidents(true); // Refresh list
      } else if (response.status === 403) {
        toast.error('You do not have permission to update this incident');
      } else {
        toast.error(result.error || 'Failed to update incident');
      }
    } catch (error) {
      console.error('Error updating incident:', error);
      toast.error('An error occurred while updating the incident');
    }
  };

  const handleStatusModalSubmit = async () => {
    try {
      if (!statusModal.description.trim()) {
        toast.error(`Please provide ${statusModal.newStatus === 'closed' ? 'a closing description' : 'resolution notes'}`);
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in to update incidents');
        return;
      }

      const updateData = {
        status: statusModal.newStatus,
        resolution_notes: statusModal.description
      };

      const response = await fetch(`http://localhost:5000/api/incidents/${statusModal.incidentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`Incident ${statusModal.newStatus === 'closed' ? 'closed' : 'resolved'} successfully!`);
        setStatusModal({
          isOpen: false,
          incidentId: null,
          currentStatus: '',
          newStatus: '',
          description: ''
        });
        fetchIncidents(true); // Refresh list
      } else if (response.status === 403) {
        toast.error('You do not have permission to update this incident');
      } else {
        toast.error(result.error || 'Failed to update incident');
      }
    } catch (error) {
      console.error('Error updating incident:', error);
      toast.error('An error occurred while updating the incident');
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
      // Open modal for resolution notes
      const incident = incidents.find(inc => inc.id === incidentId);
      setStatusModal({
        isOpen: true,
        incidentId: incidentId,
        currentStatus: incident.status,
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
        fetchIncidents(true); // Refresh list
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
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 font-space">
      {/* Back Button */}
      <div className="mb-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer shadow-sm"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Incident Management & SLA Command</h1>
        <p className="mt-1 text-sm text-gray-600">
          Real-time incident response, resolution countdown timers, and contractual SLA tracking.
        </p>
      </div>

      {/* SLA Reliability Scorecard & Policies Widget */}
      <SLAComplianceWidget
        onOpenPolicyModal={() => setIsPolicyModalOpen(true)}
        canManagePolicy={isAdmin}
        refreshKey={slaRefreshKey}
      />

      {/* Filters */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              id="search"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Search title or description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label htmlFor="severity" className="block text-sm font-medium text-gray-700 mb-1">
              Severity
            </label>
            <select
              id="severity"
              name="severity"
              value={filters.severity}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              id="category"
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
              <option value="network">Network</option>
              <option value="security">Security</option>
              <option value="performance">Performance</option>
              <option value="access">Access/Permission</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incidents List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white rounded-lg border border-gray-200 p-6 space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                <div className="flex space-x-2">
                  <div className="h-5 bg-gray-200 rounded-full w-16"></div>
                  <div className="h-5 bg-gray-200 rounded-full w-20"></div>
                </div>
              </div>
              <div className="h-4 bg-gray-100 rounded w-3/4"></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div className="h-3 bg-gray-100 rounded w-20"></div>
                <div className="h-3 bg-gray-100 rounded w-16"></div>
                <div className="h-3 bg-gray-100 rounded w-24"></div>
                <div className="h-3 bg-gray-100 rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No incidents found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filters.status || filters.severity || filters.category || filters.search
              ? 'Try adjusting your filters'
              : 'No incidents have been reported yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {incidents.map(incident => (
            <div
              key={incident.id}
              className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 flex-1">
                      {incident.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                      <SLACountdownTimer incident={incident} type="resolution" />
                      <SLACountdownTimer incident={incident} type="response" />
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${getSeverityBadgeClass(incident.severity)}`}>
                        {incident.severity}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClass(incident.status)}`}>
                        {incident.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-700 mb-3 whitespace-pre-wrap">
                    {incident.description}
                  </p>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                    {incident.category && (
                      <div>
                        <span className="font-medium">Category:</span>{' '}
                        <span className="capitalize">{incident.category}</span>
                      </div>
                    )}
                    
                    <div>
                      <span className="font-medium">Priority:</span>{' '}
                      <span>{incident.priority}/10</span>
                    </div>

                    {incident.asset && (
                      <div>
                        <span className="font-medium">Asset:</span>{' '}
                        <span>{incident.asset.name}</span>
                      </div>
                    )}

                    {incident.reporter && (
                      <div>
                        <span className="font-medium">Reported by:</span>{' '}
                        <span>{incident.reporter.full_name || incident.reporter.email}</span>
                      </div>
                    )}

                    {incident.assignee && (
                      <div>
                        <span className="font-medium">Assigned to:</span>{' '}
                        <span>{incident.assignee.full_name || incident.assignee.email}</span>
                      </div>
                    )}

                    <div>
                      <span className="font-medium">Reported:</span>{' '}
                      <span>{new Date(incident.reported_at || incident.created_at).toLocaleString()}</span>
                    </div>

                    {incident.resolved_at && (
                      <div>
                        <span className="font-medium">Resolved:</span>{' '}
                        <span>{new Date(incident.resolved_at).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-200">
                    {!incident.first_responded_at && incident.status !== 'resolved' && incident.status !== 'closed' && (
                      <button
                        onClick={() => handleAcknowledge(incident.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-md shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                        title="Acknowledge incident to fulfill response SLA"
                      >
                        <span>⚡</span> Acknowledge (SLA)
                      </button>
                    )}

                    {(isAdmin || incident.assigned_to === user?.id || incident.reported_by === user?.id) && incident.status !== 'resolved' && (
                      <>
                        <select
                          value={incident.status}
                          onChange={(e) => handleStatusUpdate(incident.id, e.target.value)}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={!isAdmin && incident.assigned_to !== user?.id}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>

                        <button
                          onClick={() => handleResolve(incident.id)}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                          disabled={!isAdmin && incident.assigned_to !== user?.id}
                        >
                          Mark as Resolved
                        </button>
                      </>
                    )}

                    {(incident.status === 'resolved' || incident.status === 'closed') && (
                      <button
                        onClick={() => setSelectedIncidentForPostmortem(incident.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-purple-100 dark:bg-purple-950/50 hover:bg-purple-200 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40 rounded-md shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                        title="View or edit 5-Whys Root Cause Analysis and Action Items"
                      >
                        <span>📋</span> Post-Mortem & RCA
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(incident.id)}
                        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results Count */}
      {!loading && incidents.length > 0 && (
        <div className="mt-4 text-sm text-gray-600 text-center">
          Showing {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Status Change Modal */}
      {statusModal.isOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {statusModal.newStatus === 'closed' ? 'Close Incident' : 'Resolve Incident'}
                </h3>
                <button
                  onClick={closeStatusModal}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {statusModal.newStatus === 'closed' ? 'Closing Description' : 'Resolution Notes'}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={statusModal.description}
                  onChange={(e) => setStatusModal(prev => ({ ...prev, description: e.target.value }))}
                  rows="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={
                    statusModal.newStatus === 'closed'
                      ? 'Describe why this incident is being closed...'
                      : 'Describe how this incident was resolved...'
                  }
                />
                <p className="mt-1 text-xs text-gray-500">
                  {statusModal.newStatus === 'closed'
                    ? 'This description will be saved as the closing notes for this incident.'
                    : 'This description will be saved as the resolution notes for this incident.'}
                </p>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeStatusModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStatusModalSubmit}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    statusModal.newStatus === 'closed'
                      ? 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500'
                      : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  }`}
                >
                  {statusModal.newStatus === 'closed' ? 'Close Incident' : 'Mark as Resolved'}
                </button>
              </div>
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
