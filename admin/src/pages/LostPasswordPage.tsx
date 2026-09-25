import { type FormEvent } from 'react'
import { Link } from 'react-router'
import './auth.css'

function LostPasswordPage() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // not wired up yet — no email delivery exists (see DECISIONS.md D-014)
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          <span className="auth-logo-mark">CMS</span>
          <span className="auth-logo-text">Admin</span>
        </div>

        <p className="auth-description">
          Please enter your username or email address. You will receive an email message with
          instructions on how to reset your password.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="lost-identifier">Username or Email Address</label>
          <input id="lost-identifier" name="identifier" type="text" autoComplete="username" />

          <button type="submit" className="auth-submit">
            Get New Password
          </button>
        </form>
      </div>

      <div className="auth-links">
        <Link to="/login">&larr; Back to login</Link>
      </div>
    </div>
  )
}

export default LostPasswordPage
