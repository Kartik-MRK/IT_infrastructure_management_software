import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { useEffect } from 'react'

export default function AdminRoute({ children }) {
  const { session, isAdmin, loading } = useAuth()

  useEffect(() => {
    if (!loading && session && !isAdmin) {
      toast.error('Administrator privileges are required for that page.')
    }
  }, [loading, session, isAdmin])

  if (loading) {
    return (
      /* A faster spinner makes the same wait feel shorter, and the label
         says what is being waited on rather than leaving a bare ring. */
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ background: 'var(--bg)' }}
      >
        <span
          className="animate-spin-fast rounded-full"
          style={{ width: 26, height: 26, border: '2px solid var(--line-strong)', borderTopColor: 'var(--brand)' }}
        />
        <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
          Checking permissions…
        </span>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
