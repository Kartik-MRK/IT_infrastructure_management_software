import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/AppLayout'
import AdminRoute from './components/AdminRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UserManagement from './pages/UserManagement'
import AssetList from './pages/Asset/List'
import AssetForm from './pages/Asset/Form'
import AssetDetail from './pages/Asset/Details'
import IncidentReport from './pages/Incident/Report'
import IncidentList from './pages/Incident/List'
import ResetPassword from './pages/ResetPassword'

function AppRoutes() {
  const { session, isPasswordRecovery } = useAuth()

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={session && !isPasswordRecovery ? <Navigate to="/dashboard" replace /> : <Login />} 
      />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected Routes inside Persistent AppLayout */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route 
          path="/users" 
          element={
            <AdminRoute>
              <UserManagement />
            </AdminRoute>
          } 
        />
        <Route path="/assets" element={<AssetList />} />
        <Route path="/assets/new" element={<AssetForm />} />
        <Route path="/assets/:id" element={<AssetDetail />} />
        <Route path="/assets/:id/edit" element={<AssetForm />} />
        <Route path="/incidents" element={<IncidentList />} />
        <Route path="/incidents/report" element={<IncidentReport />} />
      </Route>

      {/* Root Catch-All Route */}
      <Route 
        path="/" 
        element={<Navigate to={session && !isPasswordRecovery ? "/dashboard" : "/login"} replace />} 
      />
      <Route 
        path="*" 
        element={<Navigate to={session && !isPasswordRecovery ? "/dashboard" : "/login"} replace />} 
      />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1f2937',
              color: '#fff',
              borderRadius: '0.5rem',
              fontSize: '0.875rem'
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
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}

export default App
