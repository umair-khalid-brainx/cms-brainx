import { useEffect, useId, useRef, useState } from 'react';
import { fromLocalInput, publishTimeProblem, suggestedPublishTime, timeZoneName, toLocalInput } from '../lib/workflow';
import './WorkflowStrip.css';

type Props = {
  open: boolean;
  title: string;
  /** Approving offers "Publish now" beside a time; scheduling a draft offers only a time. */
  allowNow: boolean;
  onClose: () => void;
  /** Called with the ISO moment, or undefined for "now". Rejects with a message to show. */
  onConfirm: (publishAt: string | undefined) => Promise<unknown>;
};

/**
 * Asks when a page should go live (GOV-07): now, or at a date and time in the browser's own time zone, which
 * is named under the field. A native modal <dialog>: the browser traps focus, closes it on Esc and hands focus
 * back to the button that opened it.
 */
function WhenDialog({ open, title, allowNow, onClose, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [when, setWhen] = useState<'now' | 'later'>(allowNow ? 'now' : 'later');
  const [value, setValue] = useState(() => toLocalInput(suggestedPublishTime()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // Fresh each time it opens: a time suggested yesterday may be in the past today.
      setWhen(allowNow ? 'now' : 'later');
      setValue(toLocalInput(suggestedPublishTime()));
      setError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, allowNow]);

  const later = when === 'later';
  const problem = later ? publishTimeProblem(value) : null;

  async function confirm() {
    if (busy || problem) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(later ? (fromLocalInput(value) ?? undefined) : undefined);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const confirmLabel = later ? (busy ? 'Scheduling…' : 'Schedule') : busy ? 'Publishing…' : 'Publish now';

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
        <h2 id={`${id}-title`}>{title}</h2>
        {allowNow && (
          <fieldset className="wf-when">
            <legend className="wf-visually-hidden">When should it go live?</legend>
            <label className="wf-choice">
              <input type="radio" name={`${id}-when`} checked={!later} onChange={() => setWhen('now')} />
              <span>
                <strong>Publish now</strong>
                <span className="wf-choice-hint">It goes live on the site straight away.</span>
              </span>
            </label>
            <label className="wf-choice">
              <input type="radio" name={`${id}-when`} checked={later} onChange={() => setWhen('later')} />
              <span>
                <strong>Schedule for later</strong>
                <span className="wf-choice-hint">It stays off the site until the time you pick.</span>
              </span>
            </label>
          </fieldset>
        )}
        {later && (
          <div className="wf-field">
            <label htmlFor={`${id}-at`}>Goes live at</label>
            <input
              id={`${id}-at`}
              type="datetime-local"
              value={value}
              min={toLocalInput(new Date())}
              onChange={(event) => setValue(event.target.value)}
              aria-describedby={`${id}-zone ${problem ? `${id}-problem` : ''}`}
              aria-invalid={problem ? true : undefined}
            />
            <p id={`${id}-zone`} className="wf-hint">
              Your time zone: {timeZoneName()}. It can be up to a minute late.
            </p>
            {problem && (
              <p id={`${id}-problem`} className="wf-error">
                {problem}
              </p>
            )}
          </div>
        )}
        {error && (
          <p className="wf-error" role="alert">
            {error}
          </p>
        )}
        <div className="wf-dialog-actions">
          <button type="button" className="wf-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="wf-button wf-button-primary" onClick={confirm} disabled={busy || problem !== null}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default WhenDialog;
