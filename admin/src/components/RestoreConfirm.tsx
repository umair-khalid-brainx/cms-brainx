import { useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '../lib/api';
import type { PageStatus } from '../lib/contentApi';
import { restoreWarning, whenLabel, type RevisionSummary } from '../lib/revisions';
import { restoreRevision, type RestoreResult } from '../lib/revisionsApi';
import './HistoryPanel.css';

type Props = {
  /** The version to restore; null keeps the dialog closed. */
  revision: RevisionSummary | null;
  slug: string;
  status: PageStatus;
  /** The editor's latest edits could not be saved first: the confirm then says they will be replaced. */
  unsaved: boolean;
  /** Saves whatever the editor hasn't autosaved yet (a no-op where there is no editor). */
  flushPending: () => Promise<void>;
  onCancel: () => void;
  /** The restore went through. */
  onRestored: (result: RestoreResult, revision: RevisionSummary) => void;
};

/**
 * The "Restore the version from ...?" confirm, shared by the History panel and the Compare screen (GOV-02), so
 * the wording and the request exist once. A native modal <dialog>: focus is trapped, Esc cancels, and focus
 * goes back to the button that opened it.
 */
function RestoreConfirm({ revision, slug, status, unsaved, flushPending, onCancel, onRestored }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (revision && !dialog.open) dialog.showModal();
    if (!revision && dialog.open) dialog.close();
    // A new question starts clean: an earlier failure's message doesn't carry over.
    setError(null);
  }, [revision]);

  async function restore() {
    if (!revision || restoring) return;
    setRestoring(true);
    setError(null);
    try {
      await flushPending().catch(() => undefined);
      const result = await restoreRevision(slug, revision.id);
      onRestored(result, revision);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 403
          ? 'You don’t have permission to restore a live page.'
          : caught instanceof ApiError && caught.status === 404
            ? 'That version is no longer there. Close this and look again.'
            : 'Couldn’t restore. Check your connection and try again.',
      );
    } finally {
      setRestoring(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="history-confirm"
      aria-labelledby={titleId}
      // React passes a nested dialog's close up to the panel's own onClose, which would close the panel too.
      onClose={(event) => {
        event.stopPropagation();
        if (!restoring) onCancel();
      }}
      onCancel={(event) => {
        event.stopPropagation();
        if (restoring) event.preventDefault();
      }}
    >
      {revision && (
        <div className="history-confirm-inner">
          <h2 id={titleId}>Restore the version from {whenLabel(revision.savedAt)}?</h2>
          {restoreWarning(status, unsaved).map((line, index) => (
            <p key={line} className={index === 0 && status === 'published' ? 'history-confirm-live' : undefined}>
              {line}
            </p>
          ))}
          {error && (
            <p className="history-confirm-error" role="alert">
              {error}
            </p>
          )}
          <div className="history-actions">
            <button type="button" className="history-button" autoFocus onClick={onCancel} disabled={restoring}>
              Cancel
            </button>
            <button type="button" className="history-button history-button-primary" onClick={restore} disabled={restoring}>
              {restoring ? 'Restoring…' : 'Restore this version'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

export default RestoreConfirm;
