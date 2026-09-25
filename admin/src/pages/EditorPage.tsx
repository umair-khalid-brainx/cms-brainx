import { useEffect, useRef, useState } from 'react';
import { Puck, type Data } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { Link, Navigate, useParams } from 'react-router';
import { config, type EditorComponents } from '../puck/config';
import { getPage, publishPage, saveDraft, type Page } from '../lib/contentApi';
import './EditorPage.css';

const AUTOSAVE_DELAY_MS = 500;

type LoadState = { status: 'loading' } | { status: 'notFound' } | { status: 'error'; message: string } | { status: 'ready' };

function EditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [page, setPage] = useState<Page | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [published, setPublished] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);
  // Tracks the live data from onChange so our own Publish button (see below)
  // can save it on click without needing to reach into Puck's internal store.
  const latestDataRef = useRef<Data<EditorComponents> | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Resets state for the new slug before the fetch resolves — oxlint's
    // set-state-in-effect warning here is expected, not a bug: navigating
    // directly from one /editor/:slug to another must clear the previous
    // page's data before the new one loads, not render it under a new title.
    setLoad({ status: 'loading' });
    setPage(null);

    if (!slug) {
      setLoad({ status: 'notFound' });
      return;
    }

    getPage(slug)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setLoad({ status: 'notFound' });
          return;
        }
        latestDataRef.current = result.data;
        setPage(result);
        setLoad({ status: 'ready' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({ status: 'error', message: error instanceof Error ? error.message : 'Failed to load page' });
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutRef.current);
    };
  }, [slug]);

  if (load.status === 'notFound') return <Navigate to="/pages" replace />;
  if (load.status === 'loading' || !page) return <div className="editor-loading">Loading…</div>;
  if (load.status === 'error') return <div className="editor-loading">Couldn&rsquo;t load this page: {load.message}</div>;

  function handleChange(data: Data<EditorComponents>) {
    latestDataRef.current = data;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      saveDraft(page!.slug, data)
        .then(() => {
          setSavedAt(new Date());
          setSaveError(null);
        })
        .catch(() => setSaveError('Could not save — check your connection'));
    }, AUTOSAVE_DELAY_MS);
  }

  function publishNow() {
    window.clearTimeout(timeoutRef.current);
    if (!latestDataRef.current) return;
    publishPage(page!.slug, latestDataRef.current)
      .then(() => {
        setSavedAt(new Date());
        setSaveError(null);
        setPublished(true);
        window.setTimeout(() => setPublished(false), 2500);
      })
      .catch(() => setSaveError('Could not publish — check your connection'));
  }

  return (
    <div className="editor-page">
      <header className="editor-topbar">
        <Link to="/pages" className="editor-back">
          &larr; Pages
        </Link>
        <span className="editor-title">Editing: {page.title}</span>
        <span className="editor-status" role="status">
          {saveError ?? (published ? 'Published' : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : '')}
        </span>
        <span className="editor-site">Corrick Oyster Co.</span>
        {/* Puck's own documented onPublish pattern (README: <Puck onPublish={save} />,
            wired below too, matching it exactly) doesn't render a visible
            Publish button in the installed @puckeditor/core@0.23.0 — traced
            into their bundled source (chunk-55V3NZVF.mjs): the button *is*
            in the default header-actions render tree with no permission or
            state gate found, but no `.lucide-globe`/Publish element ever
            reaches the DOM in this app. Rather than depend on a control that
            silently isn't there, this is our own, guaranteed to work. */}
        <button type="button" className="editor-publish" onClick={publishNow}>
          Publish
        </button>
      </header>

      <div className="editor-puck">
        {/* `data` is keyed to remount Puck when the slug changes — Puck owns
            its own internal state and won't otherwise notice a new page. */}
        <Puck
          key={page.slug}
          config={config}
          data={page.data}
          iframe={{ waitForStyles: true }}
          onChange={handleChange}
          onPublish={() => publishNow()}
        />
      </div>
    </div>
  );
}

export default EditorPage;
