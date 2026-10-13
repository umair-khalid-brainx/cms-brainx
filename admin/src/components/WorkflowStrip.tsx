import type { Page } from '../lib/contentApi';
import { whenLabel } from '../lib/revisions';
import { scheduleLabel, timeZoneName, waitingFor, type EditorAccess } from '../lib/workflow';
import './WorkflowStrip.css';

type Props = {
  page: Page;
  /** "page", or the entry's kind in lower case. */
  kind: string;
  access: EditorAccess;
  busy: boolean;
  onApprove: () => void;
  onSendBack: () => void;
  onWithdraw: () => void;
  onPublishNow: () => void;
  onUnschedule: () => void;
};

/**
 * One line under the editor's top bar saying where the page stands in review and scheduling, and what this
 * person can do about it there (GOV-07). Shows nothing for an ordinary draft or live page. A reviewer's note is
 * quoted in full, because it is the reason the writer opened the page.
 */
function WorkflowStrip({ page, kind, access, busy, onApprove, onSendBack, onWithdraw, onPublishNow, onUnschedule }: Props) {
  if (page.status === 'in_review') {
    const who = page.submittedBy?.name ?? 'Someone';
    return (
      <section className="wf-strip wf-strip-review" aria-label="Review">
        <p className="wf-strip-text">
          <strong>Waiting for review.</strong> {who} submitted it
          {page.submittedAt ? (
            <>
              {' '}
              <time dateTime={page.submittedAt} title={new Date(page.submittedAt).toLocaleString()}>
                {waitingFor(page.submittedAt) === 'just now' ? 'just now' : `${waitingFor(page.submittedAt)} ago`}
              </time>
            </>
          ) : null}
          . {access.review ? `Read it through, then approve it or send it back.` : `It can’t be changed until it’s reviewed.`}
        </p>
        <div className="wf-strip-actions">
          {access.withdraw && (
            <button type="button" className="wf-button" onClick={onWithdraw} disabled={busy}>
              {access.review ? 'Back to draft' : 'Withdraw to edit'}
            </button>
          )}
          {access.review && (
            <>
              <button type="button" className="wf-button" onClick={onSendBack} disabled={busy} aria-haspopup="dialog">
                Send back
              </button>
              <button type="button" className="wf-button wf-button-primary" onClick={onApprove} disabled={busy} aria-haspopup="dialog">
                Approve
              </button>
            </>
          )}
        </div>
      </section>
    );
  }

  if (page.status === 'scheduled' && page.publishAt) {
    return (
      <section className="wf-strip wf-strip-scheduled" aria-label="Schedule">
        <p className="wf-strip-text">
          <strong>
            Goes live <time dateTime={page.publishAt}>{scheduleLabel(page.publishAt)}</time>
          </strong>{' '}
          ({timeZoneName()}).{page.scheduledBy ? ` Scheduled by ${page.scheduledBy.name}.` : ''} Locked until then.
        </p>
        {access.manageSchedule && (
          <div className="wf-strip-actions">
            <button type="button" className="wf-button" onClick={onUnschedule} disabled={busy}>
              Unschedule
            </button>
            <button type="button" className="wf-button wf-button-primary" onClick={onPublishNow} disabled={busy}>
              Publish now
            </button>
          </div>
        )}
      </section>
    );
  }

  // Sent back by a reviewer, or put back to draft by the scheduler: the note says why.
  if (page.status === 'draft' && page.reviewNote) {
    const by = page.reviewedBy?.name;
    return (
      <section className="wf-strip wf-strip-note" aria-label="Review note">
        <div className="wf-strip-text">
          <p>
            <strong>{by ? `${by} sent this ${kind} back` : `This ${kind} didn’t go live`}</strong>
            {page.reviewedAt ? ` at ${whenLabel(page.reviewedAt)}` : ''}.
            {access.submit ? ' Make the changes, then submit it again.' : ''}
          </p>
          <blockquote className="wf-note">{page.reviewNote}</blockquote>
        </div>
      </section>
    );
  }

  if (access.readOnlyNote) {
    return (
      <section className="wf-strip wf-strip-plain" aria-label="Read only">
        <p className="wf-strip-text">{access.readOnlyNote}</p>
      </section>
    );
  }
  return null;
}

export default WorkflowStrip;
