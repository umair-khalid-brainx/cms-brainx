import { useEffect, useState } from 'react';
import { getActiveMembership } from '../lib/activeSite'
import { Link } from '../lib/siteRouter';
import { listReviewQueue, type ReviewItem } from '../lib/contentApi';
import { canReviewContent } from '../lib/roles';
import { waitingFor } from '../lib/workflow';
import './PagesListPage.css';
import './ReviewPage.css';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: ReviewItem[] };

/**
 * Pages and entries waiting for review, oldest first (GOV-07). Approving and sending back happen in the
 * editor, where the reviewer sees the page itself: the queue only says what is waiting and since when.
 */
function ReviewPage() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const canReview = canReviewContent(getActiveMembership()?.role);

  useEffect(() => {
    if (!canReview) return;
    let cancelled = false;
    listReviewQueue()
      .then((items) => {
        if (!cancelled) setLoad({ status: 'ready', items });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: error instanceof Error ? error.message : 'Couldn’t load the review queue' });
      });
    return () => {
      cancelled = true;
    };
  }, [canReview]);

  if (!canReview) {
    return (
      <div className="review">
        <h1 className="pages-title">Review</h1>
        <p className="review-intro">Only owners, administrators and editors review submitted pages.</p>
      </div>
    );
  }

  const now = new Date();
  return (
    <div className="review">
      <div className="pages-header">
        <h1 className="pages-title">Review</h1>
        <span className="pages-count">{load.status === 'ready' ? `${load.items.length} waiting` : ''}</span>
      </div>
      <p className="review-intro">Pages people have submitted for review. Open one to read it, then approve it or send it back with a note.</p>

      {load.status === 'loading' && <p className="pages-loading">Loading…</p>}
      {load.status === 'error' && <p className="pages-error">Couldn’t load the review queue: {load.message}</p>}
      {load.status === 'ready' && load.items.length === 0 && (
        <p className="review-empty">Nothing is waiting for review. When someone submits a page, it shows up here.</p>
      )}

      {load.status === 'ready' && load.items.length > 0 && (
        <table className="pages-table review-table stack-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Kind</th>
              <th>Submitted by</th>
              <th>Waiting</th>
              <th>
                <span className="admin-visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {load.items.map((item) => (
              <tr key={item.id}>
                <td className="stack-primary">
                  <Link to={`/editor/${item.slug}`} className="pages-row-title">
                    {item.title}
                  </Link>
                  <span className="review-path">{item.path}</span>
                </td>
                <td data-label="Kind">{item.type?.singularName ?? 'Page'}</td>
                <td data-label="Submitted by">{item.submittedBy?.name ?? 'A removed user'}</td>
                <td data-label="Waiting">
                  {item.submittedAt ? (
                    <time dateTime={item.submittedAt} title={new Date(item.submittedAt).toLocaleString()}>
                      {waitingFor(item.submittedAt, now)}
                    </time>
                  ) : null}
                </td>
                <td className="pages-row-actions stack-actions">
                  <Link to={`/editor/${item.slug}`} className="review-open" aria-label={`Review “${item.title}”`}>
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ReviewPage;
