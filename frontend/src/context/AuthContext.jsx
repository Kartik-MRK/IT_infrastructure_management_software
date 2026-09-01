import { createContext, useContext, useState, useEffect } from 'react'
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

  useEffect(() => {
    let isMounted = true

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!isMounted) return

        setSession(session)
        setUser(session?.user || null)

        if (session?.user) {
          syncTokens(session.access_token)
          // Non-blocking background fetch
          fetchProfile(session.user.id)
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
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
  }, [])

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

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
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
  }

  async function refreshProfile() {
    if (user?.id) {
      await fetchProfile(user.id)
    }
  }

  async function logout() {
    try {
      setIsPasswordRecovery(false)
      clearTokens()
      setProfile(null)
      setUser(null)
      setSession(null)
      await supabase.auth.signOut()
      toast.success('Logged out successfully')
    } catch (err) {
      console.error('Error during logout:', err)
    }
  }

  const value = {
    session,
    user,
    profile,
    userProfile: profile,
    role: profile?.role || 'viewer',
    isAdmin: profile?.role === 'admin',
    isOperator: profile?.role === 'operator',
    isViewer: profile?.role === 'viewer',
    isPasswordRecovery,
    setIsPasswordRecovery,
    loading,
    logout,
    refreshProfile
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
