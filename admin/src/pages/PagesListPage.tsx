import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { deletePage, listPages, type PageSummary } from '../lib/contentApi';
import { siteUrl } from '../data/site';
import './PagesListPage.css';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

function PagesListPage() {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPages()
      .then((result) => {
        if (cancelled) return;
        setPages(result);
        setLoad({ status: 'ready' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({ status: 'error', message: error instanceof Error ? error.message : 'Failed to load pages' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(page: PageSummary) {
    if (!window.confirm(`Delete "${page.title}"? This can't be undone.`)) return;
    setDeletingSlug(page.slug);
    setDeleteError(null);
    try {
      await deletePage(page.slug);
      setPages((prev) => prev.filter((p) => p.slug !== page.slug));
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete this page');
    } finally {
      setDeletingSlug(null);
    }
  }

  return (
    <>
      <div className="pages-header">
        <h1 className="pages-title">Pages</h1>
        <span className="pages-count">{load.status === 'ready' ? `${pages.length} pages` : ''}</span>
      </div>

      {load.status === 'error' && <p className="pages-error">{load.message}</p>}
      {load.status === 'loading' && <p className="pages-loading">Loading…</p>}
      {deleteError && <p className="pages-error">{deleteError}</p>}

      {load.status === 'ready' && (
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
                    disabled={deletingSlug === page.slug}
                    onClick={() => handleDelete(page)}
                  >
                    {deletingSlug === page.slug ? 'Deleting…' : 'Delete'}
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
