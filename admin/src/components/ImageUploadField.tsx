import { useRef, useState, type ChangeEvent } from 'react'
import type { CustomFieldRender } from '@puckeditor/core'
import { uploadMedia } from '../lib/mediaApi'
import './ImageUploadField.css'

// media.service.ts always serves an upload back under this static prefix
// (app.useStaticAssets(..., { prefix: '/uploads' })) — a reliable signature
// of "this value came from our own uploader" without needing a separate
// source flag stored alongside `src` in the content data.
function isUploadedUrl(url: string): boolean {
  return url.includes('/uploads/');
}

// Puck's `type: 'custom'` field render — used in place of a plain `{ type:
// 'text' }` for every image `src` in puck/config.tsx, so an author can either
// paste a URL or upload a file from their computer, without giving up the
// text input (an already-hosted image still just needs its URL pasted in).
// Once a value came from an upload, the URL itself isn't hand-editable —
// there's nothing sensible to type into an opaque uploaded-file path, so
// editing it directly would only ever break the reference. "Upload" still
// replaces it, and "Clear" hands the field back for a pasted URL.
export const ImageUploadField: CustomFieldRender<string> = ({ value, onChange, readOnly }) => {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const locked = !!value && isUploadedUrl(value)

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const { url } = await uploadMedia(file)
      onChange(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="image-upload-field">
      <div className="image-upload-row">
        <input
          type="text"
          className="image-upload-input"
          value={value ?? ''}
          placeholder="https://…"
          disabled={readOnly}
          readOnly={locked}
          title={locked ? 'Uploaded file — Clear to paste a URL instead, or Upload to replace it' : undefined}
          onChange={(event) => {
            if (locked) return
            onChange(event.target.value)
          }}
        />
        {locked ? (
          <button
            type="button"
            className="image-upload-clear"
            disabled={readOnly}
            title="Remove this image so you can paste a URL instead"
            onClick={() => onChange('')}
          >
            Clear
          </button>
        ) : null}
        <button
          type="button"
          className="image-upload-button"
          disabled={readOnly || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="image-upload-hidden-input"
          onChange={handleFileSelected}
        />
      </div>
      {error ? <p className="image-upload-error">{error}</p> : null}
    </div>
  )
}
