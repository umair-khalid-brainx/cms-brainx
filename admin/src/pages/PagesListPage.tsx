import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { archivePage, deletePage, listArchivedPages, listPages, type PageSummary } from '../lib/contentApi';
import { siteUrl } from '../data/site';
import './PagesListPage.css';

type Tab = 'active' | 'archived';
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

function PagesListPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [archived, setArchived] = useState<PageSummary[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
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

  async function handleArchive(page: PageSummary) {
    if (!window.confirm(`Archive "${page.title}"? It will be hidden from the site and moved to the Archived tab.`)) return;
    setBusySlug(page.slug);
    setActionError(null);
    try {
      await archivePage(page.slug);
      setPages((prev) => prev.filter((p) => p.slug !== page.slug));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not archive this page');
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
      {actionError && <p className="pages-error">{actionError}</p>}

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
              <tr key={page.slug}>
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
                    className="pages-row-delete"
                    disabled={busySlug === page.slug}
                    onClick={() => handleArchive(page)}
                  >
                    {busySlug === page.slug ? 'Archiving…' : 'Archive'}
                  </button>
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
