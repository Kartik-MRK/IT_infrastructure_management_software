import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * This route exists only to catch old magic-link reset emails.
 * The new flow uses OTP codes entered directly in the login page.
 * Any session that lands here is immediately signed out and the user
 * is redirected to /login with an informational message.
 */
function ResetPassword() {
  const navigate = useNavigate()

  useEffect(() => {
    // Sign out any session that came in via the old magic link
    supabase.auth.signOut().finally(() => {
      // Small delay so the user sees the message
      setTimeout(() => navigate('/login'), 3000)
    })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-10 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-3">Link No Longer Valid</h2>
        <p className="text-gray-600 mb-2">
          This password reset link is from an older email and is no longer used.
        </p>
        <p className="text-gray-600 mb-6">
          To reset your password, use the <strong>Forgot password?</strong> link on the sign-in page
          — you'll receive a <strong>6-digit code</strong> by email instead.
        </p>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-3"></div>
        <p className="text-sm text-gray-400">Redirecting to sign in...</p>
      </div>
    </div>
  )
}

export default ResetPassword
