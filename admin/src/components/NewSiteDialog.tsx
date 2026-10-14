import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { siteAddressParts } from '../data/site'
import { createSite } from '../lib/siteApi'
import { ApiError } from '../lib/api'
import { normaliseSlug } from '../lib/slug'
import './WorkflowStrip.css'
import './NewSiteDialog.css'

type Props = { open: boolean; onClose: () => void }

/** A site's address from its title: `Harbour & Co.` → `harbour-co`. The person can still edit it. */
function addressFrom(name: string): string {
  return normaliseSlug(name).slice(0, 63)
}

/** Name and address for a new, empty site (MSI-04). Creating it makes the person its owner and opens it. */
export default function NewSiteDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [addressEdited, setAddressEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setName('')
      setAddress('')
      setAddressEdited(false)
      setError(null)
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const site = await createSite({ name: name.trim(), subdomain: address.trim().toLowerCase() })
      onClose()
      navigate(`/sites/${site.id}/dashboard`)
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Could not reach the server. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      className="wf-dialog"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault()
      }}
    >
      <form className="wf-dialog-inner" onSubmit={submit}>
        <h2 id={`${id}-title`}>New site</h2>
        <p className="wf-hint">An empty site with its own pages, media and team. You become its owner.</p>
        <div className="wf-field">
          <label htmlFor={`${id}-name`}>Site title</label>
          <input
            id={`${id}-name`}
            value={name}
            maxLength={100}
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value)
              if (!addressEdited) setAddress(addressFrom(event.target.value))
            }}
          />
        </div>
        <div className="wf-field">
          <label htmlFor={`${id}-address`}>Address</label>
          <div className="new-site-address">
            <span>{siteAddressParts.prefix}</span>
            <input
              id={`${id}-address`}
              value={address}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setAddress(event.target.value)
                setAddressEdited(true)
              }}
            />
            <span>{siteAddressParts.suffix}</span>
          </div>
          <p className="wf-hint">Lowercase letters, numbers and hyphens, 3–63 characters.</p>
        </div>
        {error && (
          <p className="wf-error" role="alert">
            {error}
          </p>
        )}
        <div className="wf-dialog-actions">
          <button type="button" className="wf-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="wf-button wf-button-primary" disabled={busy || !name.trim() || !address.trim()}>
            {busy ? 'Creating…' : 'Create site'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
