import { useEffect, useId, useState, useSyncExternalStore, type FormEvent } from 'react'
import { getActiveMembership } from '../lib/activeSite'
import { ApiError } from '../lib/api'
import { subscribeSession } from '../lib/auth'
import { canManageSite } from '../lib/roles'
import { getSiteDetails, removeCustomDomain, setCustomDomain, type SiteDetails } from '../lib/siteApi'
import { dnsRecords, hostOf, isApexDomain } from '../lib/domains'
import { currentSubdomain, siteUrl } from '../data/site'

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; site: SiteDetails }

/**
 * Settings → Custom domain (DEP-02, D-066). An owner adds their own domain; it is saved as Pending and the card
 * shows the DNS record to add for it. Display only: nothing checks DNS or serves the site on the domain yet,
 * and the card says so rather than implying it is live.
 */
function CustomDomainCard() {
  const id = useId()
  const canEdit = canManageSite(getActiveMembership()?.role)
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  // Said to screen readers: the button's own text change isn't announced.
  const [copyNote, setCopyNote] = useState('')

  useEffect(() => {
    let cancelled = false
    getSiteDetails()
      .then((site) => {
        if (!cancelled) setLoad({ status: 'ready', site })
      })
      .catch((failure: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: failure instanceof Error ? failure.message : 'Couldn’t load the domain' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function run(step: () => Promise<SiteDetails>) {
    setBusy(true)
    setError(null)
    try {
      const site = await step()
      setLoad({ status: 'ready', site })
      setDraft('')
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Could not reach the server. Try again.')
    } finally {
      setBusy(false)
    }
  }

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.trim()) return
    void run(() => setCustomDomain(draft))
  }

  function handleRemove(domain: string) {
    if (!window.confirm(`Remove ${domain} from this site? You can add it again later.`)) return
    void run(removeCustomDomain)
  }

  async function copy(value: string) {
    // Cleared first, so copying the same value again is announced again.
    setCopyNote('')
    try {
      await navigator.clipboard.writeText(value)
      setCopied(value)
      setCopyNote(`Copied ${value}`)
      window.setTimeout(() => {
        setCopied((current) => (current === value ? null : current))
        setCopyNote((current) => (current === `Copied ${value}` ? '' : current))
      }, 2000)
    } catch {
      setCopied(null)
      setCopyNote(`Couldn’t copy. Select ${value} and copy it yourself.`)
    }
  }

  // Subscribed, so renaming the subdomain in Site Address (the card above) shows here at once: the record must
  // point at the address that works now, not the old one.
  const subdomain = useSyncExternalStore(subscribeSession, currentSubdomain)
  const freeHost = hostOf(siteUrl('/', subdomain))

  return (
    <section className="settings-card domain-card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="settings-card-title">
        Domains
      </h2>

      <h3 className="domain-heading">Free address</h3>
      <div className="domain-current">
        <code className="domain-name">{freeHost}</code>
        <span className="domain-badge domain-badge-verified">Active</span>
        <CopyButton value={freeHost} copied={copied} onCopy={copy} />
      </div>
      <p className="settings-help">Always works. Change it in Site Address.</p>

      <h3 className="domain-heading">Custom domain</h3>

      {load.status === 'loading' && <p className="settings-help">Loading…</p>}
      {load.status === 'error' && <p className="settings-error-note">{load.message}</p>}

      {load.status === 'ready' && !load.site.customDomain && (
        <>
          <p className="settings-help">Use your own address, like www.yourcompany.com, for this site. The free address keeps working.</p>
          {canEdit ? (
            <form className="settings-form domain-form" onSubmit={handleAdd}>
              <label htmlFor={`${id}-domain`}>Domain</label>
              <div className="domain-add-row">
                <input
                  id={`${id}-domain`}
                  value={draft}
                  placeholder="www.yourcompany.com"
                  onChange={(event) => {
                    setDraft(event.target.value)
                    setError(null)
                  }}
                  disabled={busy}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-error` : undefined}
                />
                <button type="submit" className="settings-save" disabled={busy || !draft.trim()}>
                  {busy ? 'Adding…' : 'Add domain'}
                </button>
              </div>
            </form>
          ) : (
            <p className="settings-help">Only owners and administrators can add a domain.</p>
          )}
        </>
      )}

      {load.status === 'ready' && load.site.customDomain && (
        <DomainDetails
          domain={load.site.customDomain}
          verified={load.site.domainStatus === 'verified'}
          target={freeHost}
          canEdit={canEdit}
          busy={busy}
          copied={copied}
          onCopy={copy}
          onRemove={handleRemove}
        />
      )}

      <p className="domain-copy-note" role="status">
        {copyNote}
      </p>
      {error && (
        <p id={`${id}-error`} className="settings-error-note" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

function DomainDetails({
  domain,
  verified,
  target,
  canEdit,
  busy,
  copied,
  onCopy,
  onRemove,
}: {
  domain: string
  verified: boolean
  target: string
  canEdit: boolean
  busy: boolean
  copied: string | null
  onCopy: (value: string) => void
  onRemove: (domain: string) => void
}) {
  const records = dnsRecords(domain, target)
  const apex = isApexDomain(domain)
  return (
    <>
      <div className="domain-current">
        <span className="domain-name">{domain}</span>
        <span className={`domain-badge ${verified ? 'domain-badge-verified' : 'domain-badge-pending'}`}>
          {verified ? 'DNS confirmed' : 'Pending'}
        </span>
      </div>
      <p className="settings-help">
        {verified
          ? 'The DNS record below is confirmed. Serving the site on this domain isn’t switched on yet, so keep using the free address.'
          : 'Not live yet. Add the record below where you manage this domain’s DNS (usually the company you bought it from). It can take up to 48 hours to take effect. Until the site is served on it, use the free address.'}
      </p>

      <h4 className="domain-records-title">DNS record to add</h4>
      {records.map((record) => (
        <dl key={`${record.type}-${record.name}`} className="domain-record">
          <div>
            <dt>Type</dt>
            <dd>{record.type}</dd>
          </div>
          <div>
            <dt>Name</dt>
            <dd>
              <code>{record.name}</code>
              <CopyButton value={record.name} copied={copied} onCopy={onCopy} />
            </dd>
          </div>
          <div>
            <dt>Points to</dt>
            <dd>
              <code>{record.value}</code>
              <CopyButton value={record.value} copied={copied} onCopy={onCopy} />
            </dd>
          </div>
        </dl>
      ))}
      {apex && (
        <p className="settings-help">
          {domain} looks like a bare domain, and most DNS providers don’t allow a CNAME there. If yours has no ALIAS
          (or ANAME) record, add www.{domain} here instead and forward {domain} to it.
        </p>
      )}

      {canEdit && (
        <button type="button" className="settings-secondary domain-remove" onClick={() => onRemove(domain)} disabled={busy}>
          {busy ? 'Removing…' : 'Remove domain'}
        </button>
      )}
    </>
  )
}

/** "Copy", then "Copied" for two seconds. The visible word is the label; what it copies is said beside it. */
function CopyButton({ value, copied, onCopy }: { value: string; copied: string | null; onCopy: (value: string) => void }) {
  return (
    <button type="button" className="domain-copy" onClick={() => onCopy(value)}>
      {copied === value ? 'Copied' : 'Copy'}
      <span className="domain-visually-hidden"> {value}</span>
    </button>
  )
}

export default CustomDomainCard
