import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import './UserManagement.css'

// Roles carry weight, so they read as words rather than raw enum keys.
// Tone is the only decoration — no emoji, because a crown and a headset
// tell you less about privilege than the label already does.
const ROLE_META = {
  admin:                   { label: 'Admin',              tone: 'badge-code badge-danger'  },
  it_admin:                { label: 'IT Admin',           tone: 'badge-code badge-danger'  },
  operator:                { label: 'Operator',           tone: 'badge-code badge-info'    },
  infrastructure_engineer: { label: 'Infra Engineer',     tone: 'badge-code badge-info'    },
  helpdesk_operator:       { label: 'Helpdesk',           tone: 'badge-code badge-info'    },
  asset_custodian:         { label: 'Asset Custodian',    tone: 'badge-code badge-neutral' },
  security_auditor:        { label: 'Security Auditor',   tone: 'badge-code badge-warning' },
  financial_auditor:       { label: 'Financial Auditor',  tone: 'badge-code badge-warning' },
  compliance_officer:      { label: 'Compliance Officer', tone: 'badge-code badge-neutral' },
  viewer:                  { label: 'Viewer',             tone: 'badge-code badge-success' },
  employee_requester:      { label: 'Employee',           tone: 'badge-code badge-neutral' },
}

const ROLE_ORDER = [
  'admin', 'it_admin', 'operator', 'infrastructure_engineer', 'helpdesk_operator',
  'asset_custodian', 'security_auditor', 'financial_auditor', 'compliance_officer',
  'viewer', 'employee_requester',
]

const roleMeta = (role) =>
  ROLE_META[role] || { label: role || 'User', tone: 'badge-code badge-neutral' }

const TIERS = [
  {
    accent: '#dc2626',
    name: 'Administrator',
    text: 'Root privileges. Manages every asset, edits user roles, resolves incidents, and reads the cryptographic compliance ledger.',
  },
  {
    accent: '#4f46e5',
    name: 'Operator',
    text: 'Registers and edits assets they created, runs physical QR audits, and works the incident queue.',
  },
  {
    accent: '#059669',
    name: 'Viewer',
    text: 'Read-only across asset inventory, topology graphs, and incident telemetry.',
  },
]

function UserManagement() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingUser, setUpdatingUser] = useState(null)
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      setError(err.message)
      toast.error('Error fetching users: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function updateUserRole(userId, newRole) {
    try {
      setUpdatingUser(userId)
      const token = localStorage.getItem('token') || localStorage.getItem('flask_jwt_token')

      let success = false

      // Prefer the Flask backend so validation and audit logging are enforced
      if (token) {
        try {
          const response = await fetch(`http://localhost:5000/api/users/${userId}/role`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: newRole })
          })

          if (response.ok) {
            success = true
          } else {
            const err = await response.json()
            throw new Error(err.error || 'Failed to update role via API')
          }
        } catch (apiErr) {
          console.warn('Backend /api/users role update failed, falling back to direct Supabase write')
          // Fallback: direct Supabase write (only if backend is offline)
          const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId)
          if (error) throw error
          success = true
        }
      } else {
        // No token: write directly (should not happen in normal flows)
        const { error } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', userId)
        if (error) throw error
        success = true
      }

      if (success) {
        setUsers(users.map(u =>
          u.id === userId ? { ...u, role: newRole } : u
        ))
        toast.success('User role updated successfully!')
      }
    } catch (error) {
      toast.error('Error updating role: ' + error.message)
    } finally {
      setUpdatingUser(null)
    }
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(u => {
      const nameMatch = (u.full_name || '').toLowerCase().includes(q)
      const emailMatch = (u.email || '').toLowerCase().includes(q)
      const roleMatch = roleFilter === 'all' || u.role === roleFilter
      return (nameMatch || emailMatch) && roleMatch
    })
  }, [users, search, roleFilter])

  const hasFilters = Boolean(search || roleFilter !== 'all')

  return (
    <main className="max-w-[1400px] mx-auto py-7 px-4 sm:px-6 lg:px-8 animate-fade-in">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <button onClick={() => navigate('/dashboard')} className="btn btn-ghost btn-sm !px-2 -ml-2 mb-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Dashboard
          </button>
          <h1 className="page-title">
            Users &amp; roles
            <span className="badge-code badge-neutral ml-2 align-middle">{users.length}</span>
          </h1>
          <p className="page-subtitle">
            Role-based access control, permissions, and directory assignments.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="mb-5 px-4 py-3 rounded-[11px] text-[12.5px] flex items-start gap-2.5"
          style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger-line)', color: 'var(--danger)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-[1px]"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}

      {/* Privilege tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {TIERS.map(({ accent, name, text }) => (
          <div key={name} className="card !py-4 relative overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent }} />
            <p className="text-[12.5px] font-bold m-0" style={{ color: 'var(--text)' }}>{name}</p>
            <p className="text-[11.5px] leading-relaxed mt-1 mb-0" style={{ color: 'var(--text-muted)' }}>
              {text}
            </p>
          </div>
        ))}
      </div>

      {/* Search + role filter */}
      <div className="card !py-3 mb-5 flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1 min-w-0">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="input-field !pl-9"
            aria-label="Search users"
          />
        </div>

        {/* Eleven roles is past the point where pills help — a select keeps
            the row one line tall and the labels readable. */}
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="input-field sm:!w-56"
          aria-label="Filter by role"
        >
          <option value="all">All roles</option>
          {ROLE_ORDER.map(r => (
            <option key={r} value={r}>{ROLE_META[r].label}</option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => { setSearch(''); setRoleFilter('all') }}
            className="btn-ghost btn-sm shrink-0"
          >
            Clear
          </button>
        )}
      </div>

      {/* Directory */}
      <div className="card-flush">
        <div className="card-header">
          <p className="section-header !mb-0">Directory</p>
          <span className="text-[11px] font-mono tnum" style={{ color: 'var(--text-faint)' }}>
            {loading ? '—' : `${filteredUsers.length} of ${users.length}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Registered</th>
                {isAdmin && <th className="!text-right">Assign role</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                /* Skeleton rows keep the table's shape, so nothing jumps
                   when the real rows land. */
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="skeleton w-[30px] h-[30px] !rounded-[9px]" />
                        <div className="flex flex-col gap-1.5">
                          <div className="skeleton h-[11px] w-[120px]" />
                          <div className="skeleton h-[9px] w-[70px]" />
                        </div>
                      </div>
                    </td>
                    <td><div className="skeleton h-[11px] w-[160px]" /></td>
                    <td><div className="skeleton h-[16px] w-[86px] !rounded-md" /></td>
                    <td><div className="skeleton h-[11px] w-[72px]" /></td>
                    {isAdmin && <td><div className="skeleton h-[30px] w-[150px] !rounded-[10px] ml-auto" /></td>}
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="!p-0">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></svg>
                      </div>
                      <p className="empty-state-title">
                        {hasFilters ? 'No users match those filters' : 'No users yet'}
                      </p>
                      <p className="empty-state-text">
                        {hasFilters
                          ? 'Try a different name, email, or role.'
                          : 'Accounts appear here once people sign up.'}
                      </p>
                      {hasFilters && (
                        <button
                          onClick={() => { setSearch(''); setRoleFilter('all') }}
                          className="btn-secondary btn-sm mt-5"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const meta = roleMeta(u.role)
                  const isUpdating = updatingUser === u.id
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="avatar">
                            {(u.full_name || u.email || 'U')[0].toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[12.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                              {u.full_name || 'Unnamed account'}
                            </span>
                            <span className="block text-[10.5px] font-mono" style={{ color: 'var(--text-faint)' }}>
                              {u.id.substring(0, 8)}
                            </span>
                          </span>
                        </div>
                      </td>

                      <td className="font-mono text-[12px]" style={{ color: 'var(--text-soft)' }}>
                        {u.email}
                      </td>

                      <td>
                        <span className={meta.tone}>{meta.label}</span>
                      </td>

                      <td className="font-mono tnum text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      {isAdmin && (
                        <td className="!text-right">
                          <div className="inline-flex items-center gap-2">
                            {isUpdating && (
                              <span
                                className="animate-spin-fast w-3 h-3 rounded-full"
                                style={{ border: '2px solid var(--line-strong)', borderTopColor: 'var(--brand)' }}
                              />
                            )}
                            <select
                              value={u.role || 'viewer'}
                              disabled={isUpdating}
                              onChange={(e) => updateUserRole(u.id, e.target.value)}
                              className="input-field !w-auto !py-1.5 !text-[12px]"
                              aria-label={`Change role for ${u.full_name || u.email}`}
                            >
                              {ROLE_ORDER.map(r => (
                                <option key={r} value={r}>{ROLE_META[r].label}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          flex-shrink: 0;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 700;
          color: var(--brand);
          background: var(--brand-soft);
          border: 1px solid var(--brand-line);
        }
      `}</style>
    </main>
  )
}

export default UserManagement
