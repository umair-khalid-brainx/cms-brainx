import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { getActiveMembership } from '../lib/activeSite'
import { ApiError } from '../lib/api';
import { createRedirect, deleteRedirect, listRedirects, type Redirect } from '../lib/redirectsApi';
import { canPublishContent } from '../lib/roles';
import { siteUrl } from '../data/site';
import './PagesListPage.css';
import './RedirectsPage.css';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

/**
 * Where old addresses send visitors (GOV-05). Most arrive by themselves, when a published
 * page's address changes; staff add others by hand (a retired campaign URL, an old site's
 * links). Anyone can look; adding and removing needs publish rights, like the API.
 */
function RedirectsPage() {
  const id = useId();
  const mayEdit = canPublishContent(getActiveMembership()?.role);
  const fromRef = useRef<HTMLInputElement>(null);
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listRedirects()
      .then((rows) => {
        if (cancelled) return;
        setRedirects(rows);
        setLoad({ status: 'ready' });
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setLoad({
            status: 'error',
            message: caught instanceof Error ? caught.message : 'Couldn’t load redirects',
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (saving || !from.trim() || !to.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createRedirect(from, to);
      // It's saved: clear the form and say so before anything else can fail.
      setFrom('');
      setTo('');
      setAnnouncement(`Added. ${created.fromPath} now sends visitors to ${created.toPath}.`);
      fromRef.current?.focus();
      // Re-read the list: adding one can re-point others that led to its old address.
      // If only this fails, the redirect is still added; the list catches up on reload.
      await listRedirects()
        .then(setRedirects)
        .catch(() => setRedirects((rows) => [created, ...rows]));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Couldn’t add the redirect. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(redirect: Redirect) {
    if (!window.confirm(`Delete the redirect from ${redirect.fromPath}? Visitors to that address will get “page not found”.`))
      return;
    setBusyId(redirect.id);
    setDeleteError(null);
    try {
      await deleteRedirect(redirect.id);
      setRedirects((rows) => rows.filter((row) => row.id !== redirect.id));
      setAnnouncement(`Deleted the redirect from ${redirect.fromPath}.`);
    } catch (caught) {
      setDeleteError(
        caught instanceof ApiError ? caught.message : 'Couldn’t delete the redirect. Check your connection and try again.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="redirects">
      <div className="pages-header">
        <h1 className="pages-title">Redirects</h1>
        <span className="pages-count">
          {redirects.length} {redirects.length === 1 ? 'redirect' : 'redirects'}
        </span>
      </div>
      <p className="redirects-intro">
        When a published page’s address changes, its old address is added here automatically, so links to it keep working.
      </p>

      <p className="redirects-announcer" role="status" aria-live="polite">
        {announcement}
      </p>

      {mayEdit ? (
        <form className="redirects-form" onSubmit={handleAdd} noValidate>
          <div className="redirects-field">
            <label htmlFor={`${id}-from`}>Old address</label>
            <input
              ref={fromRef}
              id={`${id}-from`}
              value={from}
              placeholder="/old-page"
              autoComplete="off"
              spellCheck={false}
              aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
              aria-invalid={error ? true : undefined}
              onChange={(event) => {
                setFrom(event.target.value);
                setError(null);
              }}
            />
          </div>
          <span className="redirects-arrow" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path
                d="M3 10h13m-5-5 5 5-5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="redirects-field">
            <label htmlFor={`${id}-to`}>Sends visitors to</label>
            <input
              id={`${id}-to`}
              value={to}
              placeholder="/new-page or https://…"
              autoComplete="off"
              spellCheck={false}
              aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
              aria-invalid={error ? true : undefined}
              onChange={(event) => {
                setTo(event.target.value);
                setError(null);
              }}
            />
          </div>
          <button type="submit" className="redirects-add" disabled={saving || !from.trim() || !to.trim()}>
            {saving ? 'Adding…' : 'Add redirect'}
          </button>
          <p id={`${id}-hint`} className="redirects-hint">
            Old addresses are paths on {siteUrl('/')}. The new one can be a path here or a full address on another site.
          </p>
          {error ? (
            <p id={`${id}-error`} className="redirects-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <p className="redirects-hint">Only people who can publish can add or delete redirects.</p>
      )}

      {deleteError ? (
        <p className="redirects-error redirects-delete-error" role="alert">
          {deleteError}
        </p>
      ) : null}

      {load.status === 'loading' ? (
        <p className="pages-loading">Loading…</p>
      ) : load.status === 'error' ? (
        <p className="pages-error">Couldn’t load redirects: {load.message}</p>
      ) : redirects.length === 0 ? (
        <p className="redirects-empty">No redirects yet.</p>
      ) : (
        // Its own scroll on a narrow screen, so the page never scrolls sideways.
        <div className="redirects-table-wrap">
          <table className="pages-table">
            <thead>
              <tr>
                <th>Old address</th>
                <th>Sends visitors to</th>
                <th>Added</th>
                {mayEdit ? (
                  <th>
                    <span className="redirects-sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {redirects.map((redirect) => (
                <tr key={redirect.id}>
                  <td className="pages-row-path">{redirect.fromPath}</td>
                  <td className="pages-row-path">{redirect.toPath}</td>
                  <td className="redirects-made">
                    {redirect.source === 'auto' ? (
                      <span className="redirects-badge">Automatic</span>
                    ) : (
                      <span className="redirects-badge redirects-badge-manual">By hand</span>
                    )}{' '}
                    {new Date(redirect.createdAt).toLocaleDateString()}
                    {redirect.createdBy ? `, ${redirect.createdBy}` : ''}
                  </td>
                  {mayEdit ? (
                    <td className="redirects-actions">
                      <button
                        type="button"
                        className="redirects-delete"
                        disabled={busyId === redirect.id}
                        aria-label={`Delete the redirect from ${redirect.fromPath}`}
                        onClick={() => handleDelete(redirect)}
                      >
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RedirectsPage;
