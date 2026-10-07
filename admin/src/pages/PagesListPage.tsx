import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import Select, { type SelectOption } from '../components/Select';
import { getSession } from '../lib/auth';
import { deletePage, duplicatePage, listArchivedPages, listPages, setPageStatus, type PageStatus, type PageSummary } from '../lib/contentApi';
import { canArchiveContent, canPublishContent } from '../lib/roles';
import { siteUrl } from '../data/site';
import './PagesListPage.css';

type Tab = 'active' | 'archived';
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

const STATUS_LABELS: Record<PageStatus, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' };

// The row's dropdown lists every status except the one the page is already
// in, minus any the user's role can't move to (UI affordance only — the API
// enforces). Leaving or entering Archived needs the same right as archiving.
function statusOptions(current: PageStatus): SelectOption<PageStatus>[] {
  const role = getSession()?.memberships[0]?.role;
  const canArchive = canArchiveContent(role);
  return (Object.keys(STATUS_LABELS) as PageStatus[])
    .filter((status) => status !== current)
    .filter((status) => status !== 'published' || canPublishContent(role))
    .filter(() => current !== 'archived' || canArchive)
    .filter((status) => status !== 'archived' || canArchive)
    .map((value) => ({ value, label: STATUS_LABELS[value] }));
}

function PagesListPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [archived, setArchived] = useState<PageSummary[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // The copy just made, so its row can be highlighted and announced.
  const [justCopied, setJustCopied] = useState<PageSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    setJustCopied(null);
    (tab === 'active' ? listPages() : listArchivedPages())
      .then((result) => {
        if (cancelled) return;
        if (tab === 'active') setPages(result);
        else setArchived(result);
        setLoad({ status: 'ready' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({ status: 'error', message: error instanceof Error ? error.message : 'Failed to load pages' });
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  async function handleStatusChange(page: PageSummary, status: PageStatus) {
    if (status === 'archived' && !window.confirm(`Archive "${page.title}"? It will be hidden from the site and moved to the Archived tab.`)) return;
    setBusySlug(page.slug);
    setActionError(null);
    setJustCopied(null);
    try {
      const updated = await setPageStatus(page.slug, status);
      // A page crossing the archived line leaves this tab's list; any other
      // move (draft <-> published) just updates its row in place.
      if (page.status === 'archived') setArchived((prev) => prev.filter((p) => p.slug !== page.slug));
      else if (status === 'archived') setPages((prev) => prev.filter((p) => p.slug !== page.slug));
      else setPages((prev) => prev.map((p) => (p.slug === page.slug ? updated : p)));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not change this page’s status');
    } finally {
      setBusySlug(null);
    }
  }

  function statusMenu(page: PageSummary) {
    const options = statusOptions(page.status);
    if (options.length === 0) return null;
    return (
      <Select
        className="pages-row-status-menu"
        value={page.status}
        placeholder={busySlug === page.slug ? 'Saving…' : 'Change status'}
        options={options}
        disabled={busySlug === page.slug}
        onChange={(status) => handleStatusChange(page, status)}
      />
    );
  }

  async function handleDuplicate(page: PageSummary) {
    setBusySlug(page.slug);
    setActionError(null);
    try {
      const copy = await duplicatePage(page.slug);
      // Newest first, matching the API's order (updatedAt desc).
      setPages((prev) => [copy, ...prev]);
      setJustCopied(copy);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not duplicate this page');
    } finally {
      setBusySlug(null);
    }
  }

  async function handleDelete(page: PageSummary) {
    if (!window.confirm(`Permanently delete "${page.title}"? This can't be undone.`)) return;
    setBusySlug(page.slug);
    setActionError(null);
    try {
      await deletePage(page.slug);
      setArchived((prev) => prev.filter((p) => p.slug !== page.slug));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete this page');
    } finally {
      setBusySlug(null);
    }
  }

  const rows = tab === 'active' ? pages : archived;

  return (
    <>
      <div className="pages-header">
        <h1 className="pages-title">Pages</h1>
        <span className="pages-count">{load.status === 'ready' ? `${rows.length} ${tab === 'active' ? 'pages' : 'archived'}` : ''}</span>
        <Link to="/pages/new" className="pages-add">
          Add Page
        </Link>
      </div>

      <div className="pages-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'active'} className={`pages-tab ${tab === 'active' ? 'pages-tab-active' : ''}`} onClick={() => setTab('active')}>
          Pages
        </button>
        <button type="button" role="tab" aria-selected={tab === 'archived'} className={`pages-tab ${tab === 'archived' ? 'pages-tab-active' : ''}`} onClick={() => setTab('archived')}>
          Archived
        </button>
      </div>

      {load.status === 'error' && <p className="pages-error">{load.message}</p>}
      {load.status === 'loading' && <p className="pages-loading">Loading…</p>}
      {actionError && (
        <p className="pages-error" role="alert">
          {actionError}
        </p>
      )}
      <p className="pages-notice" aria-live="polite">
        {justCopied && tab === 'active' && (
          <>
            Created “{justCopied.title}” at {justCopied.path} as a draft.{' '}
            <Link to={`/editor/${justCopied.slug}`}>Open in editor</Link>
          </>
        )}
      </p>

      {load.status === 'ready' && rows.length === 0 && (
        <p className="pages-loading">{tab === 'active' ? 'No pages yet.' : 'No archived pages.'}</p>
      )}

      {load.status === 'ready' && rows.length > 0 && tab === 'active' && (
        <table className="pages-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Path</th>
              <th>Status</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.slug} className={justCopied?.slug === page.slug ? 'pages-row-new' : undefined}>
                <td>
                  <Link to={`/editor/${page.slug}`} className="pages-row-title">
                    {page.title}
                  </Link>
                </td>
                <td className="pages-row-path">{page.path}</td>
                <td>
                  <span className={`pages-status pages-status-${page.status}`}>{page.status}</span>
                </td>
                <td className="pages-row-actions">
                  <Link to={`/editor/${page.slug}`}>Edit</Link>
                  <a href={siteUrl(page.path)} target="_blank" rel="noreferrer">
                    View
                    <span aria-hidden="true">&#8599;</span>
                  </a>
                  <button
                    type="button"
                    className="pages-row-duplicate"
                    disabled={busySlug === page.slug}
                    onClick={() => handleDuplicate(page)}
                  >
                    {busySlug === page.slug ? 'Duplicating…' : 'Duplicate'}
                  </button>
                  {statusMenu(page)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {load.status === 'ready' && rows.length > 0 && tab === 'archived' && (
        <table className="pages-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Path</th>
              <th>Archived</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {archived.map((page) => (
              <tr key={page.slug}>
                <td className="pages-row-title">{page.title}</td>
                <td className="pages-row-path">{page.path}</td>
                <td className="pages-row-path">{page.archivedAt ? new Date(page.archivedAt).toLocaleDateString() : ''}</td>
                <td className="pages-row-actions">
                  {statusMenu(page)}
                  <button
                    type="button"
                    className="pages-row-delete"
                    disabled={busySlug === page.slug}
                    onClick={() => handleDelete(page)}
                  >
                    {busySlug === page.slug ? 'Deleting…' : 'Delete Permanently'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default PagesListPage;
