import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { getActiveMembership } from '../lib/activeSite'
import {
  deleteMedia,
  formatBadge,
  getMediaUsage,
  isDocument,
  listMedia,
  previewUrl,
  replaceMedia,
  typeLabel,
  uploadMedia,
  UPLOAD_ACCEPT,
  type MediaItem,
  type MediaUsage,
} from '../lib/mediaApi';
import { FileTile } from '../components/FileTile';
import { MediaDetailsForm } from '../components/MediaDetailsForm';
import { canArchiveContent, canWriteContent } from '../lib/roles';
import './MediaPage.css';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type UsageState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; pages: MediaUsage[] };

function MediaPage() {
  // Affordance only (admin/CLAUDE.md invariant 3): a Viewer browses without Upload, Replace or Delete (GOV-07),
  // and Delete follows the API's content:delete.
  const role = getActiveMembership()?.role;
  const canWrite = canWriteContent(role);
  const canDelete = canArchiveContent(role);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<UsageState>({ status: 'loading' });
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  // Replace keeps the URL, so this tab's own image cache would keep showing
  // the old bytes — a per-item counter appended as ?v= forces a refetch here.
  // Only for display: the stored URL (and what Copy URL gives) never changes.
  const [versions, setVersions] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  // Which item's panel is open right now. Async results (usage, replace) check
  // it so a slow response for a panel the user has since closed or switched
  // away from doesn't reopen it or land on the wrong one.
  const openIdRef = useRef<string | null>(null);
  useEffect(() => {
    openIdRef.current = selected?.id ?? null;
  }, [selected]);

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

  // The panel now holds a form, so closing it over unsaved text asks first.
  const detailsDirty = useRef(false);
  const handleDirtyChange = useCallback((dirty: boolean) => {
    detailsDirty.current = dirty;
  }, []);
  const requestClose = useCallback(() => {
    if (detailsDirty.current && !window.confirm('Discard your unsaved changes?')) return;
    detailsDirty.current = false;
    setSelected(null);
  }, []);

  useEffect(() => {
    if (!selected) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') requestClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selected, requestClose]);

  function displayUrl(item: MediaItem, url: string = item.url): string {
    const version = versions[item.id];
    return version ? `${url}?v=${version}` : url;
  }

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
    setReplaceError(null);
    setUsage({ status: 'loading' });
    openIdRef.current = item.id;
    getMediaUsage(item.id)
      .then((pages) => openIdRef.current === item.id && setUsage({ status: 'ready', pages }))
      .catch(() => openIdRef.current === item.id && setUsage({ status: 'error' }));
  }

  async function handleReplaceSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selected) return;
    if (file.type !== selected.mimetype) {
      setReplaceError(`The replacement must be the same type as the original (${selected.mimetype}), so its URL stays valid.`);
      return;
    }
    const id = selected.id;
    setReplacing(true);
    setReplaceError(null);
    try {
      const updated = await replaceMedia(id, file);
      setItems((prev) =>
        prev.map((i) =>
          i.id === updated.id ? { ...updated, alt: i.alt, title: i.title, description: i.description } : i,
        ),
      );
      setVersions((prev) => ({ ...prev, [updated.id]: Date.now() }));
      // Only refresh the panel if it's still showing this file — never reopen it. The
      // replace answer was read before any details saved meanwhile, so the words keep
      // what the panel already has.
      setSelected((current) =>
        current?.id === id
          ? { ...updated, alt: current.alt, title: current.title, description: current.description }
          : current,
      );
    } catch (error) {
      if (openIdRef.current === id) setReplaceError(error instanceof Error ? error.message : 'Replace failed');
    } finally {
      setReplacing(false);
    }
  }

  function handleDetailsSaved(updated: MediaItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    // Only refresh the panel if it's still showing this file — never reopen it.
    setSelected((current) => (current?.id === updated.id ? updated : current));
  }

  function deleteConfirmMessage(item: MediaItem): string {
    const base = `Delete "${item.filename}"? This can't be undone.`;
    if (usage.status === 'error') return `${base}\n\nCouldn't check which pages use this file.`;
    if (usage.status !== 'ready' || usage.pages.length === 0) return base;
    const list = usage.pages.map((page) => `• ${page.title} (${page.path}, ${page.status})`).join('\n');
    const count = usage.pages.length === 1 ? '1 page uses' : `${usage.pages.length} pages use`;
    return `${count} this file and will show a broken ${isDocument(item) ? 'link' : 'image'}:\n${list}\n\n${base}`;
  }

  async function handleDelete(item: MediaItem) {
    if (!window.confirm(deleteConfirmMessage(item))) return;
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
        {canWrite && (
          <>
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
              accept={UPLOAD_ACCEPT}
              className="media-hidden-input"
              onChange={handleFileSelected}
            />
          </>
        )}
      </div>

      {load.status === 'error' && <p className="media-error">{load.message}</p>}
      {load.status === 'loading' && <p className="media-loading">Loading…</p>}
      {uploadError && <p className="media-error">{uploadError}</p>}

      {load.status === 'ready' && items.length === 0 && <p className="media-empty">No media yet — upload your first file.</p>}

      {load.status === 'ready' && items.length > 0 && (
        <div className="media-grid">
          {items.map((item) => (
            <button type="button" key={item.id} className="media-card" onClick={() => openDetail(item)}>
              <span className="media-thumb-frame">
                {isDocument(item) ? (
                  <FileTile mimetype={item.mimetype} />
                ) : item.mimetype.startsWith('video/') ? (
                  <>
                    <video className="media-thumb" src={displayUrl(item)} muted preload="metadata" />
                    <span className="media-play" aria-hidden="true" />
                  </>
                ) : (
                  <img
                    className={`media-thumb${item.mimetype === 'image/svg+xml' ? ' media-thumb--contain' : ''}`}
                    src={displayUrl(item, previewUrl(item))}
                    alt={item.alt || item.title || ''}
                    loading="lazy"
                  />
                )}
                {formatBadge(item) && <span className="media-format">{formatBadge(item)}</span>}
              </span>
              <span className="media-card-name" title={item.filename}>
                {item.title || item.filename}
              </span>
              <span className="media-card-size">{formatBytes(item.size)}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="media-detail-backdrop" onClick={requestClose}>
          <div className="media-detail" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="media-detail-close" onClick={requestClose} aria-label="Close">
              &times;
            </button>
            {isDocument(selected) ? (
              <>
                <FileTile mimetype={selected.mimetype} size="large" />
                <a className="media-detail-open" href={displayUrl(selected)} target="_blank" rel="noopener noreferrer">
                  Open file
                </a>
              </>
            ) : selected.mimetype.startsWith('video/') ? (
              <video className="media-detail-preview" src={displayUrl(selected)} controls />
            ) : (
              <img className="media-detail-preview" src={displayUrl(selected)} alt={selected.alt || selected.title || ''} />
            )}
            <MediaDetailsForm
              key={selected.id}
              item={selected}
              onSaved={handleDetailsSaved}
              onDirtyChange={handleDirtyChange}
              readOnly={!canWrite}
            />
            <dl className="media-detail-meta">
              <dt>File</dt>
              <dd>{selected.filename}</dd>
              <dt>Type</dt>
              <dd>{typeLabel(selected.mimetype)}</dd>
              <dt>Size</dt>
              <dd>{formatBytes(selected.size)}</dd>
              <dt>Uploaded</dt>
              <dd>
                {new Date(selected.createdAt).toLocaleDateString()} by {selected.uploadedBy.name}
              </dd>
              <dt>Used on</dt>
              <dd>
                {usage.status === 'loading' && 'Checking…'}
                {usage.status === 'error' && "Couldn't check"}
                {usage.status === 'ready' && usage.pages.length === 0 && 'No pages'}
                {usage.status === 'ready' && usage.pages.length > 0 && (
                  <ul className="media-detail-usage">
                    {usage.pages.map((page) => (
                      <li key={page.id}>
                        {page.title} <span className="media-detail-usage-status">({page.status})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </dl>
            <div className="media-detail-url-row">
              <input className="media-detail-url" readOnly value={selected.url} />
              <button type="button" className="media-detail-copy" onClick={() => handleCopy(selected.url)}>
                {copied ? 'Copied' : 'Copy URL'}
              </button>
            </div>
            {replaceError && <p className="media-error">{replaceError}</p>}
            {deleteError && <p className="media-error">{deleteError}</p>}
            {(canWrite || canDelete) && (
              <div className="media-detail-actions">
                {canWrite && (
                  <>
                    <button
                      type="button"
                      className="media-detail-replace"
                      disabled={replacing || deleting}
                      onClick={() => replaceInputRef.current?.click()}
                    >
                      {replacing ? 'Replacing…' : 'Replace file'}
                    </button>
                    <input
                      ref={replaceInputRef}
                      type="file"
                      accept={selected.mimetype}
                      className="media-hidden-input"
                      onChange={handleReplaceSelected}
                    />
                  </>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className="media-detail-delete"
                    disabled={deleting || replacing || usage.status === 'loading'}
                    onClick={() => handleDelete(selected)}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default MediaPage;
