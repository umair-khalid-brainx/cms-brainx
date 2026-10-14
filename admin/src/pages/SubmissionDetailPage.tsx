import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Link } from '../lib/siteRouter';
import { formatDateTime, getSubmission, type Submission } from '../lib/submissionsApi';
import './SubmissionsPage.css';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; submission: Submission };

function SubmissionDetailPage() {
  const { id = '' } = useParams();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getSubmission(id)
      .then((submission) => !cancelled && setLoad({ status: 'ready', submission }))
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({ status: 'error', message: error instanceof Error ? error.message : 'Failed to load submission' });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      <Link to="/submissions" className="submissions-back">
        ← All submissions
      </Link>

      {load.status === 'loading' && <p className="submissions-muted">Loading…</p>}
      {load.status === 'error' && <p className="submissions-error">{load.message}</p>}

      {load.status === 'ready' && (
        <>
          <div className="submissions-header">
            <h1 className="submissions-title">{formatDateTime(load.submission.createdAt)}</h1>
            <span className="submissions-count">
              from {load.submission.pageTitle} <span className="submissions-path">{load.submission.pagePath}</span>
            </span>
          </div>

          <dl className="submission-answers">
            {load.submission.answers.map((answer) => (
              <div key={answer.name} className="submission-answer">
                <dt>{answer.label}</dt>
                {/* Plain text, never HTML: this is exactly what a visitor typed. */}
                <dd>{answer.value || <span className="submissions-muted">(left empty)</span>}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </>
  );
}

export default SubmissionDetailPage;
