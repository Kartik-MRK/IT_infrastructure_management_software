import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import './UserManagement.css'

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
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ))

      toast.success('User role updated successfully!')
    } catch (error) {
      toast.error('Error updating role: ' + error.message)
    } finally {
      setUpdatingUser(null)
    }
  }

  const filteredUsers = users.filter(u => {
    const nameMatch = (u.full_name || '').toLowerCase().includes(search.toLowerCase())
    const emailMatch = (u.email || '').toLowerCase().includes(search.toLowerCase())
    const roleMatch = roleFilter === 'all' || u.role === roleFilter
    return (nameMatch || emailMatch) && roleMatch
  })

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return {
          icon: '👑',
          label: 'Admin',
          class: 'bg-rose-500/10 text-rose-600 border-rose-500/30'
        }
      case 'operator':
        return {
          icon: '⚙️',
          label: 'Operator',
          class: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30'
        }
      case 'viewer':
        return {
          icon: '👁️',
          label: 'Viewer',
          class: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
        }
      default:
        return {
          icon: '👤',
          label: role || 'User',
          class: 'bg-slate-500/10 text-slate-600 border-slate-500/30'
        }
    }
  }

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 font-space animate-fade-in space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1.5 cursor-pointer mb-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span>👥</span> Enterprise User & Role Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage enterprise role-based access control (RBAC), user permissions, and directory assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-purple-600/10 text-purple-600 dark:text-purple-300 border border-purple-500/30 rounded-xl text-xs font-mono font-bold">
            {users.length} Registered Accounts
          </span>
        </div>
      </div>

      {/* Role Definitions & Permissions Legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card !p-4 border-l-4 border-l-rose-500 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">👑</span>
            <h3 className="text-xs font-bold uppercase text-slate-900 dark:text-white tracking-wider">
              Administrator (Admin)
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Full root privileges. Can manage all assets, edit user roles, resolve incidents, and view cryptographic compliance certificates.
          </p>
        </div>

        <div className="card !p-4 border-l-4 border-l-indigo-500 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⚙️</span>
            <h3 className="text-xs font-bold uppercase text-slate-900 dark:text-white tracking-wider">
              Operator
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Can register and edit their created assets, conduct physical QR audits, and manage incidents.
          </p>
        </div>

        <div className="card !p-4 border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">👁️</span>
            <h3 className="text-xs font-bold uppercase text-slate-900 dark:text-white tracking-wider">
              Viewer
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Read-only access across asset inventory, topology graphs, and incident telemetry.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card !p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-96 relative">
          <span className="absolute left-3.5 top-2.5 text-slate-400 text-xs">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by full name or email address..."
            className="input-field pl-8"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 font-bold hidden sm:inline">Role:</span>
          {['all', 'admin', 'operator', 'viewer'].map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                roleFilter === r
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* User Management Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                <th className="px-6 py-3.5">User Profile</th>
                <th className="px-6 py-3.5">Email Address</th>
                <th className="px-6 py-3.5">Current Role</th>
                <th className="px-6 py-3.5">Registered Date</th>
                {isAdmin && <th className="px-6 py-3.5 text-right">Assign RBAC Role</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <span className="animate-spin inline-block mr-2">⏳</span> Loading enterprise user directory...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    No users found matching your search query.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const badge = getRoleBadge(u.role)
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      
                      {/* Name & Avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                            {(u.full_name || u.email || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {u.full_name || 'Unnamed Account'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {u.id.substring(0, 8)}...</span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">
                        {u.email}
                      </td>

                      {/* Role Badge */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase border ${badge.class}`}>
                          <span>{badge.icon}</span>
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Created At */}
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      {/* RBAC Role Selector */}
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <select
                            value={u.role || 'viewer'}
                            disabled={updatingUser === u.id}
                            onChange={(e) => updateUserRole(u.id, e.target.value)}
                            className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer focus:ring-2 focus:ring-purple-500 outline-none"
                          >
                            <option value="admin">👑 Admin</option>
                            <option value="operator">⚙️ Operator</option>
                            <option value="viewer">👁️ Viewer</option>
                          </select>
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

    </main>
  )
}

export default UserManagement
