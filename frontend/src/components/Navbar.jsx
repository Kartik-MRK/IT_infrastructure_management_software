import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ── Minimal inline SVG icons (no emoji, no external dep) ──────────────────────
const Icons = {
  grid:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  server: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>,
  alert:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  users:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  lock:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  plus:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  logout: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
}

const ROLE_CONFIG = {
  admin:                  { label: 'Admin',           dot: '#dc2626' },
  it_admin:               { label: 'IT Admin',        dot: '#dc2626' },
  operator:               { label: 'Operator',        dot: '#4f46e5' },
  infrastructure_engineer:{ label: 'Infra Eng.',      dot: '#4f46e5' },
  helpdesk_operator:      { label: 'Helpdesk',        dot: '#7c3aed' },
  asset_custodian:        { label: 'Custodian',       dot: '#9333ea' },
  security_auditor:       { label: 'Sec. Auditor',    dot: '#d97706' },
  financial_auditor:      { label: 'Fin. Auditor',    dot: '#059669' },
  compliance_officer:     { label: 'Compliance',      dot: '#0d9488' },
  employee_requester:     { label: 'Employee',        dot: '#8a94a6' },
  viewer:                 { label: 'Viewer',          dot: '#8a94a6' },
}

export default function Navbar() {
  const { user, profile, isAdmin, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/'
    if (path === '/incidents') return location.pathname.startsWith('/incidents') && location.pathname !== '/incidents/report'
    return location.pathname.startsWith(path)
  }

  const roleConf = ROLE_CONFIG[profile?.role] ?? { label: profile?.role ?? 'User', dot: '#8a94a6' }
  const initials = (profile?.full_name || user?.email || 'U').slice(0, 2).toUpperCase()

  const navLinks = [
    { to: '/dashboard',    label: 'Dashboard', icon: Icons.grid   },
    { to: '/assets',       label: 'Assets',    icon: Icons.server },
    { to: '/incidents',    label: 'Incidents', icon: Icons.alert  },
    { to: '/audit-ledger', label: 'Audit',     icon: Icons.lock   },
  ]

  return (
    <nav
      className="sticky top-0 z-40"
      style={{
        background: 'rgba(255,255,255,0.86)',
        WebkitBackdropFilter: 'saturate(180%) blur(12px)',
        backdropFilter: 'saturate(180%) blur(12px)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">

          {/* Logo + primary nav */}
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0 nav-logo">
              <img src="/favicon.svg" alt="" className="w-[30px] h-[30px] rounded-lg" />
              <div className="flex flex-col leading-none">
                <span className="font-display text-[15px] font-bold tracking-[0.15em] text-[color:var(--text)]">
                  ITIMS
                </span>
                <span className="text-[9px] font-medium tracking-[0.09em] uppercase text-[color:var(--text-faint)] mt-[2px]">
                  Infrastructure Mgmt
                </span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-0.5">
              {navLinks.map(({ to, label, icon }) => {
                const active = isActive(to)
                return (
                  <Link key={to} to={to} className="nav-link" data-active={active}>
                    <span style={{ opacity: active ? 1 : 0.55 }}>{icon}</span>
                    {label}
                  </Link>
                )
              })}

              {isAdmin && (
                <Link to="/users" className="nav-link nav-link-admin" data-active={isActive('/users')}>
                  <span style={{ opacity: isActive('/users') ? 1 : 0.6 }}>{Icons.users}</span>
                  Users
                </Link>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2.5">
            <Link to="/incidents/report" className="btn btn-report">
              {Icons.plus}
              <span className="hidden sm:inline">Report</span>
            </Link>

            {profile && (
              <div className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full"
                   style={{ background: 'var(--surface-sunk)', border: '1px solid var(--line)' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
                     style={{ background: 'var(--brand)' }}>
                  {initials}
                </div>
                <div className="hidden sm:flex flex-col leading-none gap-[3px]">
                  <span
                    className="text-[12px] font-semibold text-[color:var(--text)] max-w-[120px] truncate"
                    title={profile?.full_name || user?.email}
                  >
                    {profile?.full_name?.split(' ')[0] || user?.email}
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-[color:var(--text-muted)]">
                    <span className="status-dot w-[5px] h-[5px]" style={{ background: roleConf.dot }} />
                    {roleConf.label}
                  </span>
                </div>
              </div>
            )}

            <button onClick={handleLogout} title="Sign out" className="btn btn-signout">
              {Icons.logout}
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hover states live in CSS so they can be gated behind a pointer query
          and paired with :active — a JS onMouseEnter handler can do neither. */}
      <style>{`
        .nav-logo img {
          transition: transform var(--t-press) var(--ease-out);
        }
        .nav-logo:active img { transform: scale(0.94); }
        @media (hover: hover) and (pointer: fine) {
          .nav-logo:hover img { transform: scale(1.05); }
        }

        .nav-link-admin { color: #dc2626; }
        @media (hover: hover) and (pointer: fine) {
          .nav-link-admin:hover { color: #b91c1c; background-color: var(--danger-soft); }
        }
        .nav-link-admin[data-active='true'] {
          color: #dc2626;
          background-color: var(--danger-soft);
        }

        .btn-report {
          padding: 6px 12px;
          color: var(--danger);
          background: var(--danger-soft);
          border-color: var(--danger-line);
          text-decoration: none;
        }
        @media (hover: hover) and (pointer: fine) {
          .btn-report:hover { background: var(--danger); border-color: var(--danger); color: #fff; }
        }

        .btn-signout {
          padding: 6px 12px;
          font-weight: 500;
          color: var(--text-muted);
          background: transparent;
          border-color: var(--line);
        }
        @media (hover: hover) and (pointer: fine) {
          .btn-signout:hover { color: var(--danger); border-color: var(--danger-line); background: var(--danger-soft); }
        }
      `}</style>
    </nav>
  )
}
