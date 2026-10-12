import { useEffect, useId, useRef, useState } from 'react';
import './WorkflowStrip.css';

/** The API's limit on a reviewer's note (api/src/content/workflow-rules.ts REVIEW_NOTE_MAX). */
const NOTE_MAX = 500;

type Props = {
  open: boolean;
  /** "page" or the entry's kind, for the wording. */
  kind: string;
  submitter: string | null;
  onClose: () => void;
  /** Rejects with a message to show. */
  onSend: (note: string) => Promise<unknown>;
};

/** A reviewer sends a page back to draft with a note saying what to change (GOV-07). The note is required. */
function SendBackDialog({ open, kind, submitter, onClose, onSend }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setNote('');
      setError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const trimmed = note.trim();

  async function send() {
    if (busy || !trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(trimmed);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="wf-dialog"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      // Not while a request is out: its answer would land on a closed dialog.
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <div className="wf-dialog-inner">
        <h2 id={`${id}-title`}>Send back to {submitter ?? 'its writer'}</h2>
        <p className="wf-hint">The {kind} goes back to draft. They see your note at the top of the editor.</p>
        <div className="wf-field">
          <label htmlFor={`${id}-note`}>What needs to change?</label>
          <textarea
            id={`${id}-note`}
            rows={5}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-describedby={`${id}-count`}
          />
          <p id={`${id}-count`} className="wf-hint wf-count">
            {note.length} / {NOTE_MAX}
          </p>
        </div>
        {error && (
          <p className="wf-error" role="alert">
            {error}
          </p>
        )}
        <div className="wf-dialog-actions">
          <button type="button" className="wf-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="wf-button wf-button-primary" onClick={send} disabled={busy || !trimmed}>
            {busy ? 'Sending back…' : 'Send back'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default SendBackDialog;
