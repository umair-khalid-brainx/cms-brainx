import { useEffect, useState } from 'react'
import { listMedia, type MediaItem } from '../lib/mediaApi'
import './MediaLibraryModal.css'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' }

type MediaLibraryModalProps = {
  onSelect: (url: string) => void
  onClose: () => void
  /** Mimetype prefix to filter the grid to — only images exist as pickable
      fields today, but a future video field can reuse this component. */
  accept?: string
}

// A picker over what's already been uploaded (MED-03) — separate from
// MediaPage.tsx's own grid (that one's a full page with a detail panel and
// Delete; this one's just "click a thumbnail to use it here" and closes
// itself). Both read the same GET /media list, no new endpoint needed.
function MediaLibraryModal({ onSelect, onClose, accept = 'image/' }: MediaLibraryModalProps) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    listMedia()
      .then((result) => {
        if (cancelled) return
        setItems(result.filter((item) => item.mimetype.startsWith(accept)))
        setLoad({ status: 'ready' })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoad({ status: 'error', message: error instanceof Error ? error.message : 'Failed to load media' })
      })
    return () => {
      cancelled = true
    }
  }, [accept])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="media-library-backdrop" onClick={onClose}>
      <div className="media-library-modal" onClick={(event) => event.stopPropagation()}>
        <div className="media-library-header">
          <h2 className="media-library-title">Choose an image</h2>
          <button type="button" className="media-library-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {load.status === 'loading' && <p className="media-library-loading">Loading…</p>}
        {load.status === 'error' && <p className="media-library-error">{load.message}</p>}
        {load.status === 'ready' && items.length === 0 && (
          <p className="media-library-empty">No media uploaded yet — use Upload instead.</p>
        )}

        {load.status === 'ready' && items.length > 0 && (
          <div className="media-library-grid">
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                className="media-library-card"
                title={item.filename}
                onClick={() => onSelect(item.url)}
              >
                <img className="media-library-thumb" src={item.url} alt={item.filename} loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MediaLibraryModal
