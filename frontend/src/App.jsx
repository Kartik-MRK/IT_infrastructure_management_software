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
import CryptographicLedger from './pages/Audit/CryptographicLedger'

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
        <Route path="/audit-ledger" element={<CryptographicLedger />} />
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
          gutter={10}
          toastOptions={{
            duration: 3000,
            className: 'app-toast',
            style: {
              // Light surface, not a black slab — a toast is an aside, not an alert
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 500,
              padding: '10px 14px',
              maxWidth: '380px',
              boxShadow: '0 4px 10px rgba(15,23,42,0.06), 0 14px 34px rgba(15,23,42,0.10)',
            },
            success: {
              duration: 3000,
              iconTheme: { primary: '#059669', secondary: '#fff' },
            },
            error: {
              duration: 4500,
              iconTheme: { primary: '#dc2626', secondary: '#fff' },
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}

export default App
