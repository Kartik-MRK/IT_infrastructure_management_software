import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './Login.css'

// The sentinel value for an unfilled OTP is six spaces, and the old gate was
// `otp.trim().length === 6`. "12 456" passes that test — trim only removes the
// ends — so a code with a hole in the middle was posted to Supabase as a
// six-character token and came back as a generic "invalid token" error.
const otpDigits = (v) => (v || '').replace(/\D/g, '')

const RESEND_COOLDOWN = 30

// ─── Icons ────────────────────────────────────────────────────────────────────
const EyeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 19.5C5 19.5 1.5 12 1.5 12a18.5 18.5 0 015.06-5.94" />
    <path d="M9.9 4.74A9.12 9.12 0 0112 4.5c7 0 10.5 7.5 10.5 7.5a18.6 18.6 0 01-2.16 3.19" />
    <path d="M9.9 9.9a3 3 0 004.2 4.2" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
)

const CheckIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const CrossIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const BackIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11.5 14.5 15.5 10" />
  </svg>
)

const PulseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2 12 6 12 9 4 14 20 17 12 22 12" />
  </svg>
)

const ChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="21" x2="5" y2="12" /><line x1="12" y1="21" x2="12" y2="4" />
    <line x1="19" y1="21" x2="19" y2="9" />
  </svg>
)

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M3 6.5l9 6 9-6" />
  </svg>
)

const KeyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="10.5" width="16" height="10.5" rx="2" />
    <path d="M8 10.5V7a4 4 0 018 0v3.5" />
  </svg>
)

const Spinner = ({ onBrand }) => (
  <span
    className="animate-spin-fast rounded-full"
    style={{
      width: 13, height: 13,
      border: onBrand ? '1.5px solid rgba(255,255,255,0.35)' : '1.5px solid var(--line-strong)',
      borderTopColor: onBrand ? '#fff' : 'var(--brand)',
    }}
  />
)

// ─── OTP input — six digit boxes ─────────────────────────────────────────────
function OtpInput({ value, onChange, label }) {
  const inputs = useRef([])

  const handleChange = (index, e) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1) // digits only, 1 char
    const newOtp = (value || '      ').split('')
    newOtp[index] = val || ' '
    const joined = newOtp.join('').padEnd(6, ' ')
    onChange(joined)
    if (val && index < 5) inputs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      const currentVal = (value?.[index] || '').trim()
      if (!currentVal && index > 0) {
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
    // Arrow keys used to do nothing, so correcting the third digit of six
    // meant deleting back to it.
    if (e.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5) inputs.current[index + 1]?.focus()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted.padEnd(6, ' '))
    const focusIdx = Math.min(pasted.length, 5)
    inputs.current[focusIdx]?.focus()
  }

  return (
    <div className="lg-otp" role="group" aria-label={label}>
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
            onFocus={(e) => e.target.select()}
            autoFocus={i === 0}
            // Lets iOS and Android offer the code straight from the SMS/mail
            // notification instead of making the user switch apps.
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${i + 1} of 6`}
            className="lg-otp-box"
            data-filled={!!char}
          />
        )
      })}
    </div>
  )
}

// ─── Branding panel ──────────────────────────────────────────────────────────
const FEATURES = [
  { icon: <ShieldIcon />, title: 'Secure by default',   text: 'Hash-chained audit trail and role-scoped access on every write.' },
  { icon: <PulseIcon />,  title: 'Live telemetry',       text: 'Z-score anomaly detection turns drift into incidents automatically.' },
  { icon: <ChartIcon />,  title: 'Lifecycle economics',  text: 'Depreciation, TCO and licence burn tracked per asset.' },
]

// The main view used to inline its own 45-line copy of this panel instead of
// calling the component that already existed — and the two had drifted: the
// copy carried three features in three different accent colours, the component
// carried one.
function AuthShell({ features = FEATURES, children }) {
  return (
    <div className="lg-page">
      <aside className="lg-brand">
        <div>
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="lg-mark" />
            <span className="lg-wordmark">ITIMS</span>
          </div>
          <p className="lg-tagline">IT Infrastructure Management System</p>
        </div>

        <ul className="lg-features">
          {features.map(f => (
            <li key={f.title} className="lg-feature">
              <span className="lg-feature-icon" aria-hidden="true">{f.icon}</span>
              <div>
                <h3 className="lg-feature-title">{f.title}</h3>
                <p className="lg-feature-text">{f.text}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="lg-copy">© 2025 ITIMS · Built by Git Souls Team</p>
      </aside>

      <main className="lg-main">
        <div className="lg-col">
          <div className="lg-compact-mark">
            <img src="/favicon.svg" alt="" className="lg-mark" />
            <span className="lg-wordmark" style={{ fontSize: 22 }}>ITIMS</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

// ─── Shared bits ─────────────────────────────────────────────────────────────
function Banner({ message, tone = 'danger' }) {
  if (!message) return null
  return (
    // The old banner was a plain <div>, so a failed sign-in was silent to
    // anyone not looking at that part of the screen.
    <div className="lg-banner" data-tone={tone} role="alert">
      <span className="shrink-0 mt-px" aria-hidden="true">
        {tone === 'ok' ? <CheckIcon size={13} /> : <CrossIcon />}
      </span>
      <span>{message}</span>
    </div>
  )
}

// One `current` index instead of nine hand-maintained active/done booleans —
// the old call sites could, and did, describe three different progressions.
function Steps({ labels, current }) {
  return (
    <ol className="lg-steps">
      {labels.map((label, i) => (
        <li key={label} className="lg-step" data-state={i < current ? 'done' : i === current ? 'active' : 'todo'}>
          <span className="lg-step-dot" aria-current={i === current ? 'step' : undefined}>
            {i < current ? <CheckIcon size={13} /> : i + 1}
          </span>
          <span className="lg-step-label">{label}</span>
          {i < labels.length - 1 && <span className="lg-step-line" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  )
}

function BackLink({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="lg-back">
      <BackIcon />
      {children}
    </button>
  )
}

function PasswordField({ id, label, value, onChange, placeholder, autoComplete, autoFocus, hint }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="lg-label">{label}</label>
      <div className="lg-field">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          minLength={6}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className="input-field"
          style={{ paddingRight: 40 }}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="lg-peek"
          // Was tabIndex={-1} with no label at all: the only way to check what
          // you had typed was unreachable by keyboard and unnamed to a screen
          // reader.
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint}
    </div>
  )
}

function MatchHint({ value, matches }) {
  if (!value) return null
  return (
    <p className="lg-hint" data-tone={matches ? 'ok' : 'danger'}>
      <span aria-hidden="true">{matches ? <CheckIcon size={11} /> : <CrossIcon />}</span>
      {matches ? 'Passwords match' : 'Passwords do not match'}
    </p>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
function Login() {
  const { isPasswordRecovery, setIsPasswordRecovery } = useAuth()

  // ─── Login / Sign-up state ─────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState('prefer_not_to_say')
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSignUp, setIsSignUp] = useState(false)

  // ─── Sign Up OTP verification state ────────────────────────────────────────
  const [signUpStep, setSignUpStep] = useState(null) // null | 'otp' | 'done'
  const [signUpOtp, setSignUpOtp] = useState('      ')
  const [signUpLoading, setSignUpLoading] = useState(false)
  const [signUpResendLoading, setSignUpResendLoading] = useState(false)
  const [signUpResendSuccess, setSignUpResendSuccess] = useState(false)
  const [signUpError, setSignUpError] = useState(null)
  const [registeredEmail, setRegisteredEmail] = useState('')

  // ─── Forgot password state (3-step wizard) ────────────────────────────────
  const [fpStep, setFpStep] = useState(null) // null | 'email' | 'otp' | 'newPassword' | 'done'
  const [fpEmail, setFpEmail] = useState('')
  const [fpOtp, setFpOtp] = useState('      ')
  const [fpLoading, setFpLoading] = useState(false)
  const [fpError, setFpError] = useState(null)
  const [fpNewPassword, setFpNewPassword] = useState('')
  const [fpConfirmPassword, setFpConfirmPassword] = useState('')
  const [fpSession, setFpSession] = useState(null)

  // Supabase rate-limits OTP mail to roughly one a minute. Without a visible
  // cooldown, an impatient second tap returned an opaque failure that read as
  // "the code never sent".
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (isPasswordRecovery) {
      setFpStep('newPassword')
    }
  }, [isPasswordRecovery])

  useEffect(() => {
    if (resendIn <= 0) return
    const id = setTimeout(() => setResendIn(resendIn - 1), 1000)
    return () => clearTimeout(id)
  }, [resendIn])

  const resetFp = () => {
    setIsPasswordRecovery(false)
    setFpStep(null)
    setFpEmail('')
    setFpOtp('      ')
    setFpLoading(false)
    setFpError(null)
    setFpNewPassword('')
    setFpConfirmPassword('')
    setFpSession(null)
    setResendIn(0)
  }

  const resetSignUpFlow = () => {
    setSignUpStep(null)
    setSignUpOtp('      ')
    setSignUpLoading(false)
    setSignUpResendLoading(false)
    setSignUpResendSuccess(false)
    setSignUpError(null)
    setResendIn(0)
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
      setResendIn(RESEND_COOLDOWN)
    } catch (err) {
      setFpError(err.message)
    } finally {
      setFpLoading(false)
    }
  }

  // ─── Forgot Password Step 2: verify OTP ───────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    const code = otpDigits(fpOtp)
    if (code.length !== 6) {
      setFpError('Please enter all six digits of the code.')
      return
    }
    setFpLoading(true)
    setFpError(null)
    try {
      setIsPasswordRecovery(true)
      const { data, error } = await supabase.auth.verifyOtp({
        email: fpEmail,
        token: code,
        type: 'recovery',
      })
      if (error) {
        setIsPasswordRecovery(false)
        throw error
      }
      setFpSession(data.session)
      setFpStep('newPassword')
    } catch (err) {
      setIsPasswordRecovery(false)
      setFpError(err.message === 'Token has expired or is invalid'
        ? 'That code is invalid or has expired. Request a new one.'
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
      setIsPasswordRecovery(false)
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
    const code = otpDigits(signUpOtp)
    if (code.length !== 6) {
      setSignUpError('Please enter all six digits of the verification code.')
      return
    }

    setSignUpLoading(true)
    setSignUpError(null)

    try {
      const { error } = await supabase.auth.verifyOtp({
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
          ? 'That verification code is invalid or has expired. Request a new one.'
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
      setResendIn(RESEND_COOLDOWN)
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
      const { error: supaErr } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      })

      if (supaErr) {
        throw supaErr
      }
      // The success log here printed the whole Supabase response — access and
      // refresh tokens included — into the browser console.
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
        if (!fullName.trim()) {
          throw new Error('Full name is required')
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters')
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match')
        }

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

        // Supabase returns an empty identities list for an existing account
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error('An account with this email already exists. Please sign in.')
        }

        setRegisteredEmail(email)
        setSignUpOtp('      ')
        setSignUpError(null)

        if (data.session) {
          setSignUpStep('done')
        } else {
          setSignUpStep('otp')
          setResendIn(RESEND_COOLDOWN)
        }
      } else {
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

        const { error: supabaseError } = await supabase.auth.signInWithPassword({ email, password })
        if (supabaseError) console.warn('Supabase login failed:', supabaseError)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Typing is the user fixing the problem; the banner used to keep contradicting
  // them until the next submit.
  const clearOnType = (setter, clearError) => (e) => {
    setter(e.target.value)
    clearError()
  }

  // =========================================================================
  // SIGN UP OTP & SUCCESS VIEWS
  // =========================================================================

  if (isSignUp && signUpStep === 'otp') {
    const otpComplete = otpDigits(signUpOtp).length === 6
    return (
      <AuthShell features={[{ icon: <MailIcon />, title: 'Verify your account', text: 'Enter the 6-digit code we sent to your inbox.' }]}>
        <div className="card">
          <BackLink onClick={resetSignUpFlow}>Back to sign up</BackLink>

          <Steps labels={['Account', 'Verify', 'Ready']} current={1} />

          <div className="text-center">
            <h2 className="lg-title">Enter your verification code</h2>
            <p className="lg-sub">
              Sent to <span className="lg-email">{registeredEmail}</span>
            </p>
          </div>

          {/* The boxes used to sit outside the form, so pressing Enter on the
              sixth digit — the obvious thing to do — did nothing at all. */}
          <form onSubmit={handleVerifySignUpOtp}>
            <OtpInput value={signUpOtp} onChange={setSignUpOtp} label="Account verification code" />

            <Banner message={signUpError} />
            {signUpResendSuccess && <Banner tone="ok" message="A new verification code is on its way." />}

            <button type="submit" disabled={signUpLoading || !otpComplete}
                    className="btn-primary w-full !justify-center mt-4">
              {signUpLoading && <Spinner onBrand />}
              {signUpLoading ? 'Verifying…' : 'Verify account'}
            </button>
          </form>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={handleResendSignUpOtp}
              disabled={signUpResendLoading || signUpLoading || resendIn > 0}
              className="lg-textbtn"
            >
              {signUpResendLoading
                ? 'Resending…'
                : resendIn > 0
                  ? `Resend available in ${resendIn}s`
                  : "Didn't get it? Resend the code"}
            </button>
          </div>
        </div>
      </AuthShell>
    )
  }

  if (isSignUp && signUpStep === 'done') {
    return (
      <AuthShell features={[{ icon: <ShieldIcon />, title: 'Account verified', text: 'Your email is confirmed and ready to use.' }]}>
        <div className="card text-center">
          <span className="lg-seal" data-tone="ok"><CheckIcon size={22} /></span>
          <h2 className="lg-title">Account verified</h2>
          <p className="lg-sub">Your email has been confirmed. Sign in to get started.</p>
          <button
            onClick={() => {
              setIsSignUp(false)
              setSignUpStep(null)
              setPassword('')
              setConfirmPassword('')
              setError(null)
            }}
            className="btn-primary w-full !justify-center mt-5"
          >
            Go to sign in
          </button>
        </div>
      </AuthShell>
    )
  }

  // =========================================================================
  // FORGOT PASSWORD VIEWS
  // =========================================================================

  if (fpStep === 'email') {
    return (
      <AuthShell features={[{ icon: <MailIcon />, title: 'Password recovery', text: "We'll send a 6-digit code to your inbox." }]}>
        <div className="card">
          <BackLink onClick={resetFp}>Back to sign in</BackLink>

          <Steps labels={['Email', 'Verify', 'New password']} current={0} />

          <h2 className="lg-title">Forgot your password?</h2>
          <p className="lg-sub">Enter your email and we'll send a code to confirm it's you.</p>

          <Banner message={fpError} />

          <form onSubmit={handleSendOtp} className="flex flex-col gap-4 mt-5">
            <div>
              <label htmlFor="fpEmail" className="lg-label">Email address</label>
              <input
                id="fpEmail"
                type="email"
                required
                value={fpEmail}
                onChange={clearOnType(setFpEmail, () => setFpError(null))}
                className="input-field"
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
              />
            </div>
            <button type="submit" disabled={fpLoading} className="btn-primary w-full !justify-center">
              {fpLoading && <Spinner onBrand />}
              {fpLoading ? 'Sending…' : 'Send the code'}
            </button>
          </form>
        </div>
      </AuthShell>
    )
  }

  if (fpStep === 'otp') {
    const otpComplete = otpDigits(fpOtp).length === 6
    return (
      <AuthShell features={[{ icon: <MailIcon />, title: 'Check your inbox', text: 'The code is valid for a few minutes.' }]}>
        <div className="card">
          <BackLink onClick={() => { setFpStep('email'); setFpError(null) }}>Back</BackLink>

          <Steps labels={['Email', 'Verify', 'New password']} current={1} />

          <div className="text-center">
            <h2 className="lg-title">Enter the code</h2>
            <p className="lg-sub">
              Sent to <span className="lg-email">{fpEmail}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyOtp}>
            <OtpInput value={fpOtp} onChange={setFpOtp} label="Password recovery code" />

            <Banner message={fpError} />

            <button type="submit" disabled={fpLoading || !otpComplete}
                    className="btn-primary w-full !justify-center mt-4">
              {fpLoading && <Spinner onBrand />}
              {fpLoading ? 'Verifying…' : 'Verify code'}
            </button>
          </form>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={fpLoading || resendIn > 0}
              className="lg-textbtn"
            >
              {resendIn > 0 ? `Resend available in ${resendIn}s` : "Didn't get it? Resend the code"}
            </button>
          </div>
        </div>
      </AuthShell>
    )
  }

  if (fpStep === 'newPassword') {
    const lengthOk = fpNewPassword.length >= 6
    const passwordsMatch = fpNewPassword === fpConfirmPassword
    const canSubmit = lengthOk && passwordsMatch
    return (
      <AuthShell features={[{ icon: <KeyIcon />, title: 'Set a new password', text: 'Choose something you have not used here before.' }]}>
        <div className="card">
          <Steps labels={['Email', 'Verify', 'New password']} current={2} />

          <h2 className="lg-title">Set a new password</h2>
          <p className="lg-sub">Your identity is verified. Choose a new password below.</p>

          <Banner message={fpError} />

          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4 mt-5">
            <PasswordField
              id="fpNewPassword"
              label="New password"
              value={fpNewPassword}
              onChange={clearOnType(setFpNewPassword, () => setFpError(null))}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              autoFocus
              hint={fpNewPassword.length > 0 && !lengthOk
                ? <p className="lg-hint" data-tone="danger"><span aria-hidden="true"><CrossIcon /></span>At least 6 characters</p>
                : null}
            />

            <PasswordField
              id="fpConfirmPassword"
              label="Confirm new password"
              value={fpConfirmPassword}
              onChange={clearOnType(setFpConfirmPassword, () => setFpError(null))}
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              hint={<MatchHint value={fpConfirmPassword} matches={passwordsMatch} />}
            />

            <button type="submit" disabled={fpLoading || !canSubmit} className="btn-primary w-full !justify-center">
              {fpLoading && <Spinner onBrand />}
              {fpLoading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </AuthShell>
    )
  }

  if (fpStep === 'done') {
    return (
      <AuthShell features={[{ icon: <KeyIcon />, title: 'All done', text: 'Your password has been updated.' }]}>
        <div className="card text-center">
          <span className="lg-seal" data-tone="ok"><CheckIcon size={22} /></span>
          <h2 className="lg-title">Password updated</h2>
          <p className="lg-sub">Your password has been changed. Sign in with the new one.</p>
          <button onClick={resetFp} className="btn-primary w-full !justify-center mt-5">
            Go to sign in
          </button>
        </div>
      </AuthShell>
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
    <AuthShell>
      <div className="card">
        <h2 className="lg-title">{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
        <p className="lg-sub">
          {isSignUp ? 'A few details and you are in.' : 'Sign in to continue to your workspace.'}
        </p>

        <Banner message={error} />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-5">
          {isSignUp && (
            <>
              <div>
                <label htmlFor="fullName" className="lg-label">Full name</label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={clearOnType(setFullName, () => setError(null))}
                  className="input-field"
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
              <div>
                <label htmlFor="gender" className="lg-label">Gender</label>
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
            <label htmlFor="email" className="lg-label">Email address</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={clearOnType(setEmail, () => setError(null))}
              className="input-field"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={clearOnType(setPassword, () => setError(null))}
            placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
            // Without this, a password manager filling the sign-up form
            // offered the saved password for the site instead of generating
            // a new one.
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            hint={isSignUp && password.length > 0 && password.length < 6
              ? <p className="lg-hint" data-tone="danger"><span aria-hidden="true"><CrossIcon /></span>At least 6 characters</p>
              : null}
          />

          {isSignUp && (
            <PasswordField
              id="confirmPassword"
              label="Confirm password"
              value={confirmPassword}
              onChange={clearOnType(setConfirmPassword, () => setError(null))}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              hint={<MatchHint value={confirmPassword} matches={signUpPasswordsMatch} />}
            />
          )}

          {!isSignUp && (
            // The "Remember me" checkbox beside this was wired to nothing: no
            // state, no storage, no reader. Supabase already persists the
            // session, so the box was a promise the app never made good on.
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setFpEmail(email) // pre-fill from the login email field
                  setFpError(null)
                  setFpStep('email')
                }}
                className="lg-textbtn"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (isSignUp && !canSignUp)}
            className="btn-primary w-full !justify-center"
          >
            {loading && <Spinner onBrand />}
            {loading ? 'Signing in…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {!isSignUp && (
          <>
            <div className="lg-divider"><span>Demo &amp; testing</span></div>

            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={guestLoading || loading}
              className="lg-guest"
            >
              {guestLoading ? <Spinner /> : <EyeIcon />}
              {guestLoading ? 'Entering viewer mode…' : 'Continue as viewer (read-only)'}
            </button>
            <p className="lg-fineprint">One-click access with Viewer permissions — nothing can be changed.</p>
          </>
        )}

        <div className="text-center mt-5 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
              setPassword('')
              setConfirmPassword('')
              resetSignUpFlow()
            }}
            className="lg-swap"
          >
            {isSignUp ? 'Already have an account? ' : 'New here? '}
            <span>{isSignUp ? 'Sign in' : 'Create an account'}</span>
          </button>
        </div>
      </div>

      {/* Both of these were <a href="#">, which scrolls to the top of the page
          and reads to a screen reader as a real destination. Plain text until
          the routes exist. */}
      <p className="lg-terms">
        By continuing you agree to the ITIMS Terms of Service and Privacy Policy.
      </p>
    </AuthShell>
  )
}

export default Login
