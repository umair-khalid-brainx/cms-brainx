import { useRef, useState, type ChangeEvent } from 'react'
import type { CustomFieldRender } from '@puckeditor/core'
import { uploadMedia } from '../lib/mediaApi'
import MediaLibraryModal from './MediaLibraryModal'
import './ImageUploadField.css'

// Puck's `type: 'custom'` field render — used in place of a plain `{ type:
// 'text' }` for every image `src` in puck/config.tsx, so an author can either
// paste a URL, upload a file from their computer, or pick one already
// uploaded elsewhere (MED-03), without giving up the text input (an
// already-hosted image still just needs its URL pasted in).
export const ImageUploadField: CustomFieldRender<string> = ({ value, onChange, readOnly }) => {
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
      const { url } = await uploadMedia(file)
      onChange(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleBrowseSelect(url: string) {
    onChange(url)
    setBrowsing(false)
  }

  return (
    <div className="image-upload-field">
      <input
        type="text"
        className="image-upload-input"
        value={value ?? ''}
        placeholder="https://…"
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
        <button
          type="button"
          className="image-upload-button"
          disabled={readOnly}
          title="Browse Library"
          onClick={() => setBrowsing(true)}
        >
          Browse
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
      {browsing ? <MediaLibraryModal onSelect={handleBrowseSelect} onClose={() => setBrowsing(false)} /> : null}
    </div>
  )
}
