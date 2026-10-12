import { useEffect, useMemo, useRef, useState } from 'react';
import { Puck, type Data } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import type { EditorComponents } from '../puck/config';
import { configFor } from '../puck/entryFields';
import { listContentTypes, type ContentType } from '../lib/typesApi';
import PageSettingsPanel from '../components/PageSettingsPanel';
import PublishChecksPanel from '../components/PublishChecksPanel';
import SharePreview from '../components/SharePreview';
import { ApiError } from '../lib/api';
import { getSession } from '../lib/auth';
import {
  FieldValuesError,
  getPage,
  getPublishChecks,
  publishChecksFromError,
  publishPage,
  saveDraft,
  type Page,
  type PageSummary,
  type PublishChecks,
} from '../lib/contentApi';
import './EditorPage.css';

const AUTOSAVE_DELAY_MS = 500;

type LoadState = { status: 'loading' } | { status: 'notFound' } | { status: 'error'; message: string } | { status: 'ready' };

function EditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Set when this page's own address just changed (CNT-04): the URL follows it, but
  // the page is already loaded, so that one navigation mustn't reload it or remount Puck.
  const movedToRef = useRef<string | null>(null);
  // Puck's key: the slug the page was loaded under, not its current one, for the same reason.
  const [puckKey, setPuckKey] = useState('');
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [page, setPage] = useState<Page | null>(null);
  // The content type, when this is an entry: its fields fill the side panel (TYP-02).
  const [type, setType] = useState<ContentType | null>(null);
  const fieldKeys = useMemo(() => (type?.fields ?? []).map((field) => field.key), [type]);
  const puckConfig = useMemo(() => configFor(type?.fields ?? []), [type]);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [published, setPublished] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [checks, setChecks] = useState<PublishChecks | null>(null);
  const [publishing, setPublishing] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  // An edit made since the last save started: what flushPending must still save.
  const dirtyRef = useRef(false);
  // The page's current slug, for an autosave that answers after a move (CNT-04).
  const slugRef = useRef<string | undefined>(undefined);
  // The autosave in flight, if any: a move waits for it, so an entry's second request
  // (its field values) can't land on the old address after the move.
  const savingRef = useRef<Promise<unknown> | null>(null);
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
    if (slug && movedToRef.current === slug) {
      movedToRef.current = null;
      return;
    }
    let cancelled = false;
    // Resets state for the new slug before the fetch resolves — oxlint's
    // set-state-in-effect warning here is expected, not a bug: navigating
    // directly from one /editor/:slug to another must clear the previous
    // page's data before the new one loads, not render it under a new title.
    setLoad({ status: 'loading' });
    setPage(null);
    setType(null);
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
        // An entry also needs its type before the editor opens, for the fields panel and the Back link.
        return (result.typeId ? listContentTypes() : Promise.resolve<ContentType[]>([])).then((types) => {
          if (cancelled) return;
          setType(types.find((candidate) => candidate.id === result.typeId) ?? null);
          setPage(result);
          slugRef.current = result.slug;
          dirtyRef.current = false;
          setPuckKey(result.slug);
          setLoad({ status: 'ready' });
        });
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
    dirtyRef.current = true;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      const savingSlug = page!.slug;
      dirtyRef.current = false;
      const saving = saveDraft(savingSlug, data, fieldKeys);
      savingRef.current = saving;
      saving
        .finally(() => {
          if (savingRef.current === saving) savingRef.current = null;
        })
        .then(() => {
          setSavedAt(new Date());
          setSaveError(null);
        })
        .catch((error: unknown) => {
          // Answered after the page moved: the move saved this edit first, so the old
          // address's 404 isn't a real failure.
          if (savingSlug !== slugRef.current) return;
          dirtyRef.current = true;
          // A value the API refused is named; the blocks beside it were saved all the same.
          setSaveError(
            error instanceof FieldValuesError
              ? `Fields not saved: ${error.message}`
              : 'Could not save — check your connection',
          );
        });
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
        await saveDraft(page!.slug, latestDataRef.current, fieldKeys);
        const result = await getPublishChecks(page!.slug);
        if (result.errors.length > 0 || result.warnings.length > 0) {
          setChecks(result);
          return;
        }
      }
      window.clearTimeout(timeoutRef.current);
      await publishPage(page!.slug, latestDataRef.current, fieldKeys);
      dirtyRef.current = false;
      if (checks) refocusPublishRef.current = true;
      setChecks(null);
      setSavedAt(new Date());
      setSaveError(null);
      setPublished(true);
      setPage((current) => current && { ...current, status: 'published' });
      window.setTimeout(() => setPublished(false), 2500);
    } catch (error) {
      const refused = publishChecksFromError(error);
      if (refused) setChecks(refused);
      else if (error instanceof ApiError && error.status === 400) setSaveError(`Not published: ${error.message}`);
      else if (error instanceof FieldValuesError) setSaveError(`Fields not saved: ${error.message}`);
      else setSaveError('Could not publish — check your connection');
    } finally {
      setPublishing(false);
    }
  }

  // Saves an edit not yet saved (still on the autosave timer, or whose save failed), at
  // the page's current address. Nothing to save, no request: a move alone never rewrites
  // a live page's content.
  async function flushPending() {
    window.clearTimeout(timeoutRef.current);
    // Its failure is handled where it started; a failed save leaves the edit dirty for below.
    await savingRef.current?.catch(() => undefined);
    if (!dirtyRef.current || !latestDataRef.current) return;
    await saveDraft(page!.slug, latestDataRef.current, fieldKeys);
    dirtyRef.current = false;
  }

  function handleSettingsSaved(saved: PageSummary) {
    const moved = saved.slug !== page!.slug;
    setPage((current) => current && { ...current, ...saved });
    setSavedAt(new Date());
    setSaveError(null);
    // A new slug means a new editor URL; a new parent alone keeps the slug, so the URL stays.
    if (moved) {
      slugRef.current = saved.slug;
      movedToRef.current = saved.slug;
      navigate(`/editor/${saved.slug}`, { replace: true });
    }
  }

  return (
    <div className="editor-page">
      <header className="editor-topbar">
        <Link to={type ? `/content/${type.prefix}` : '/pages'} className="editor-back">
          &larr; {type?.name ?? 'Pages'}
        </Link>
        <span className="editor-title">Editing: {page.title}</span>
        <span className="editor-status" role="status">
          {saveError ?? (published ? 'Published' : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : '')}
        </span>
        <span className="editor-site">{getSession()?.memberships[0]?.siteName ?? 'No site'}</span>
        <button type="button" className="editor-secondary" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}>
          {type?.singularName ?? 'Page'} settings
        </button>
        <SharePreview slug={page.slug} />
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

      <PageSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        page={page}
        kind={type?.singularName ?? 'Page'}
        isEntry={type !== null}
        hasCategories={type?.hasCategories}
        hasTags={type?.hasTags}
        flushPending={flushPending}
        onSaved={handleSettingsSaved}
      />

      <div className="editor-puck">
        {/* Keyed to remount Puck when another page loads — Puck owns its own
            internal state and won't otherwise notice a new page. Keyed by the
            slug it loaded under, so changing this page's address doesn't. */}
        <Puck
          key={puckKey}
          config={puckConfig}
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
