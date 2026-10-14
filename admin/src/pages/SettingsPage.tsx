import { useState, type FormEvent } from 'react'
import { getActiveMembership } from '../lib/activeSite'
import { Link } from 'react-router'
import { ApiError } from '../lib/api'
import { canManageSite, ROLE_LABELS } from '../lib/roles'
import { updateSubdomain } from '../lib/siteApi'
import { currentSubdomain, siteAddressParts, siteUrl } from '../data/site'
import SiteIdentityCard from '../components/SiteIdentityCard'
import CustomDomainCard from '../components/CustomDomainCard'
import ThemeCard from '../components/ThemeCard'
import './SettingsPage.css'

// Everything here belongs to the active site (MSI-05). What belongs to the person — name, email, every site they
// are in — is on the Account page, outside any site.

function SettingsPage() {
  const membership = getActiveMembership()

  return (
    <>
      <div className="settings-header">
        <h1 className="settings-title">Site settings</h1>
        <p className="settings-account-note">
          {membership?.siteName} · your role here: <span className="settings-role">{membership ? ROLE_LABELS[membership.role] : '—'}</span>
          {' · '}
          <Link to="/account">Your account</Link> has your name, email and every site you belong to.
        </p>
      </div>

      <div className="settings-grid">
        <SiteIdentityCard />

        <SiteAddressCard />
        <CustomDomainCard />
        <ThemeCard />
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
  const canEdit = canManageSite(getActiveMembership()?.role)
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
