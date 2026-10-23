import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Load cached profile from localStorage for instantaneous 0ms initialization
  const [profile, setProfile] = useState(() => {
    try {
      const cached = localStorage.getItem('itims_user_profile')
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })
  
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  function syncTokens(accessToken) {
    if (accessToken) {
      localStorage.setItem('token', accessToken)
      localStorage.setItem('flask_jwt_token', accessToken)
    }
  }

  function clearTokens() {
    localStorage.removeItem('token')
    localStorage.removeItem('flask_jwt_token')
    localStorage.removeItem('itims_user_profile')
  }

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, department:department_id(id, name, code)')
        .eq('id', userId)
        .single()

      if (!error && data) {
        setProfile(data)
        localStorage.setItem('itims_user_profile', JSON.stringify(data))
      } else {
        const fallback = { id: userId, role: 'viewer', full_name: user?.email || 'User' }
        setProfile(fallback)
        localStorage.setItem('itims_user_profile', JSON.stringify(fallback))
      }
    } catch (err) {
      console.error('Error loading user profile:', err)
      const fallback = { id: userId, role: 'viewer', full_name: user?.email || 'User' }
      setProfile(fallback)
      localStorage.setItem('itims_user_profile', JSON.stringify(fallback))
    }
  }, [user?.email])

  useEffect(() => {
    let isMounted = true

    async function initAuth() {
      try {
        const cachedGuest = localStorage.getItem('itims_guest_session')
        if (cachedGuest) {
          const parsed = JSON.parse(cachedGuest)
          setSession(parsed)
          setUser(parsed.user)
          const cachedProfile = localStorage.getItem('itims_user_profile')
          if (cachedProfile) setProfile(JSON.parse(cachedProfile))
          setLoading(false)
          return
        }

        const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
        if (!isMounted) return

        setSession(session)
        setUser(session?.user || null)

        if (session?.user) {
          syncTokens(session.access_token)
          // Non-blocking background fetch
          fetchProfile(session.user.id)
        }
      } catch (err) {
        console.warn('Auth initialization fallback:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return

      setSession(session)
      setUser(session?.user || null)

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
      } else if (event === 'SIGNED_OUT' || !session) {
        setIsPasswordRecovery(false)
        clearTokens()
        setProfile(null)
        localStorage.removeItem('itims_user_profile')
      } else if (session?.user) {
        syncTokens(session.access_token)
        fetchProfile(session.user.id)
      }
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  async function refreshProfile() {
    if (user?.id) {
      await fetchProfile(user.id)
    }
  }

  function loginAsGuest() {
    const guestUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'guest.viewer@itims.local',
      user_metadata: { full_name: 'Guest Viewer' },
      aud: 'authenticated',
      role: 'authenticated'
    }
    const guestProfile = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'guest.viewer@itims.local',
      full_name: 'Guest Viewer',
      role: 'viewer',
      department: { id: 'demo-dept', name: 'Operations', code: 'OPS' }
    }
    const guestSession = {
      access_token: 'demo-guest-jwt-token',
      user: guestUser,
      expires_at: Math.floor(Date.now() / 1000) + 86400
    }
    setUser(guestUser)
    setProfile(guestProfile)
    setSession(guestSession)
    syncTokens('demo-guest-jwt-token')
    localStorage.setItem('itims_user_profile', JSON.stringify(guestProfile))
    localStorage.setItem('itims_guest_session', JSON.stringify(guestSession))
  }

  async function logout() {
    try {
      setIsPasswordRecovery(false)
      clearTokens()
      localStorage.removeItem('itims_guest_session')
      setProfile(null)
      setUser(null)
      setSession(null)
      await supabase.auth.signOut().catch(() => {})
      toast.success('Logged out successfully')
    } catch (err) {
      console.error('Error during logout:', err)
    }
  }

  // Enterprise RBAC role sets — kept in sync with backend VALID_ROLES and ROLE_ALIASES
  const ADMIN_ROLES = new Set(['admin', 'it_admin'])
  const OPERATOR_ROLES = new Set([
    'admin', 'it_admin', 'operator', 'infrastructure_engineer',
    'helpdesk_operator', 'asset_custodian', 'security_auditor',
    'financial_auditor', 'technician'
  ])
  const VIEWER_ROLES = new Set([
    'admin', 'it_admin', 'operator', 'infrastructure_engineer',
    'helpdesk_operator', 'asset_custodian', 'security_auditor',
    'financial_auditor', 'technician', 'compliance_officer',
    'viewer', 'employee_requester'
  ])

  const userRole = profile?.role || 'viewer'

  const value = {
    session,
    user,
    profile,
    userProfile: profile,
    role: userRole,
    isAdmin: ADMIN_ROLES.has(userRole),
    isOperator: OPERATOR_ROLES.has(userRole),
    isViewer: VIEWER_ROLES.has(userRole),
    isPasswordRecovery,
    setIsPasswordRecovery,
    loading,
    logout,
    refreshProfile,
    loginAsGuest
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
