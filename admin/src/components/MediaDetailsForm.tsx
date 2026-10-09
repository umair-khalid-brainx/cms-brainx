import { useEffect, useId, useState, type FormEvent } from 'react'
import { isImage, updateMediaDetails, type MediaItem } from '../lib/mediaApi'
import './MediaDetailsForm.css'

type SaveState = { status: 'idle' } | { status: 'saving' } | { status: 'saved' } | { status: 'error'; message: string }

const same = (field: string, saved: string | null) => field.trim() === (saved ?? '')

// The words that travel with a file (req. 4): alternative text for pictures,
// and a title and description for finding things later. Alternative text is the
// default for any page that leaves its own empty, so it is the one that matters
// to visitors using a screen reader and to search engines; title and description
// are for the library only (D-047).
export function MediaDetailsForm({
  item,
  onSaved,
  onDirtyChange,
}: {
  item: MediaItem
  onSaved: (updated: MediaItem) => void
  /** Lets the panel ask before closing over text that hasn't been saved. */
  onDirtyChange?: (dirty: boolean) => void
}) {
  const id = useId()
  const [alt, setAlt] = useState(item.alt ?? '')
  const [title, setTitle] = useState(item.title ?? '')
  const [description, setDescription] = useState(item.description ?? '')
  const [save, setSave] = useState<SaveState>({ status: 'idle' })
  const image = isImage(item)

  const dirty = (image && !same(alt, item.alt)) || !same(title, item.title) || !same(description, item.description)

  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => onDirtyChange?.(false)
  }, [dirty, onDirtyChange])

  function edit(setter: (value: string) => void) {
    return (event: { target: { value: string } }) => {
      setter(event.target.value)
      if (save.status !== 'saving') setSave({ status: 'idle' })
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!dirty || save.status === 'saving') return
    setSave({ status: 'saving' })
    try {
      const updated = await updateMediaDetails(item.id, {
        ...(image && { alt }),
        title,
        description,
      })
      onSaved(updated)
      setSave({ status: 'saved' })
    } catch (error) {
      setSave({ status: 'error', message: error instanceof Error ? error.message : 'Could not save these details' })
    }
  }

  return (
    <form className="media-details" onSubmit={handleSubmit}>
      <h3 className="media-details-heading">Details</h3>

      {image && (
        <div className="media-details-field">
          <label htmlFor={`${id}-alt`}>Alternative text</label>
          <input
            id={`${id}-alt`}
            type="text"
            value={alt}
            maxLength={500}
            aria-describedby={`${id}-alt-hint`}
            onChange={edit(setAlt)}
          />
          <p id={`${id}-alt-hint`} className="media-details-hint">
            Describe the picture for people who can’t see it. Any page that leaves its own description empty uses this.
          </p>
        </div>
      )}

      <div className="media-details-field">
        <label htmlFor={`${id}-title`}>Title</label>
        <input id={`${id}-title`} type="text" value={title} maxLength={200} onChange={edit(setTitle)} />
      </div>

      <div className="media-details-field">
        <label htmlFor={`${id}-description`}>Description</label>
        <textarea
          id={`${id}-description`}
          rows={3}
          value={description}
          maxLength={2000}
          aria-describedby={`${id}-description-hint`}
          onChange={edit(setDescription)}
        />
        <p id={`${id}-description-hint`} className="media-details-hint">
          Only shown here in the library, to help your team find the right file.
        </p>
      </div>

      <div className="media-details-actions">
        <button type="submit" className="media-details-save" disabled={!dirty || save.status === 'saving'}>
          {save.status === 'saving' ? 'Saving…' : 'Save details'}
        </button>
        <span className="media-details-status" role="status">
          {save.status === 'saved' && !dirty && 'Saved'}
        </span>
      </div>
      {save.status === 'error' && (
        <p className="media-details-error" role="alert">
          {save.message}
        </p>
      )}
    </form>
  )
}
