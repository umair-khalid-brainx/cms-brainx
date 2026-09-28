import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { deleteMedia, listMedia, uploadMedia, type MediaItem } from '../lib/mediaApi';
import './MediaPage.css';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    listMedia()
      .then((result) => {
        if (cancelled) return;
        setItems(result);
        setLoad({ status: 'ready' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({ status: 'error', message: error instanceof Error ? error.message : 'Failed to load media' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelected(null);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const item = await uploadMedia(file);
      setItems((prev) => [item, ...prev]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard permission can be denied — the URL is already visible, not fatal.
    }
  }

  function openDetail(item: MediaItem) {
    setSelected(item);
    setCopied(false);
    setDeleteError(null);
  }

  async function handleDelete(item: MediaItem) {
    if (!window.confirm(`Delete "${item.filename}"? This can't be undone.`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMedia(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelected(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete this file');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="media-header">
        <h1 className="media-title">Media</h1>
        <span className="media-count">
          {load.status === 'ready' ? `${items.length} ${items.length === 1 ? 'file' : 'files'}` : ''}
        </span>
        <button
          type="button"
          className="media-upload-button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="media-hidden-input"
          onChange={handleFileSelected}
        />
      </div>

      {load.status === 'error' && <p className="media-error">{load.message}</p>}
      {load.status === 'loading' && <p className="media-loading">Loading…</p>}
      {uploadError && <p className="media-error">{uploadError}</p>}

      {load.status === 'ready' && items.length === 0 && <p className="media-empty">No media yet — upload your first file.</p>}

      {load.status === 'ready' && items.length > 0 && (
        <div className="media-grid">
          {items.map((item) => (
            <button type="button" key={item.id} className="media-card" onClick={() => openDetail(item)}>
              {item.mimetype.startsWith('video/') ? (
                <video className="media-thumb" src={item.url} muted />
              ) : (
                <img className="media-thumb" src={item.url} alt={item.filename} loading="lazy" />
              )}
              <span className="media-card-name">{item.filename}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="media-detail-backdrop" onClick={() => setSelected(null)}>
          <div className="media-detail" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="media-detail-close" onClick={() => setSelected(null)} aria-label="Close">
              &times;
            </button>
            {selected.mimetype.startsWith('video/') ? (
              <video className="media-detail-preview" src={selected.url} controls />
            ) : (
              <img className="media-detail-preview" src={selected.url} alt={selected.filename} />
            )}
            <dl className="media-detail-meta">
              <dt>File</dt>
              <dd>{selected.filename}</dd>
              <dt>Type</dt>
              <dd>{selected.mimetype}</dd>
              <dt>Size</dt>
              <dd>{formatBytes(selected.size)}</dd>
              <dt>Uploaded</dt>
              <dd>
                {new Date(selected.createdAt).toLocaleDateString()} by {selected.uploadedBy.name}
              </dd>
            </dl>
            <div className="media-detail-url-row">
              <input className="media-detail-url" readOnly value={selected.url} />
              <button type="button" className="media-detail-copy" onClick={() => handleCopy(selected.url)}>
                {copied ? 'Copied' : 'Copy URL'}
              </button>
            </div>
            {deleteError && <p className="media-error">{deleteError}</p>}
            <button
              type="button"
              className="media-detail-delete"
              disabled={deleting}
              onClick={() => handleDelete(selected)}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default MediaPage;
