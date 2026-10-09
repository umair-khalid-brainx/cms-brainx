import { useRef, useState, type ChangeEvent } from 'react'
import { FieldLabel, type CustomFieldRender } from '@puckeditor/core'
import { UPLOAD_ACCEPT, uploadMedia } from '../lib/mediaApi'
import MediaLibraryModal from './MediaLibraryModal'
import './ImageUploadField.css'

// A "media" field of a content type (TYP-02): a picture or a document from the
// site's library, chosen with Browse, uploaded with Upload, or pasted as an
// address. It shares ImageUploadField's look; the difference is that any file the
// library takes is allowed, not only images.
export const MediaField: CustomFieldRender<string> = ({ field, value, onChange, readOnly }) => {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      onChange((await uploadMedia(file)).url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    // Puck doesn't print a custom field's name, so the field wraps itself in Puck's own `FieldLabel`. A div,
    // not a label: the Upload, Browse and Clear buttons sit inside, and the text box is named directly.
    <FieldLabel label={field.label ?? ''} el="div" readOnly={readOnly}>
      <div className="image-upload-field">
        <input
          aria-label={field.label}
          type="text"
          className="image-upload-input"
          value={value ?? ''}
          placeholder="Choose a file"
          disabled={readOnly}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="image-upload-actions">
          <button
            type="button"
            className="image-upload-button"
            disabled={readOnly || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
          <button type="button" className="image-upload-button" disabled={readOnly} onClick={() => setBrowsing(true)}>
            Browse
          </button>
          {value && (
            <button type="button" className="image-upload-button" disabled={readOnly} onClick={() => onChange('')}>
              Clear
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            className="image-upload-hidden-input"
            onChange={handleFileSelected}
          />
        </div>
        {error ? <p className="image-upload-error">{error}</p> : null}
        {browsing ? (
          <MediaLibraryModal
            accept=""
            noun="file"
            onSelect={(url) => {
              onChange(url)
              setBrowsing(false)
            }}
            onClose={() => setBrowsing(false)}
          />
        ) : null}
      </div>
    </FieldLabel>
  )
}
