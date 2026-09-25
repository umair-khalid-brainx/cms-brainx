import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import './auth.css'

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // not wired up yet — see FND-05
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          <span className="auth-logo-mark">CMS</span>
          <span className="auth-logo-text">Admin</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-identifier">Username or Email Address</label>
          <input id="login-identifier" name="identifier" type="text" autoComplete="username" />

          <label htmlFor="login-password">Password</label>
          <div className="auth-password-field">
            <input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
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

          <label className="auth-remember">
            <input type="checkbox" name="remember" />
            Remember Me
          </label>

          <button type="submit" className="auth-submit">
            Log In
          </button>
        </form>
      </div>

      <div className="auth-links">
        <Link to="/lost-password">Lost your password?</Link>
      </div>
    </div>
  )
}

export default LoginPage
