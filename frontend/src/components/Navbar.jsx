import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, profile, isAdmin, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return {
          label: 'Admin',
          icon: '👑',
          classes: 'bg-red-100 text-red-800 border-red-200'
        }
      case 'operator':
        return {
          label: 'Operator',
          icon: '⚙️',
          classes: 'bg-blue-100 text-blue-800 border-blue-200'
        }
      case 'viewer':
        return {
          label: 'Viewer',
          icon: '👁️',
          classes: 'bg-emerald-100 text-emerald-800 border-emerald-200'
        }
      default:
        return {
          label: 'User',
          icon: '👤',
          classes: 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }
  }

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const roleInfo = getRoleBadge(profile?.role)

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Primary Nav Links */}
          <div className="flex items-center space-x-8">
            <Link to="/dashboard" className="flex items-center space-x-3 group">
              <img src="/favicon.svg" alt="ITIMS Logo" className="w-9 h-9 rounded-xl shadow-sm group-hover:scale-105 transition-transform" />
              <div className="flex flex-col">
                <span className="font-space text-xl font-bold tracking-[0.18em] text-gray-900 leading-none group-hover:text-primary-600 transition-colors">
                  ITIMS
                </span>
                <span className="font-space text-[9px] font-medium tracking-[0.14em] text-gray-500 uppercase leading-tight mt-1">
                  IT Infrastructure Management
                </span>
              </div>
            </Link>

            <div className="hidden md:flex items-center space-x-1">
              <Link
                to="/dashboard"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/dashboard')
                    ? 'text-primary-700 bg-primary-50 font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/assets"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/assets')
                    ? 'text-primary-700 bg-primary-50 font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Assets
              </Link>
              <Link
                to="/incidents"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/incidents'
                    ? 'text-primary-700 bg-primary-50 font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Incidents
              </Link>
              <Link
                to="/incidents/report"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/incidents/report'
                    ? 'text-primary-700 bg-primary-50 font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Report Incident
              </Link>
              <Link
                to="/audit-ledger"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/audit-ledger')
                    ? 'text-purple-700 bg-purple-50 font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                🔒 Audit Ledger
              </Link>
              {isAdmin && (
                <Link
                  to="/users"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    isActive('/users')
                      ? 'text-red-700 bg-red-50 border-red-200 font-semibold'
                      : 'text-red-600 hover:bg-red-50 border-transparent'
                  }`}
                >
                  👑 User Management
                </Link>
              )}
            </div>
          </div>

          {/* Right Side: Profile & Logout */}
          <div className="flex items-center space-x-3">
            {profile && (
              <div className="hidden sm:flex items-center space-x-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleInfo.classes}`}>
                  <span className="mr-1">{roleInfo.icon}</span>
                  {roleInfo.label}
                </span>
                <span className="text-xs font-medium text-gray-700 max-w-[160px] truncate" title={user?.email}>
                  {profile?.full_name || user?.email}
                </span>
              </div>
            )}
            
            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 hover:text-red-600 transition-colors shadow-sm cursor-pointer"
              title="Sign out of ITIMS"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
