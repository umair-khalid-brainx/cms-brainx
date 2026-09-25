import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import './auth.css'

function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const login = searchParams.get('login')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // not wired up yet — see FND-05; reached via a link emailed from the lost-password flow
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          <span className="auth-logo-mark">CMS</span>
          <span className="auth-logo-text">Admin</span>
        </div>

        <p className="auth-description">
          {login ? (
            <>
              Enter a new password for <strong>{login}</strong>.
            </>
          ) : (
            'Enter your new password below.'
          )}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="reset-password">New Password</label>
          <div className="auth-password-field">
            <input
              id="reset-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="auth-password-toggle"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <label htmlFor="reset-password-confirm">Confirm New Password</label>
          <div className="auth-password-field">
            <input
              id="reset-password-confirm"
              name="passwordConfirm"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="auth-password-toggle"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowConfirmPassword((v) => !v)}
            >
              {showConfirmPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <button type="submit" className="auth-submit">
            Reset Password
          </button>
        </form>
      </div>

      <div className="auth-links">
        <Link to="/login">&larr; Back to login</Link>
      </div>
    </div>
  )
}

export default ResetPasswordPage
