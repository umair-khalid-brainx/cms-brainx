import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../lib/api'
import { setSession } from '../lib/auth'
import { acceptInvite, previewInvite, type InvitePreview } from '../lib/teamApi'
import { ROLE_LABELS } from '../lib/roles'
import './auth.css'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; preview: InvitePreview }

function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()

  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    // oxlint's set-state-in-effect warning here is expected, not a bug — same
    // reasoning as EditorPage's identical case: there's no fetch to make at
    // all when the URL has no token, so this is the terminal state, not an
    // intermediate one waiting on something async.
    if (!token) {
      setLoad({ status: 'error', message: 'This invite link is missing its token.' })
      return
    }
    previewInvite(token)
      .then((preview) => {
        if (!cancelled) setLoad({ status: 'ready', preview })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoad({
          status: 'error',
          message: error instanceof ApiError ? error.message : 'This invite link is invalid or has expired.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      const session = await acceptInvite(token, { name: name.trim() || undefined, password })
      setSession(session)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'Could not reach the server. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (load.status === 'loading') {
    return (
      <div className="auth-page">
        <div className="auth-box">
          <p className="auth-description">Loading invite…</p>
        </div>
      </div>
    )
  }

  if (load.status === 'error') {
    return (
      <div className="auth-page">
        <div className="auth-box">
          <div className="auth-logo">
            <span className="auth-logo-mark">CMS</span>
            <span className="auth-logo-text">Admin</span>
          </div>
          <p className="auth-error">{load.message}</p>
        </div>
        <div className="auth-links">
          <Link to="/login">&larr; Back to login</Link>
        </div>
      </div>
    )
  }

  const { preview } = load

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          <span className="auth-logo-mark">CMS</span>
          <span className="auth-logo-text">Admin</span>
        </div>

        <p className="auth-description">
          You&rsquo;ve been invited to join <strong>{preview.siteName}</strong> as{' '}
          <strong>{ROLE_LABELS[preview.role]}</strong> ({preview.email}).
        </p>

        {submitError ? <p className="auth-error">{submitError}</p> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          {!preview.existingAccount && (
            <>
              <label htmlFor="invite-name">Your Name</label>
              <input
                id="invite-name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </>
          )}

          <label htmlFor="invite-password">
            {preview.existingAccount ? 'Password' : 'Choose a Password'}
          </label>
          <div className="auth-password-field">
            <input
              id="invite-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={preview.existingAccount ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? 'Joining…' : preview.existingAccount ? 'Accept and Join' : 'Create Account'}
          </button>
        </form>
      </div>

      <div className="auth-links">
        <Link to="/login">&larr; Back to login</Link>
      </div>
    </div>
  )
}

export default AcceptInvitePage
