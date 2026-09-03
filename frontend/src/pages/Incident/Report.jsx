import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

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
        asset_id: formData.asset_id || null,
        reported_by: currentUserId
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
    { id: 'low', label: 'Low', badge: 'bg-slate-500/10 text-slate-600 border-slate-500/30' },
    { id: 'medium', label: 'Medium', badge: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
    { id: 'high', label: 'High', badge: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
    { id: 'critical', label: 'Critical (P1)', badge: 'bg-rose-500/10 text-rose-600 border-rose-500/30' }
  ];

  const categories = [
    { id: 'hardware', label: 'Hardware Failure', icon: '🖥️' },
    { id: 'software', label: 'Software Glitch', icon: '📦' },
    { id: 'network', label: 'Network Outage', icon: '🌐' },
    { id: 'security', label: 'Security Vulnerability', icon: '🛡️' },
    { id: 'performance', label: 'Performance Degraded', icon: '⚡' },
    { id: 'other', label: 'Other', icon: '📋' }
  ];

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 font-space animate-fade-in">
      
      {/* Back Button & Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1.5 cursor-pointer mb-2"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <span>🚨</span> Report Infrastructure Incident
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Submit production outages, hardware failures, or security alerts into the SLA response queue.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Incident Submission Form */}
        <div className="lg:col-span-2">
          <div className="card space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-lg">📝</span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Incident Triage Details
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Incident Summary / Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="input-field"
                  placeholder="e.g. Core Switch Floor 2 packet drops, Database latency spike"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Detailed Symptoms & Impact <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows="4"
                  className="input-field font-sans"
                  placeholder="Describe error logs, affected services, steps to reproduce, user impact..."
                />
              </div>

              {/* Severity Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Severity Level <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {severityPills.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, severity: s.id }))}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        formData.severity === s.id
                          ? 'bg-purple-600/10 border-purple-500 text-purple-600 dark:text-purple-300 shadow-xs'
                          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Category & Asset Association */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="category" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="input-field font-sans text-xs"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="asset_id" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Affected Infrastructure Asset
                  </label>
                  <select
                    id="asset_id"
                    name="asset_id"
                    value={formData.asset_id}
                    onChange={handleChange}
                    className="input-field font-sans text-xs"
                  >
                    <option value="">General / Infrastructure Wide</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit Action */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => navigate('/incidents')}
                  className="btn-secondary"
                >
                  View Incident Board
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex items-center gap-2"
                >
                  <span>{loading ? '⏳' : '🚀'}</span>
                  {loading ? 'Submitting...' : 'Dispatch Incident Ticket'}
                </button>
              </div>

            </form>
          </div>
        </div>

        {/* Sidebar: My Reported Incidents */}
        <div>
          <div className="card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base">📋</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  My Recent Tickets
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-purple-600">
                {myIncidents.length} Reported
              </span>
            </div>

            {myIncidents.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                You have not reported any incidents yet.
              </div>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {myIncidents.map(inc => (
                  <div
                    key={inc.id}
                    onClick={() => navigate('/incidents')}
                    className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-purple-500 transition-all cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[150px]">
                        {inc.title}
                      </h4>
                      <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded bg-purple-500/10 text-purple-600 border border-purple-500/30">
                        {inc.status || 'open'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {inc.description}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                      <span>{inc.severity}</span>
                      <span>{new Date(inc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </main>
  );
};

export default IncidentReport;
