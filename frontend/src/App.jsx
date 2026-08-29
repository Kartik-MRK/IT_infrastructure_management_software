import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UserManagement from './pages/UserManagement'
import { supabase } from './lib/supabase'
import AssetList from './pages/Asset/List'
import AssetForm from './pages/Asset/Form'
import AssetDetail from './pages/Asset/Details'
import IncidentReport from './pages/Incident/Report'
import IncidentList from './pages/Incident/List'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <Router>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Routes>
        <Route 
          path="/login" 
          element={session ? <Navigate to="/dashboard" /> : <Login />} 
        />
        <Route 
          path="/dashboard" 
          element={session ? <Dashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/users" 
          element={session ? <UserManagement /> : <Navigate to="/login" />} 
        />
                <Route 
          path="/assets" 
          element={session ? <AssetList /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/assets/new" 
          element={session ? <AssetForm /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/assets/:id" 
          element={session ? <AssetDetail /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/assets/:id/edit" 
          element={session ? <AssetForm /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/incidents/report" 
          element={session ? <IncidentReport /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/incidents" 
          element={session ? <IncidentList /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/" 
          element={<Navigate to={session ? "/dashboard" : "/login"} />} 
        />
      </Routes>
    </Router>
  )
}

export default App
