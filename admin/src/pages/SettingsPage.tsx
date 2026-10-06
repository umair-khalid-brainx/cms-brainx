import { useState, type FormEvent } from 'react'
import { getSession } from '../lib/auth'
import { ApiError } from '../lib/api'
import { canManageSite } from '../lib/roles'
import { updateSubdomain } from '../lib/siteApi'
import { currentSite, currentSubdomain, siteAddressParts, siteUrl } from '../data/site'
import './SettingsPage.css'

// Site Identity fields are locally editable but don't persist — there's no
// settings API yet (see docs/EXECUTION_PLAN.md, out-of-scope until CNT-01's
// area grows a site-settings endpoint). Account fields are read-only: they
// come straight from the real logged-in session.

function SettingsPage() {
  const session = getSession()
  const [name, setName] = useState(currentSite.name)
  const [tagline, setTagline] = useState(currentSite.tagline)
  const [saved, setSaved] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(true)
  }

  return (
    <>
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
      </div>

      <div className="settings-grid">
        <section className="settings-card">
          <h2 className="settings-card-title">Site Identity</h2>
          <form className="settings-form" onSubmit={handleSubmit}>
            <label htmlFor="site-name">Site Title</label>
            <input id="site-name" value={name} onChange={(event) => setName(event.target.value)} />

            <label htmlFor="site-tagline">Tagline</label>
            <input id="site-tagline" value={tagline} onChange={(event) => setTagline(event.target.value)} />

            <button type="submit" className="settings-save">
              Save Changes
            </button>
            {saved ? <p className="settings-saved-note">Saved — locally only, there's no settings API yet.</p> : null}
          </form>
        </section>


        <section className="settings-card">
          <h2 className="settings-card-title">Your Account</h2>
          <dl className="settings-account">
            <div>
              <dt>Name</dt>
              <dd>{session?.user.name ?? '—'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{session?.user.email ?? '—'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd className="settings-role">{session?.memberships[0]?.role ?? '—'}</dd>
            </div>
          </dl>
          <p className="settings-account-note">Editing account details isn't wired up yet.</p>
        </section>

        <SiteAddressCard />
      </div>
    </>
  )
}

type AddressStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; subdomain: string }
  | { kind: 'error'; message: string }

// The public address of the site, `<subdomain>.<root domain>` (D-030). Saved
// through the real API, which also enforces every rule shown here (D-031).
// The old address stops working the moment this saves — no redirect.
function SiteAddressCard() {
  const session = getSession()
  const canEdit = canManageSite(session?.memberships[0]?.role)
  const [saved, setSaved] = useState(currentSubdomain() ?? '')
  const [draft, setDraft] = useState(saved)
  const [status, setStatus] = useState<AddressStatus>({ kind: 'idle' })

  const next = draft.trim().toLowerCase()
  const unchanged = next === saved

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (unchanged) return
    const confirmed = window.confirm(
      `Change your site address to ${siteUrl('/', next)}?\n\n` +
        `${siteUrl('/', saved)} will stop working immediately. Anyone using the old address will see "There's no site at this address".`,
    )
    if (!confirmed) return

    setStatus({ kind: 'saving' })
    try {
      const site = await updateSubdomain(next)
      setSaved(site.subdomain)
      setDraft(site.subdomain)
      setStatus({ kind: 'saved', subdomain: site.subdomain })
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof ApiError ? error.message : 'Could not reach the server. Try again.',
      })
    }
  }

  return (
    <section className="settings-card">
      <h2 className="settings-card-title">Site Address</h2>
      <form className="settings-form" onSubmit={handleSubmit}>
        <label htmlFor="site-subdomain">Subdomain</label>
        <div className="settings-address-row">
          <span className="settings-address-affix">{siteAddressParts.prefix}</span>
          <input
            id="site-subdomain"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setStatus({ kind: 'idle' })
            }}
            disabled={!canEdit || status.kind === 'saving'}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="site-subdomain-help"
          />
          <span className="settings-address-affix">{siteAddressParts.suffix}</span>
        </div>
        <p id="site-subdomain-help" className="settings-help">
          {canEdit
            ? 'Lowercase letters, numbers and hyphens, 3–63 characters. Changing it breaks the old address straight away.'
            : 'Only owners and administrators can change the site address.'}
        </p>

        <div className="settings-url-row">
          <a href={siteUrl('/', saved)} target="_blank" rel="noreferrer" className="settings-url-visit">
            Visit {siteUrl('/', saved)}
            <span aria-hidden="true">&#8599;</span>
          </a>
        </div>

        {canEdit ? (
          <button type="submit" className="settings-save" disabled={unchanged || status.kind === 'saving'}>
            {status.kind === 'saving' ? 'Saving…' : 'Change Address'}
          </button>
        ) : null}
        {status.kind === 'saved' ? (
          <p className="settings-saved-note">Saved. Your site is now at {siteUrl('/', status.subdomain)}</p>
        ) : null}
        {status.kind === 'error' ? (
          <p className="settings-error-note" role="alert">
            {status.message}
          </p>
        ) : null}
      </form>
    </section>
  )
}

export default SettingsPage
