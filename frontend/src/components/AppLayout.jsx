import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from './Navbar'

export default function AppLayout() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3"
           style={{ background: 'var(--bg)' }}>
        {/* Faster than a 1s spin — a quicker spinner makes the load feel shorter
            even when the wait is identical. */}
        <div
          className="w-7 h-7 rounded-full animate-spin-fast"
          style={{
            border: '2.5px solid var(--line)',
            borderTopColor: 'var(--brand)',
          }}
        />
        <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading workspace</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Persistent top nav — stays mounted across all tab changes */}
      <Navbar />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}
