import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from './Navbar'

export default function AppLayout() {
  const { session, loading } = useAuth()

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Persistent Top Navbar — Stays mounted across all tab changes */}
      <Navbar />
      
      {/* Dynamic Page Content */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}
