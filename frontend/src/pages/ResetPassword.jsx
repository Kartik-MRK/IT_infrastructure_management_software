import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

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

const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const DotIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="3" strokeLinecap="round">
    <line x1="6" y1="12" x2="18" y2="12" />
  </svg>
)

// The submit button was disabled with no explanation anywhere on screen, so a
// mismatched confirmation field read as a broken button. Each rule states
// itself and reports whether it is satisfied.
const Rule = ({ met, children }) => (
  <li className="auth-rule" data-met={met}>
    <span className="auth-rule-icon" aria-hidden="true">{met ? <CheckIcon /> : <DotIcon />}</span>
    {children}
  </li>
)

function ResetPassword() {
  const { isPasswordRecovery, setIsPasswordRecovery } = useAuth()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [hasSession, setHasSession] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    async function checkAuthSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setHasSession(true)
          setIsPasswordRecovery(true)
        } else {
          setHasSession(false)
        }
      } catch (err) {
        console.error('Error checking recovery session:', err)
      } finally {
        setCheckingSession(false)
      }
    }

    checkAuthSession()
  }, [setIsPasswordRecovery])

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updateErr) throw updateErr

      await supabase.auth.signOut()
      setIsPasswordRecovery(false)
      setIsSuccess(true)
      toast.success('Password updated — sign in with your new password.')
    } catch (err) {
      setError(err.message)
      toast.error(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="auth-page">
        <div className="auth-card items-center">
          <span
            className="animate-spin-fast rounded-full"
            style={{ width: 22, height: 22, border: '2px solid var(--line-strong)', borderTopColor: 'var(--brand)' }}
          />
          <p className="text-[12.5px] mt-3 m-0" style={{ color: 'var(--text-muted)' }}>
            Validating your recovery link…
          </p>
        </div>
        <AuthStyles />
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-card text-center">
          <span className="auth-seal" data-tone="ok">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <h2 className="auth-title">Password updated</h2>
          <p className="auth-sub">
            Your password has been changed and this recovery session has been signed out.
          </p>
          <Link to="/login" className="btn-primary w-full !justify-center mt-5">
            Sign in with your new password
          </Link>
        </div>
        <AuthStyles />
      </div>
    )
  }

  if (!hasSession && !isPasswordRecovery) {
    return (
      <div className="auth-page">
        <div className="auth-card text-center">
          <span className="auth-seal" data-tone="warn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4" /><path d="M12 17h.01" />
              <path d="M10.3 3.9L2.4 17.2A1.9 1.9 0 004 20h16a1.9 1.9 0 001.6-2.8L13.7 3.9a1.9 1.9 0 00-3.4 0z" />
            </svg>
          </span>
          <h2 className="auth-title">This link is no longer valid</h2>
          <p className="auth-sub">
            Recovery links expire once used. Start again from the sign-in page and choose
            <strong style={{ color: 'var(--text-soft)' }}> Forgot password</strong> to get a fresh 6-digit code.
          </p>
          <Link to="/login" className="btn-primary w-full !justify-center mt-5">
            Back to sign in
          </Link>
        </div>
        <AuthStyles />
      </div>
    )
  }

  const lengthOk = newPassword.length >= 6
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword
  const canSubmit = lengthOk && passwordsMatch

  // Typing is the user fixing the problem. The old error box stayed on screen
  // until the next submit, so it went on contradicting the form while they
  // corrected it.
  const onFieldChange = (setter) => (e) => {
    setter(e.target.value)
    if (error) setError(null)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="text-center">
          <img src="/favicon.svg" alt="" className="auth-logo" />
          <h2 className="auth-title">Set a new password</h2>
          <p className="auth-sub">Choose something you have not used on this account before.</p>
        </div>

        {error && (
          // Screen readers were never told the submission failed.
          <div className="auth-error" role="alert">{error}</div>
        )}

        <form onSubmit={handleUpdatePassword} className="flex flex-col gap-3.5 mt-5">
          <div>
            <label htmlFor="new-password" className="auth-label">New password</label>
            <div className="auth-field">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={onFieldChange(setNewPassword)}
                // Without this, password managers offered the *old* password
                // and then saved it back over the new one.
                autoComplete="new-password"
                className="input-field"
                style={{ paddingRight: 40 }}
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="auth-peek"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {/* Was 🙈 / 👁️ — two emoji whose rendering, size and baseline
                    differ on every platform, and which named nothing to a
                    screen reader. */}
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className="auth-label">Confirm password</label>
            <div className="auth-field">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={onFieldChange(setConfirmPassword)}
                autoComplete="new-password"
                className="input-field"
                style={{ paddingRight: 40 }}
                placeholder="Re-enter the same password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="auth-peek"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showConfirmPassword}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <ul className="auth-rules">
            <Rule met={lengthOk}>At least 6 characters</Rule>
            <Rule met={!!passwordsMatch}>Both fields match</Rule>
          </ul>

          <button type="submit" disabled={loading || !canSubmit} className="btn-primary w-full !justify-center">
            {loading && (
              <span
                className="animate-spin-fast rounded-full"
                style={{ width: 13, height: 13, border: '1.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
              />
            )}
            {loading ? 'Updating password…' : 'Save new password'}
          </button>

          <Link to="/login" className="auth-back">Back to sign in</Link>
        </form>
      </div>
      <AuthStyles />
    </div>
  )
}

// One stylesheet for five mutually exclusive render branches, so the rules
// cannot drift apart between them.
const AuthStyles = () => (
  <style>{`
    .auth-page {
      display: flex; align-items: center; justify-content: center;
      min-height: 100dvh;
      padding: 24px;
      /* Was bg-slate-900 — a near-black page in front of an application that
         is light everywhere else, including the sign-in page it links to. */
      background: var(--bg);
    }

    .auth-card {
      display: flex; flex-direction: column;
      width: 100%; max-width: 400px;
      padding: 26px 24px;
      border-radius: 16px;
      background: var(--surface);
      border: 1px solid var(--line);
      box-shadow: 0 4px 20px rgba(15, 23, 42, 0.07);
    }

    .auth-logo {
      width: 42px; height: 42px;
      margin: 0 auto 12px;
      border-radius: 12px;
    }

    .auth-seal {
      display: inline-flex; align-items: center; justify-content: center;
      width: 46px; height: 46px;
      margin: 0 auto 14px;
      border-radius: 999px;
    }
    .auth-seal[data-tone='ok'] {
      color: var(--ok);
      background: var(--ok-soft);
      border: 1px solid var(--ok-line);
    }
    .auth-seal[data-tone='warn'] {
      color: var(--warn);
      background: var(--warn-soft);
      border: 1px solid var(--warn-line);
    }

    .auth-title {
      margin: 0;
      font-size: 19px; font-weight: 700; letter-spacing: -0.015em;
      color: var(--text);
    }
    .auth-sub {
      margin: 6px 0 0;
      font-size: 12.5px; line-height: 1.6;
      color: var(--text-muted);
    }

    .auth-error {
      margin-top: 16px;
      padding: 9px 11px;
      border-radius: 10px;
      font-size: 12.5px; line-height: 1.5;
      color: var(--danger);
      background: var(--danger-soft);
      border: 1px solid var(--danger-line);
    }

    .auth-label {
      display: block;
      margin-bottom: 5px;
      font-size: 11.5px; font-weight: 600;
      color: var(--text-soft);
    }

    .auth-field { position: relative; }

    .auth-peek {
      position: absolute;
      top: 50%; right: 6px;
      transform: translateY(-50%);
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px;
      border-radius: 7px;
      color: var(--text-faint);
      background: transparent;
      border: 1px solid transparent;
      cursor: pointer;
      transition:
        color var(--t-press) var(--ease-out),
        background-color var(--t-press) var(--ease-out);
    }
    @media (hover: hover) and (pointer: fine) {
      .auth-peek:hover { color: var(--text-soft); background: var(--surface-hover); }
    }
    /* translateY has to survive the press, so the scale composes with it
       rather than replacing it. */
    .auth-peek:active { transform: translateY(-50%) scale(0.9); }

    .auth-rules {
      display: flex; flex-direction: column; gap: 4px;
      margin: 0; padding: 9px 11px;
      list-style: none;
      border-radius: 10px;
      background: var(--surface-sunk);
      border: 1px solid var(--line);
    }
    .auth-rule {
      display: flex; align-items: center; gap: 6px;
      font-size: 11.5px;
      color: var(--text-muted);
      transition: color var(--t-press) var(--ease-out);
    }
    .auth-rule[data-met='true'] { color: var(--ok); }
    .auth-rule-icon { display: inline-flex; flex-shrink: 0; }

    .auth-back {
      align-self: center;
      font-size: 12px; font-weight: 600;
      color: var(--text-muted);
      transition: color var(--t-press) var(--ease-out);
    }
    @media (hover: hover) and (pointer: fine) {
      .auth-back:hover { color: var(--brand); }
    }

    @media (prefers-reduced-motion: reduce) {
      .auth-rule { transition: none; }
    }
  `}</style>
)

export default ResetPassword
