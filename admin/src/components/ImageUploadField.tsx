import { useRef, useState, type ChangeEvent } from 'react'
import type { CustomFieldRender } from '@puckeditor/core'
import { uploadMedia } from '../lib/mediaApi'
import './ImageUploadField.css'

// Puck's `type: 'custom'` field render — used in place of a plain `{ type:
// 'text' }` for every image `src` in puck/config.tsx, so an author can either
// paste a URL or upload a file from their computer, without giving up the
// text input (an already-hosted image still just needs its URL pasted in).
export const ImageUploadField: CustomFieldRender<string> = ({ value, onChange, readOnly }) => {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
          onChange={(event) => onChange(event.target.value)}
        />
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
