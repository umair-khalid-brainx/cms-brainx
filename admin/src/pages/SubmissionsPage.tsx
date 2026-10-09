import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { formatDateTime, listSubmissions, type SubmissionSummary } from '../lib/submissionsApi';
import './SubmissionsPage.css';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

// Read-only (BLK-06). Status and internal notes arrive with BLK-08 (D-034).
function SubmissionsPage() {
  const [rows, setRows] = useState<SubmissionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSubmissions()
      .then((page) => {
        if (cancelled) return;
        setRows(page.items);
        setTotal(page.total);
        setNextCursor(page.nextCursor);
        setLoad({ status: 'ready' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({ status: 'error', message: error instanceof Error ? error.message : 'Failed to load submissions' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listSubmissions(nextCursor);
      setRows((prev) => [...prev, ...page.items]);
      setTotal(page.total);
      setNextCursor(page.nextCursor);
    } catch (error) {
      setMoreError(error instanceof Error ? error.message : 'Could not load more submissions');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <div className="submissions-header">
        <h1 className="submissions-title">Submissions</h1>
        <span className="submissions-count">{load.status === 'ready' ? `${total} received` : ''}</span>
      </div>

      {load.status === 'loading' && <p className="submissions-muted">Loading…</p>}
      {load.status === 'error' && <p className="submissions-error">{load.message}</p>}
      {load.status === 'ready' && rows.length === 0 && (
        <p className="submissions-muted">No submissions yet. Messages sent through a Contact form block on your site appear here.</p>
      )}

      {load.status === 'ready' && rows.length > 0 && (
        <table className="submissions-table">
          <thead>
            <tr>
              <th>Received</th>
              <th>Page</th>
              <th>Preview</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="submissions-row-date">
                  <Link to={`/submissions/${row.id}`} className="submissions-row-link">
                    {formatDateTime(row.createdAt)}
                  </Link>
                </td>
                <td>
                  {row.pageTitle} <span className="submissions-path">{row.pagePath}</span>
                </td>
                <td className="submissions-row-preview">{row.preview}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {load.status === 'ready' && rows.length > 0 && (
        <div className="submissions-more">
          <span className="submissions-muted">
            Showing {rows.length} of {total}
          </span>
          {nextCursor && (
            <button type="button" className="submissions-more-button" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
          {moreError && <span className="submissions-error">{moreError}</span>}
        </div>
      )}
    </>
  );
}

export default SubmissionsPage;
