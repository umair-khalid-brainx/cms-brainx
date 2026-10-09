import { useEffect, useId, useRef, useState } from 'react';
import { createPreviewLink, getPreviewLink, revokePreviewLink, type PreviewLink } from '../lib/contentApi';
import { previewUrl } from '../data/site';
import './SharePreview.css';

type State =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'ready'; link: PreviewLink }
  | { status: 'error'; message: string };

/**
 * "Share preview" in the editor's top bar (CNT-09): one link per page that
 * shows its latest saved version on the real site, draft or not, until
 * someone turns it off. The popover loads the link state when first opened.
 */
function SharePreview({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState<{ text: string; failed?: boolean }>({ text: '' });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  // Create and Turn off each unmount the button that was clicked; this says
  // where keyboard focus goes next, once the new state has rendered.
  const focusNextRef = useRef<'url' | 'create' | null>(null);

  useEffect(() => {
    const target = focusNextRef.current;
    focusNextRef.current = null;
    if (target === 'url') urlRef.current?.focus();
    if (target === 'create') createRef.current?.focus();
  }, [state]);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getPreviewLink(slug)
      .then((link) => !cancelled && setState(link ? { status: 'ready', link } : { status: 'none' }))
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : 'Could not load the preview link' });
      });
    panelRef.current?.focus();

    function close(returnFocus: boolean) {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    }
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      // Ours, not Puck's: caught in the capture phase and stopped, since
      // Puck's editor also listens for Escape.
      event.stopPropagation();
      close(true);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      cancelled = true;
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, slug]);

  async function run(action: () => Promise<State>, done: string, focusNext: 'url' | 'create') {
    setBusy(true);
    setAnnouncement({ text: '' });
    try {
      const next = await action();
      focusNextRef.current = focusNext;
      setState(next);
      setAnnouncement({ text: done });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Something went wrong' });
    } finally {
      setBusy(false);
    }
  }

  function create() {
    return run(async () => ({ status: 'ready', link: await createPreviewLink(slug) }), 'Preview link created', 'url');
  }

  function revoke() {
    if (!window.confirm('Turn off this preview link? Anyone who has it won’t be able to open it any more.')) return;
    return run(async () => {
      await revokePreviewLink(slug);
      return { status: 'none' };
    }, 'Preview link turned off', 'create');
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setAnnouncement({ text: 'Link copied' });
    } catch {
      // Clipboard access can be refused (permissions, insecure origin):
      // select the link so copying it by hand is one keystroke away.
      urlRef.current?.focus();
      urlRef.current?.select();
      setAnnouncement({ text: 'Couldn’t copy automatically. The link is selected, so copy it with your keyboard', failed: true });
    }
  }

  return (
    <div className="share-preview" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="share-preview-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setState({ status: 'loading' });
          setAnnouncement({ text: '' });
          setOpen((value) => !value);
        }}
      >
        Share preview
      </button>

      {open && (
        <div id={panelId} ref={panelRef} className="share-preview-panel" role="dialog" aria-label="Share preview" tabIndex={-1}>
          <p className="share-preview-intro">
            Anyone with the link sees this page as it&rsquo;s saved now, even before it&rsquo;s published, until you turn the link
            off.
          </p>

          {state.status === 'loading' && <p className="share-preview-muted">Loading…</p>}
          {state.status === 'error' && (
            <p className="share-preview-error" role="alert">
              {state.message}
            </p>
          )}

          {state.status === 'none' && (
            <button ref={createRef} type="button" className="share-preview-primary" disabled={busy} onClick={create}>
              {busy ? 'Creating…' : 'Create preview link'}
            </button>
          )}

          {state.status === 'ready' && (
            <>
              <label className="share-preview-label" htmlFor={`${panelId}-url`}>
                Preview link
              </label>
              <div className="share-preview-row">
                <input
                  ref={urlRef}
                  id={`${panelId}-url`}
                  className="share-preview-url"
                  readOnly
                  value={previewUrl(state.link.token)}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button type="button" className="share-preview-primary" onClick={() => copy(previewUrl(state.link.token))}>
                  Copy link
                </button>
              </div>
              <div className="share-preview-footer">
                <a href={previewUrl(state.link.token)} target="_blank" rel="noreferrer">
                  Open preview
                  <span aria-hidden="true">&#8599;</span>
                </a>
                <button type="button" className="share-preview-revoke" disabled={busy} onClick={revoke}>
                  {busy ? 'Turning off…' : 'Turn off link'}
                </button>
              </div>
            </>
          )}

          <p className={`share-preview-announce ${announcement.failed ? 'share-preview-announce-failed' : ''}`} aria-live="polite">
            {announcement.text}
          </p>
        </div>
      )}
    </div>
  );
}

export default SharePreview;
