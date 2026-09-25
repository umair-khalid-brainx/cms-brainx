import { useEffect, useMemo, useRef, useState } from 'react';
import { Puck, type Data } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { Link, Navigate, useParams } from 'react-router';
import { config, type EditorComponents } from '../puck/config';
import { getPage, saveDraft } from '../lib/pagesStore';
import './EditorPage.css';

const AUTOSAVE_DELAY_MS = 500;

function EditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = slug ? getPage(slug) : undefined;
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [published, setPublished] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  // Tracks the live data from onChange so our own Publish button (see below)
  // can save it on click without needing to reach into Puck's internal store.
  const latestDataRef = useRef<Data<EditorComponents> | null>(null);

  // Read once per slug, not on every render — Puck treats `data` as its
  // initial state. Recomputing it from localStorage on every render (e.g.
  // the ones this component's own autosave-status updates trigger) would
  // hand Puck a fresh object each time, risking it re-syncing over the
  // in-progress edit it's supposed to own.
  // Deliberately keyed on slug only (oxlint's exhaustive-deps warning here is
  // expected, not a bug) — including page.data would recompute this, and
  // hand Puck a fresh object, on every render this component's own
  // autosave-status updates trigger.
  const initialData = useMemo(() => page?.data, [page?.slug]);

  useEffect(() => {
    latestDataRef.current = initialData ?? null;
    return () => window.clearTimeout(timeoutRef.current);
  }, [initialData]);

  if (!page || !initialData) {
    return <Navigate to="/pages" replace />;
  }

  function handleChange(data: Data<EditorComponents>) {
    latestDataRef.current = data;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      saveDraft(page!.slug, data);
      setSavedAt(new Date());
    }, AUTOSAVE_DELAY_MS);
  }

  function publishNow() {
    window.clearTimeout(timeoutRef.current);
    if (latestDataRef.current) saveDraft(page!.slug, latestDataRef.current);
    setSavedAt(new Date());
    setPublished(true);
    window.setTimeout(() => setPublished(false), 2500);
  }

  return (
    <div className="editor-page">
      <header className="editor-topbar">
        <Link to="/pages" className="editor-back">
          &larr; Pages
        </Link>
        <span className="editor-title">Editing: {page.title}</span>
        <span className="editor-status" role="status">
          {published ? 'Published' : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : ''}
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
          data={initialData}
          iframe={{ waitForStyles: true }}
          onChange={handleChange}
          onPublish={() => publishNow()}
        />
      </div>
    </div>
  );
}

export default EditorPage;
