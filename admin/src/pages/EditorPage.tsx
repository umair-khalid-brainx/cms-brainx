import { useEffect, useRef, useState } from 'react';
import { Puck, type Data } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { Link, Navigate, useParams } from 'react-router';
import { config, type EditorComponents } from '../puck/config';
import PublishChecksPanel from '../components/PublishChecksPanel';
import { getSession } from '../lib/auth';
import {
  getPage,
  getPublishChecks,
  publishChecksFromError,
  publishPage,
  saveDraft,
  type Page,
  type PublishChecks,
} from '../lib/contentApi';
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
  const [checks, setChecks] = useState<PublishChecks | null>(null);
  const [publishing, setPublishing] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  // Tracks the live data from onChange so our own Publish button (see below)
  // can save it on click without needing to reach into Puck's internal store.
  const latestDataRef = useRef<Data<EditorComponents> | null>(null);
  const publishButtonRef = useRef<HTMLButtonElement>(null);
  // Set when a publish closes the checks panel, so focus lands back on
  // Publish instead of <body> — once the button is enabled again (below).
  const refocusPublishRef = useRef(false);

  useEffect(() => {
    if (publishing || !refocusPublishRef.current) return;
    refocusPublishRef.current = false;
    publishButtonRef.current?.focus();
  }, [publishing]);

  useEffect(() => {
    let cancelled = false;
    // Resets state for the new slug before the fetch resolves — oxlint's
    // set-state-in-effect warning here is expected, not a bug: navigating
    // directly from one /editor/:slug to another must clear the previous
    // page's data before the new one loads, not render it under a new title.
    setLoad({ status: 'loading' });
    setPage(null);
    setChecks(null);

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

  // Save, ask the API what would stop this going live, and only publish
  // when nothing does (CNT-12). Warnings show first but can be skipped with
  // "Publish anyway"; errors can't — the API re-checks and refuses with 422.
  // The publish sends whatever is newest by then (`latestDataRef`), not what
  // was on screen at the click: typing during the round-trip must not be
  // overwritten by an older copy. Errors in those late edits are still
  // caught by the API's own check; a new warning in them is not shown.
  async function publishNow(skipWarnings = false) {
    window.clearTimeout(timeoutRef.current);
    if (!latestDataRef.current || publishing) return;
    setPublishing(true);
    try {
      if (!skipWarnings) {
        await saveDraft(page!.slug, latestDataRef.current);
        const result = await getPublishChecks(page!.slug);
        if (result.errors.length > 0 || result.warnings.length > 0) {
          setChecks(result);
          return;
        }
      }
      window.clearTimeout(timeoutRef.current);
      await publishPage(page!.slug, latestDataRef.current);
      if (checks) refocusPublishRef.current = true;
      setChecks(null);
      setSavedAt(new Date());
      setSaveError(null);
      setPublished(true);
      window.setTimeout(() => setPublished(false), 2500);
    } catch (error) {
      const refused = publishChecksFromError(error);
      if (refused) setChecks(refused);
      else setSaveError('Could not publish — check your connection');
    } finally {
      setPublishing(false);
    }
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
        <span className="editor-site">{getSession()?.memberships[0]?.siteName ?? 'No site'}</span>
        {/* This is the only Publish button — Puck's own native one (rendered
            in its header via `overrides.headerActions`) is suppressed below.
            D-019 originally found Puck's button didn't render at all in this
            version; it does now (D-028 corrects that), which produced two
            live Publish buttons stacked on top of each other. `onPublish`
            stays wired on <Puck> below regardless, so Puck's suppressed
            button would still work if the override were ever removed. */}
        <button ref={publishButtonRef} type="button" className="editor-publish" disabled={publishing} onClick={() => publishNow()}>
          {publishing ? 'Publishing…' : 'Publish'}
        </button>
      </header>

      {checks && (
        <div className="editor-checks">
          <PublishChecksPanel checks={checks} onClose={() => setChecks(null)} onPublishAnyway={() => publishNow(true)} />
        </div>
      )}

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
          // Suppresses Puck's own native Publish button (see D-028) so only
          // the one in .editor-topbar exists — an empty fragment, not null,
          // since this override's return type is ReactElement, not nullable.
          overrides={{ headerActions: () => <></> }}
        />
      </div>
    </div>
  );
}

export default EditorPage;
