import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { useEffect } from 'react'

export default function AdminRoute({ children }) {
  const { session, isAdmin, loading } = useAuth()

  useEffect(() => {
    if (!loading && session && !isAdmin) {
      toast.error('Access Denied: Administrator privileges required.')
    }
  }, [loading, session, isAdmin])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
