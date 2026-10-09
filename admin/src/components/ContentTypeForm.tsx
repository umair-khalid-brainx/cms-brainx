import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { siteUrl } from '../data/site'
import { singularize, suggestPrefix } from '../lib/contentTypes'
import { createContentType, updateContentType, type ContentType } from '../lib/typesApi'
import './ContentTypeForm.css'

// Create or edit a content type (TYP-01). The name suggests the singular name and
// the web address until the person types their own, so "Case studies" gives
// "Case study" and /case-studies without any typing; every rule is enforced by
// the API and its message is shown as written.
export function ContentTypeForm({
  type,
  onSaved,
  onClose,
}: {
  /** The type being edited; leave out to add one. */
  type?: ContentType
  onSaved: (saved: ContentType) => void
  onClose: () => void
}) {
  const id = useId()
  const editing = Boolean(type)
  const [name, setName] = useState(type?.name ?? '')
  const [singularName, setSingularName] = useState(type?.singularName ?? '')
  const [prefix, setPrefix] = useState(type?.prefix ?? '')
  // Once someone types in a field themselves, it stops following the name.
  const [singularTouched, setSingularTouched] = useState(editing)
  const [prefixTouched, setPrefixTouched] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstField = useRef<HTMLInputElement>(null)

  const addressLocked = Boolean(type?.locked)
  const dirty = !type
    ? name !== '' || singularName !== '' || prefix !== ''
    : name !== type.name || singularName !== type.singularName || prefix !== type.prefix

  useEffect(() => {
    firstField.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (dirty && !window.confirm('Discard your unsaved changes?')) return
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dirty, onClose])

  function changeName(value: string) {
    setName(value)
    if (!singularTouched) setSingularName(singularize(value))
    if (!prefixTouched && !addressLocked) setPrefix(suggestPrefix(value))
  }

  function requestClose() {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return
    onClose()
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const input = { name, singularName, prefix }
      const saved = type ? await updateContentType(type.id, input) : await createContentType(input)
      // The list endpoint adds the counts and the lock; the caller reloads it.
      onSaved({ ...(type ?? { entryCount: 0, locked: false, isBuiltIn: false }), ...saved })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this content type')
      setSaving(false)
    }
  }

  const example = siteUrl(`/${prefix || 'events'}/summer-fair`).replace(/^https?:\/\//, '')
  const ready = name.trim() !== '' && singularName.trim() !== '' && prefix.trim() !== ''

  return (
    <div className="type-form-backdrop" onClick={requestClose}>
      <div
        className="type-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={`${id}-title`} className="type-form-title">
          {type ? `Edit ${type.name}` : 'Add a content type'}
        </h2>
        {!type && (
          <p className="type-form-intro">
            A content type is a new kind of content with its own address, like events or case studies.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="type-form-field">
            <label htmlFor={`${id}-name`}>Name</label>
            <input
              ref={firstField}
              id={`${id}-name`}
              type="text"
              value={name}
              maxLength={60}
              placeholder="Events"
              aria-describedby={`${id}-name-hint`}
              onChange={(event) => changeName(event.target.value)}
            />
            <p id={`${id}-name-hint`} className="type-form-hint">
              What you call several of them. It appears in the menu.
            </p>
          </div>

          <div className="type-form-field">
            <label htmlFor={`${id}-singular`}>Name for one</label>
            <input
              id={`${id}-singular`}
              type="text"
              value={singularName}
              maxLength={60}
              placeholder="Event"
              aria-describedby={`${id}-singular-hint`}
              onChange={(event) => {
                setSingularName(event.target.value)
                setSingularTouched(true)
              }}
            />
            <p id={`${id}-singular-hint`} className="type-form-hint">
              Used on buttons, like “Add Event”.
            </p>
          </div>

          <div className="type-form-field">
            <label htmlFor={`${id}-prefix`}>Web address</label>
            <div className="type-form-address">
              <span className="type-form-slash" aria-hidden="true">
                /
              </span>
              <input
                id={`${id}-prefix`}
                type="text"
                value={prefix}
                maxLength={40}
                placeholder="events"
                disabled={addressLocked}
                aria-describedby={`${id}-prefix-hint`}
                onChange={(event) => {
                  setPrefix(event.target.value.toLowerCase())
                  setPrefixTouched(true)
                }}
              />
            </div>
            <p id={`${id}-prefix-hint`} className="type-form-hint">
              {addressLocked
                ? type?.isBuiltIn
                  ? 'This address is built in and can’t be changed.'
                  : 'This address is locked because the type already has entries. Changing it would break their links.'
                : (
                  <>
                    Each entry will live at <span className="type-form-example">{example}</span>. Use lowercase letters,
                    numbers and hyphens.
                  </>
                )}
            </p>
          </div>

          {error && (
            <p className="type-form-error" role="alert">
              {error}
            </p>
          )}

          <div className="type-form-actions">
            <button type="submit" className="type-form-save" disabled={saving || !ready || (editing && !dirty)}>
              {saving ? 'Saving…' : type ? 'Save changes' : 'Add type'}
            </button>
            <button type="button" className="type-form-cancel" onClick={requestClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
