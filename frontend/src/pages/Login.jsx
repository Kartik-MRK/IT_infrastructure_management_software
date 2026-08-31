import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import './Login.css'

// ─── OTP Input — 6 individual digit boxes ────────────────────────────────────
function OtpInput({ value, onChange }) {
  const inputs = useRef([])

  const handleChange = (index, e) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1) // digits only, 1 char
    const newOtp = (value || '      ').split('')
    newOtp[index] = val || ' '
    const joined = newOtp.join('').padEnd(6, ' ')
    onChange(joined)
    // Auto-advance to next input
    if (val && index < 5) inputs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      const currentVal = (value?.[index] || '').trim()
      if (!currentVal && index > 0) {
        // Move back and clear previous
        const newOtp = (value || '      ').split('')
        newOtp[index - 1] = ' '
        onChange(newOtp.join('').padEnd(6, ' '))
        inputs.current[index - 1]?.focus()
      } else {
        const newOtp = (value || '      ').split('')
        newOtp[index] = ' '
        onChange(newOtp.join('').padEnd(6, ' '))
      }
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted.padEnd(6, ' '))
    // Focus last filled box
    const focusIdx = Math.min(pasted.length, 5)
    inputs.current[focusIdx]?.focus()
  }

  return (
    <div className="flex gap-2 sm:gap-3 justify-center my-6">
      {Array.from({ length: 6 }).map((_, i) => {
        const char = (value?.[i] || '').trim()
        return (
          <input
            key={i}
            ref={(el) => (inputs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={char}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            autoFocus={i === 0}
            className="w-11 h-14 sm:w-12 sm:h-14 text-center text-2xl font-bold border-2 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
            style={{
              borderColor: char ? '#4f46e5' : '#d1d5db',
              background: char ? '#eef2ff' : '#fff',
            }}
          />
        )
      })}
    </div>
  )
}

// ─── Shared branding sidebar ─────────────────────────────────────────────────
function Sidebar({ icon, title, subtitle }) {
  return (
    <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 p-12 flex-col justify-between">
      <div>
        <h1 className="text-white text-4xl font-bold mb-4">ITIMS</h1>
        <p className="text-primary-100 text-lg">IT Infrastructure Management System</p>
      </div>
      <div className="space-y-8">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg mb-1">{title}</h3>
            <p className="text-primary-100">{subtitle}</p>
          </div>
        </div>
      </div>
      <p className="text-primary-200 text-sm">© 2025 ITIMS. Built by Git Souls Team.</p>
    </div>
  )
}

// ─── Error banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center">
        <svg className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-red-700">{message}</p>
      </div>
    </div>
  )
}

// ─── Spinner button content ───────────────────────────────────────────────────
function SpinnerLabel({ loading, label, loadingLabel }) {
  if (!loading) return label
  return (
    <span className="flex items-center justify-center">
      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      {loadingLabel}
    </span>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
function Login() {
  // ─── Login / Sign-up state ─────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState('prefer_not_to_say')
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSignUp, setIsSignUp] = useState(false)

  // ─── Sign Up OTP verification state ────────────────────────────────────────
  // signUpStep: null | 'otp' | 'done'
  const [signUpStep, setSignUpStep] = useState(null)
  const [signUpOtp, setSignUpOtp] = useState('      ')
  const [signUpLoading, setSignUpLoading] = useState(false)
  const [signUpResendLoading, setSignUpResendLoading] = useState(false)
  const [signUpResendSuccess, setSignUpResendSuccess] = useState(false)
  const [signUpError, setSignUpError] = useState(null)
  const [registeredEmail, setRegisteredEmail] = useState('')

  // ─── Forgot password state (3-step wizard) ────────────────────────────────
  // fpStep: null | 'email' | 'otp' | 'newPassword' | 'done'
  const [fpStep, setFpStep] = useState(null)
  const [fpEmail, setFpEmail] = useState('')
  const [fpOtp, setFpOtp] = useState('      ') // 6 chars
  const [fpLoading, setFpLoading] = useState(false)
  const [fpError, setFpError] = useState(null)
  const [fpNewPassword, setFpNewPassword] = useState('')
  const [fpConfirmPassword, setFpConfirmPassword] = useState('')
  const [fpShowPassword, setFpShowPassword] = useState(false)
  const [fpShowConfirmPassword, setFpShowConfirmPassword] = useState(false)
  const [fpSession, setFpSession] = useState(null)

  const resetFp = () => {
    setFpStep(null)
    setFpEmail('')
    setFpOtp('      ')
    setFpLoading(false)
    setFpError(null)
    setFpNewPassword('')
    setFpConfirmPassword('')
    setFpShowPassword(false)
    setFpShowConfirmPassword(false)
    setFpSession(null)
  }

  const resetSignUpFlow = () => {
    setSignUpStep(null)
    setSignUpOtp('      ')
    setSignUpLoading(false)
    setSignUpResendLoading(false)
    setSignUpResendSuccess(false)
    setSignUpError(null)
  }

  // ─── Forgot Password Step 1: send OTP ─────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault()
    setFpLoading(true)
    setFpError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(fpEmail)
      if (error) throw error
      setFpStep('otp')
    } catch (err) {
      setFpError(err.message)
    } finally {
      setFpLoading(false)
    }
  }

  // ─── Forgot Password Step 2: verify OTP ───────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    const code = fpOtp.trim()
    if (code.length !== 6) {
      setFpError('Please enter the full 6-digit code.')
      return
    }
    setFpLoading(true)
    setFpError(null)
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: fpEmail,
        token: code,
        type: 'recovery',
      })
      if (error) throw error
      setFpSession(data.session)
      setFpStep('newPassword')
    } catch (err) {
      setFpError(err.message === 'Token has expired or is invalid'
        ? 'The code is invalid or has expired. Please request a new one.'
        : err.message)
    } finally {
      setFpLoading(false)
    }
  }

  // ─── Forgot Password Step 3: update password ──────────────────────────────
  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (fpNewPassword !== fpConfirmPassword) {
      setFpError('Passwords do not match.')
      return
    }
    if (fpNewPassword.length < 6) {
      setFpError('Password must be at least 6 characters.')
      return
    }
    setFpLoading(true)
    setFpError(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: fpNewPassword })
      if (error) throw error
      await supabase.auth.signOut()
      setFpStep('done')
    } catch (err) {
      setFpError(err.message)
    } finally {
      setFpLoading(false)
    }
  }

  // ─── Sign Up OTP Step: Verify signup code ──────────────────────────────────
  const handleVerifySignUpOtp = async (e) => {
    e.preventDefault()
    const code = signUpOtp.trim()
    if (code.length !== 6) {
      setSignUpError('Please enter the full 6-digit verification code.')
      return
    }

    setSignUpLoading(true)
    setSignUpError(null)

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: registeredEmail,
        token: code,
        type: 'signup'
      })

      if (error) throw error

      // Sign out temporary session so user cleanly signs in
      await supabase.auth.signOut()

      setSignUpStep('done')
    } catch (err) {
      setSignUpError(
        err.message === 'Token has expired or is invalid'
          ? 'The verification code is invalid or has expired. Please request a new one.'
          : err.message
      )
    } finally {
      setSignUpLoading(false)
    }
  }

  // ─── Sign Up OTP Step: Resend code ─────────────────────────────────────────
  const handleResendSignUpOtp = async () => {
    setSignUpResendLoading(true)
    setSignUpError(null)
    setSignUpResendSuccess(false)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: registeredEmail
      })

      if (error) throw error

      setSignUpResendSuccess(true)
      setTimeout(() => setSignUpResendSuccess(false), 5000)
    } catch (err) {
      setSignUpError(err.message)
    } finally {
      setSignUpResendLoading(false)
    }
  }

  // ─── Guest / Test Mode Bypass ─────────────────────────────────────────────
  const handleGuestLogin = async () => {
    setGuestLoading(true)
    setError(null)
    const testEmail = 'guest.viewer@itims.local'
    const testPassword = 'GuestViewer123!'

    try {
      // 1. Authenticate with backend API for Flask JWT token
      try {
        const response = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: testEmail, password: testPassword }),
        })
        const data = await response.json()
        if (response.ok && data.access_token) {
          localStorage.setItem('token', data.access_token)
          localStorage.setItem('flask_jwt_token', data.access_token)
        }
      } catch (backendErr) {
        console.warn('Backend login warning during viewer bypass:', backendErr)
      }

      // 2. Authenticate directly with Supabase client
      const { data: supaData, error: supaErr } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      })

      if (supaErr) {
        throw supaErr
      }

      console.log('✅ Guest viewer bypass successful:', supaData)
    } catch (err) {
      setError(err.message || 'Failed to enter viewer test mode')
    } finally {
      setGuestLoading(false)
    }
  }

  // ─── Main Submit (Login or Sign Up) ────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isSignUp) {
        // Validation
        if (!fullName.trim()) {
          throw new Error('Full name is required')
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters')
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match')
        }

        // Register directly via Supabase Auth with user metadata
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              gender: gender
            }
          }
        })

        if (signUpErr) {
          throw signUpErr
        }

        // Check if user already exists (Supabase returns empty identities list)
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error('An account with this email already exists. Please sign in.')
        }

        setRegisteredEmail(email)
        setSignUpOtp('      ')
        setSignUpError(null)

        // If email confirmation is enabled, data.session will be null
        if (data.session) {
          // Direct login if email confirm is disabled
          setSignUpStep('done')
        } else {
          // Transition to OTP verification view
          setSignUpStep('otp')
        }
      } else {
        // Use backend API for login
        const response = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Login failed')
        }

        localStorage.setItem('token', data.access_token)
        localStorage.setItem('flask_jwt_token', data.access_token)
        console.log('✅ Login successful - Token stored')

        const { error: supabaseError } = await supabase.auth.signInWithPassword({ email, password })
        if (supabaseError) console.warn('Supabase login failed:', supabaseError)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // =========================================================================
  // SIGN UP OTP & SUCCESS VIEWS
  // =========================================================================

  // ── Sign Up Step 2: OTP Verification ───────────────────────────────────────
  if (isSignUp && signUpStep === 'otp') {
    const otpComplete = signUpOtp.trim().length === 6
    return (
      <div className="min-h-screen flex">
        <Sidebar
          icon={
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
          title="Verify Your Account"
          subtitle="Enter the 6-digit OTP code sent to your email"
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="lg:hidden mb-8 text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">ITIMS</h1>
            </div>
            <div className="card">
              <button
                onClick={resetSignUpFlow}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to sign up
              </button>

              {/* Step indicator */}
              <div className="flex items-center mb-8">
                <StepDot active={false} done num={1} label="Account" />
                <StepLine done />
                <StepDot active done={false} num={2} label="Verify OTP" />
                <StepLine />
                <StepDot active={false} done={false} num={3} label="Ready" />
              </div>

              <div className="mb-2 text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Verification Code</h2>
                <p className="text-gray-600 text-sm">
                  We've sent a 6-digit verification code to <br />
                  <span className="font-semibold text-primary-600">{registeredEmail}</span>
                </p>
              </div>

              <OtpInput value={signUpOtp} onChange={setSignUpOtp} />

              <ErrorBanner message={signUpError} />

              {signUpResendSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 text-center font-medium">
                  ✓ A new verification code has been sent to your email.
                </div>
              )}

              <form onSubmit={handleVerifySignUpOtp} className="space-y-4">
                <button
                  type="submit"
                  disabled={signUpLoading || !otpComplete}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SpinnerLabel loading={signUpLoading} label="Verify Account" loadingLabel="Verifying..." />
                </button>
              </form>

              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={handleResendSignUpOtp}
                  disabled={signUpResendLoading || signUpLoading}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50 transition-colors"
                >
                  {signUpResendLoading ? 'Resending code...' : "Didn't receive the code? Resend OTP"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Sign Up Step 3: Verified Done ──────────────────────────────────────────
  if (isSignUp && signUpStep === 'done') {
    return (
      <div className="min-h-screen flex">
        <Sidebar
          icon={
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
          title="Account Verified"
          subtitle="Your account is confirmed and ready to use"
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="card text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Account Verified!</h2>
              <p className="text-gray-600 mb-8">
                Your email has been confirmed. You can now sign in with your account credentials.
              </p>
              <button
                onClick={() => {
                  setIsSignUp(false)
                  setSignUpStep(null)
                  setPassword('')
                  setConfirmPassword('')
                  setError(null)
                }}
                className="btn-primary w-full"
              >
                Go to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // FORGOT PASSWORD VIEWS
  // =========================================================================

  // ── Step 1: Email entry ───────────────────────────────────────────────────
  if (fpStep === 'email') {
    return (
      <div className="min-h-screen flex">
        <Sidebar
          icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
          title="Password Recovery"
          subtitle="We'll send a 6-digit code to your inbox"
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="lg:hidden mb-8 text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">ITIMS</h1>
            </div>
            <div className="card">
              <button onClick={resetFp} className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back to sign in
              </button>

              {/* Step indicator */}
              <div className="flex items-center mb-8">
                <StepDot active done={false} num={1} label="Email" />
                <StepLine />
                <StepDot active={false} done={false} num={2} label="Verify OTP" />
                <StepLine />
                <StepDot active={false} done={false} num={3} label="New Password" />
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Forgot your password?</h2>
                <p className="text-gray-600">Enter your email and we'll send a 6-digit code to verify it's you.</p>
              </div>

              <ErrorBanner message={fpError} />

              <form onSubmit={handleSendOtp} className="space-y-6">
                <div>
                  <label htmlFor="fpEmail" className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input
                    id="fpEmail"
                    type="email"
                    required
                    value={fpEmail}
                    onChange={(e) => setFpEmail(e.target.value)}
                    className="input-field"
                    placeholder="you@example.com"
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={fpLoading} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
                  <SpinnerLabel loading={fpLoading} label="Send OTP Code" loadingLabel="Sending..." />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2: OTP verification ──────────────────────────────────────────────
  if (fpStep === 'otp') {
    const otpComplete = fpOtp.trim().length === 6
    return (
      <div className="min-h-screen flex">
        <Sidebar
          icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
          title="Enter Your Code"
          subtitle="Check your inbox for the 6-digit verification code"
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="lg:hidden mb-8 text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">ITIMS</h1>
            </div>
            <div className="card">
              <button onClick={() => { setFpStep('email'); setFpError(null) }} className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>

              {/* Step indicator */}
              <div className="flex items-center mb-8">
                <StepDot active={false} done num={1} label="Email" />
                <StepLine done />
                <StepDot active done={false} num={2} label="Verify OTP" />
                <StepLine />
                <StepDot active={false} done={false} num={3} label="New Password" />
              </div>

              <div className="mb-2 text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter the code</h2>
                <p className="text-gray-600">
                  We sent a 6-digit code to <span className="font-medium text-primary-600">{fpEmail}</span>.
                  Enter it below.
                </p>
              </div>

              <OtpInput value={fpOtp} onChange={setFpOtp} />

              <ErrorBanner message={fpError} />

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <button
                  type="submit"
                  disabled={fpLoading || !otpComplete}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SpinnerLabel loading={fpLoading} label="Verify Code" loadingLabel="Verifying..." />
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={fpLoading}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                >
                  Didn't receive it? Resend code
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 3: New password ──────────────────────────────────────────────────
  if (fpStep === 'newPassword') {
    const passwordsMatch = fpNewPassword === fpConfirmPassword
    const canSubmit = fpNewPassword.length >= 6 && passwordsMatch
    return (
      <div className="min-h-screen flex">
        <Sidebar
          icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
          title="Set New Password"
          subtitle="Choose a strong password for your account"
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="lg:hidden mb-8 text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">ITIMS</h1>
            </div>
            <div className="card">
              {/* Step indicator */}
              <div className="flex items-center mb-8">
                <StepDot active={false} done num={1} label="Email" />
                <StepLine done />
                <StepDot active={false} done num={2} label="Verify OTP" />
                <StepLine done />
                <StepDot active done={false} num={3} label="New Password" />
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Set new password</h2>
                <p className="text-gray-600">Your identity is verified. Choose a new password below.</p>
              </div>

              <ErrorBanner message={fpError} />

              <form onSubmit={handleUpdatePassword} className="space-y-5">
                <div>
                  <label htmlFor="fpNewPassword" className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      id="fpNewPassword"
                      type={fpShowPassword ? 'text' : 'password'}
                      required
                      value={fpNewPassword}
                      onChange={(e) => setFpNewPassword(e.target.value)}
                      className="input-field pr-10"
                      placeholder="Min. 6 characters"
                      minLength={6}
                      autoFocus
                    />
                    <button type="button" onClick={() => setFpShowPassword(!fpShowPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600" tabIndex={-1}>
                      <EyeIcon show={fpShowPassword} />
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="fpConfirmPassword" className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                  <div className="relative">
                    <input
                      id="fpConfirmPassword"
                      type={fpShowConfirmPassword ? 'text' : 'password'}
                      required
                      value={fpConfirmPassword}
                      onChange={(e) => setFpConfirmPassword(e.target.value)}
                      className="input-field pr-10"
                      placeholder="Re-enter your new password"
                      minLength={6}
                    />
                    <button type="button" onClick={() => setFpShowConfirmPassword(!fpShowConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600" tabIndex={-1}>
                      <EyeIcon show={fpShowConfirmPassword} />
                    </button>
                  </div>
                  {fpConfirmPassword.length > 0 && (
                    <p className={`mt-1.5 text-xs font-medium flex items-center ${passwordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                      {passwordsMatch ? (
                        <>
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Passwords match
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Passwords do not match
                        </>
                      )}
                    </p>
                  )}
                </div>

                <button type="submit" disabled={fpLoading || !canSubmit}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
                  <SpinnerLabel loading={fpLoading} label="Update Password" loadingLabel="Updating..." />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Done (Forgot Password) ────────────────────────────────────────────────
  if (fpStep === 'done') {
    return (
      <div className="min-h-screen flex">
        <Sidebar
          icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
          title="All Done!"
          subtitle="Your password has been updated successfully"
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="card text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Password Updated!</h2>
              <p className="text-gray-600 mb-8">
                Your password has been changed successfully. You can now sign in with your new password.
              </p>
              <button onClick={resetFp} className="btn-primary w-full">
                Go to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // MAIN LOGIN / SIGN-UP VIEW
  // =========================================================================
  const signUpPasswordsMatch = password === confirmPassword
  const canSignUp = isSignUp
    ? fullName.trim() && email.trim() && password.length >= 6 && signUpPasswordsMatch
    : true

  return (
    <div className="min-h-screen flex">
      {/* Left Section - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 p-12 flex-col justify-between">
        <div>
          <h1 className="text-white text-4xl font-bold mb-4">ITIMS</h1>
          <p className="text-primary-100 text-lg">IT Infrastructure Management System</p>
        </div>
        <div className="space-y-8">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg mb-1">Secure & Reliable</h3>
              <p className="text-primary-100">Enterprise-grade security for your IT assets</p>
            </div>
          </div>
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg mb-1">Real-time Monitoring</h3>
              <p className="text-primary-100">Track your infrastructure status instantly</p>
            </div>
          </div>
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg mb-1">Comprehensive Analytics</h3>
              <p className="text-primary-100">Make data-driven decisions with detailed reports</p>
            </div>
          </div>
        </div>
        <p className="text-primary-200 text-sm">© 2025 ITIMS. Built by Git Souls Team.</p>
      </div>

      {/* Right Section - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">ITIMS</h1>
            <p className="text-gray-600">IT Infrastructure Management System</p>
          </div>

          <div className="card">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </h2>
              <p className="text-gray-600">
                {isSignUp ? 'Sign up to get started with ITIMS' : 'Sign in to your account to continue'}
              </p>
            </div>

            <ErrorBanner message={error} />

            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignUp && (
                <>
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input
                      id="fullName"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="input-field"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                    <select
                      id="gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="input-field"
                    >
                      <option value="prefer_not_to_say">Prefer not to say</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pr-10"
                    placeholder="••••••••"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    <EyeIcon show={showPassword} />
                  </button>
                </div>
              </div>

              {isSignUp && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field pr-10"
                      placeholder="Re-enter your password"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      <EyeIcon show={showConfirmPassword} />
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <p className={`mt-1.5 text-xs font-medium flex items-center ${signUpPasswordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                      {signUpPasswordsMatch ? (
                        <>
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Passwords match
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Passwords do not match
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}

              {!isSignUp && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember"
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="remember" className="ml-2 block text-sm text-gray-700">Remember me</label>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFpEmail(email) // pre-fill from login email field
                      setFpError(null)
                      setFpStep('email')
                    }}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (isSignUp && !canSignUp)}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SpinnerLabel
                  loading={loading}
                  label={isSignUp ? 'Create Account' : 'Sign In'}
                  loadingLabel="Processing..."
                />
              </button>
            </form>

            {!isSignUp && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-gray-400 font-semibold tracking-wider">
                      Demo & Testing Mode
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGuestLogin}
                  disabled={guestLoading || loading}
                  className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-primary-300 hover:border-primary-500 bg-primary-50/60 hover:bg-primary-100 text-primary-700 font-semibold transition-all flex items-center justify-center space-x-2 shadow-sm hover:shadow group disabled:opacity-50"
                >
                  {guestLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Entering Viewer Test Mode...
                    </span>
                  ) : (
                    <>
                      <svg className="w-5 h-5 text-primary-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>Bypass Login (Viewer Test Mode)</span>
                    </>
                  )}
                </button>
                <p className="text-center text-xs text-gray-500 mt-2">
                  Direct 1-click access with read-only (Viewer) permissions
                </p>
              </>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                  setPassword('')
                  setConfirmPassword('')
                  resetSignUpFlow()
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {isSignUp ? (
                  <>Already have an account?{' '}<span className="font-medium text-primary-600 hover:text-primary-700">Sign in</span></>
                ) : (
                  <>Don't have an account?{' '}<span className="font-medium text-primary-600 hover:text-primary-700">Sign up</span></>
                )}
              </button>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-gray-500">
            By continuing, you agree to our{' '}
            <a href="#" className="text-primary-600 hover:text-primary-700 font-medium">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-primary-600 hover:text-primary-700 font-medium">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Helper micro-components ──────────────────────────────────────────────────

function StepDot({ active, done, num, label }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
        ${done ? 'bg-primary-600 text-white' : active ? 'bg-primary-100 border-2 border-primary-600 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
        {done ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : num}
      </div>
      <span className={`text-xs mt-1 font-medium ${active ? 'text-primary-600' : done ? 'text-primary-500' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  )
}

function StepLine({ done }) {
  return <div className={`flex-1 h-0.5 mx-2 mb-4 ${done ? 'bg-primary-500' : 'bg-gray-200'}`} />
}

function EyeIcon({ show }) {
  return show ? (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

export default Login
