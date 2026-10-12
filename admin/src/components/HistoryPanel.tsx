import { useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '../lib/api';
import type { PageStatus } from '../lib/contentApi';
import {
  authorName,
  groupByDay,
  reasonLabel,
  restoreWarning,
  STATUS_LABEL,
  timeLabel,
  titleChanges,
  previousStatuses,
  whenLabel,
  type RevisionSummary,
} from '../lib/revisions';
import { listRevisions, restoreRevision, type RestoreResult } from '../lib/revisionsApi';
import './HistoryPanel.css';

type Props = {
  open: boolean;
  onClose: () => void;
  slug: string;
  status: PageStatus;
  /** "Page", or the type's singular name for an entry ("Post"). */
  kind: string;
  /** Restoring a live page needs publish rights, like publishing it (the API enforces; this only disables). */
  canRestoreLive: boolean;
  /** Why no version can be restored right now (in review, scheduled, or read-only for this person), or null (GOV-07). */
  restoreBlocked?: string | null;
  /** Saves whatever the editor hasn't autosaved yet, so the list and a restore start from what the person sees. */
  flushPending: () => Promise<void>;
  /** The restore went through: the editor reloads the page. */
  onRestored: (result: RestoreResult, revision: RevisionSummary) => void;
};

type ListState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: RevisionSummary[] };

/**
 * The editor's History panel (GOV-01): the page's saved versions, newest first under a heading per day, and
 * Restore. A native modal <dialog> like Page settings: the browser traps focus, closes it on Esc and hands
 * focus back to the button that opened it. Restore asks first in a second modal dialog.
 */
function HistoryPanel({ open, onClose, slug, status, kind, canRestoreLive, restoreBlocked = null, flushPending, onRestored }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const pressedOnBackdropRef = useRef(false);
  const confirmTitleId = useId();
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // True when the editor's latest edits could not be saved first: the confirm then says they will be replaced.
  const [unsaved, setUnsaved] = useState(false);
  const [confirming, setConfirming] = useState<RevisionSummary | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Read again on every open (and Try again), after saving what the editor still holds.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Resets before the fetch resolves: a re-open must not show last time's list as if current.
    setList({ status: 'loading' });
    setUnsaved(false);
    flushPending()
      .catch(() => !cancelled && setUnsaved(true))
      .then(() => listRevisions(slug))
      .then((items) => !cancelled && setList({ status: 'ready', items }))
      .catch(() => !cancelled && setList({ status: 'error' }));
    return () => {
      cancelled = true;
    };
    // flushPending is a fresh function each render of the editor; only a new open or retry should read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slug, attempt]);

  useEffect(() => {
    const dialog = confirmRef.current;
    if (!dialog) return;
    if (confirming && !dialog.open) dialog.showModal();
    if (!confirming && dialog.open) dialog.close();
  }, [confirming]);

  async function restore() {
    if (!confirming || restoring) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      await flushPending().catch(() => undefined);
      const result = await restoreRevision(slug, confirming.id);
      const revision = confirming;
      setConfirming(null);
      onRestored(result, revision);
    } catch (error) {
      setRestoreError(
        error instanceof ApiError && error.status === 403
          ? 'You don’t have permission to restore a live page.'
          : error instanceof ApiError && error.status === 404
            ? 'That version is no longer there. Close this and look again.'
            : 'Couldn’t restore. Check your connection and try again.',
      );
    } finally {
      setRestoring(false);
    }
  }

  const items = list.status === 'ready' ? list.items : [];
  const days = groupByDay(items);
  const titles = titleChanges(items);
  const previous = previousStatuses(items);
  const latestId = items[0]?.id;
  const blockedNote =
    restoreBlocked ?? (status === 'published' && !canRestoreLive ? `This ${kind.toLowerCase()} is live. Only people who can publish can restore a version of it.` : null);

  return (
    <dialog
      ref={dialogRef}
      className="history"
      aria-labelledby="history-heading"
      onClose={onClose}
      // One Esc closes the confirm only: the panel stays while its confirm is still open.
      onCancel={(event) => {
        if (confirmRef.current?.open) event.preventDefault();
      }}
      onMouseDown={(event) => {
        pressedOnBackdropRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressedOnBackdropRef.current) onClose();
      }}
    >
      <div className="history-inner">
        <header className="history-header">
          <h2 id="history-heading">History</h2>
          <button type="button" className="history-close" aria-label="Close history" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="history-body" aria-busy={list.status === 'loading'}>
          <p className="history-intro">
            Earlier versions of this {kind.toLowerCase()}, newest first. Restoring one keeps the {kind.toLowerCase()}’s status and
            address.
          </p>
          {unsaved && (
            <p className="history-note" role="status">
              Your latest edits couldn’t be saved, so they aren’t in this list.
            </p>
          )}
          {blockedNote && (
            <p className="history-note" role="status">
              {blockedNote}
            </p>
          )}

          <div role="status" aria-live="polite">
            {list.status === 'loading' && <p className="history-state">Loading versions…</p>}
            {list.status === 'ready' && items.length === 0 && (
              <p className="history-state">
                No earlier versions yet. One is kept each time you publish, change the status, or edit.
              </p>
            )}
          </div>
          {list.status === 'error' && (
            <div className="history-state" role="alert">
              <p>Couldn’t load the history.</p>
              <button type="button" className="history-button" onClick={() => setAttempt((count) => count + 1)}>
                Try again
              </button>
            </div>
          )}

          {days.map((day) => (
            <section key={day.key} className="history-day" aria-labelledby={`history-day-${day.key}`}>
              <h3 id={`history-day-${day.key}`}>{day.heading}</h3>
              <ul className="history-list">
                {day.revisions.map((revision) => {
                  const changedTitle = titles.get(revision.id);
                  return (
                    <li key={revision.id} className="history-row">
                      <div className="history-row-main">
                        <div className="history-row-top">
                          <time className="history-time" dateTime={revision.savedAt}>
                            {timeLabel(revision.savedAt)}
                          </time>
                          <span className={`history-badge history-badge-${revision.reason}`}>{reasonLabel(revision, previous.get(revision.id))}</span>
                          <span className="history-status">{STATUS_LABEL[revision.status]}</span>
                        </div>
                        <p className="history-author">{authorName(revision)}</p>
                        {changedTitle && <p className="history-title">Title: “{changedTitle}”</p>}
                      </div>
                      {revision.id === latestId ? (
                        <span className="history-current">Latest</span>
                      ) : (
                        <button
                          type="button"
                          className="history-button"
                          disabled={blockedNote !== null}
                          aria-label={`Restore the version from ${whenLabel(revision.savedAt)}`}
                          onClick={() => {
                            setRestoreError(null);
                            setConfirming(revision);
                          }}
                        >
                          Restore
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <dialog
        ref={confirmRef}
        className="history-confirm"
        aria-labelledby={confirmTitleId}
        // React passes a nested dialog's close up to the panel's own onClose, which would close the panel too.
        onClose={(event) => {
          event.stopPropagation();
          if (!restoring) setConfirming(null);
        }}
        onCancel={(event) => {
          event.stopPropagation();
          if (restoring) event.preventDefault();
        }}
      >
        {confirming && (
          <div className="history-confirm-inner">
            <h2 id={confirmTitleId}>Restore the version from {whenLabel(confirming.savedAt)}?</h2>
            {restoreWarning(status, unsaved).map((line, index) => (
              <p key={line} className={index === 0 && status === 'published' ? 'history-confirm-live' : undefined}>
                {line}
              </p>
            ))}
            {restoreError && (
              <p className="history-confirm-error" role="alert">
                {restoreError}
              </p>
            )}
            <div className="history-actions">
              <button type="button" className="history-button" autoFocus onClick={() => setConfirming(null)} disabled={restoring}>
                Cancel
              </button>
              <button type="button" className="history-button history-button-primary" onClick={restore} disabled={restoring}>
                {restoring ? 'Restoring…' : 'Restore this version'}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </dialog>
  );
}

export default HistoryPanel;
