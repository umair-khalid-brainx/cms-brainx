import { useEffect, useMemo, useRef, useState } from 'react';
import { getActiveMembership } from '../lib/activeSite'
import { Puck, type Data } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { useLocation, useParams } from 'react-router';
import { Link, Navigate, useNavigate } from '../lib/siteRouter';
import type { EditorComponents } from '../puck/config';
import { configFor } from '../puck/entryFields';
import { listContentTypes, type ContentType } from '../lib/typesApi';
import { getSiteDetails } from '../lib/siteApi';
import { readSiteTheme } from '../lib/siteTheme';
import type { SiteTheme } from 'cms-blocks';
import { BlockDrawerItem } from '../components/BlockDrawerItem';
import PageSettingsPanel from '../components/PageSettingsPanel';
import HistoryPanel from '../components/HistoryPanel';
import PublishChecksPanel from '../components/PublishChecksPanel';
import SharePreview from '../components/SharePreview';
import WorkflowStrip from '../components/WorkflowStrip';
import WhenDialog from '../components/WhenDialog';
import SendBackDialog from '../components/SendBackDialog';
import { ApiError } from '../lib/api';
import { canPublishContent, canReviewContent, canWriteContent } from '../lib/roles';
import { editorAccess, isLocked } from '../lib/workflow';
import type { RestoreResult } from '../lib/revisionsApi';
import { restoredNotice, type RevisionSummary } from '../lib/revisions';
import { getSession } from '../lib/auth';
import {
  FieldValuesError,
  getPage,
  getPublishChecks,
  publishChecksFromError,
  publishPage,
  saveDraft,
  approvePage,
  schedulePage,
  sendBackPage,
  submitForReview,
  unschedulePage,
  publishScheduledNow,
  withdrawFromReview,
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
  const [historyOpen, setHistoryOpen] = useState(false);
  // Said in the status line after a restore, until the next save replaces it.
  // A restore made on the Compare screen arrives here with its message in the navigation state.
  const location = useLocation();
  const [notice, setNotice] = useState<string | null>(() => (location.state as { notice?: string } | null)?.notice ?? null);
  // Said once: Back or a reload to this entry in the history mustn't show it again.
  useEffect(() => {
    if ((location.state as { notice?: string } | null)?.notice)
      navigate(location.pathname + location.search, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on arrival
  }, []);
  const staleAfterRestoreRef = useRef(false);
  // The same fact for rendering (a ref can't be read while rendering).
  const [editorStale, setEditorStale] = useState(false);
  // Set when this page's own address just changed (CNT-04): the URL follows it, but
  // the page is already loaded, so that one navigation mustn't reload it or remount Puck.
  const movedToRef = useRef<string | null>(null);
  // Puck's key: the slug the page was loaded under, not its current one, for the same reason.
  const [puckKey, setPuckKey] = useState('');
  // Bumped by a restore: the same slug, but Puck must start again from the restored content.
  const [reloads, setReloads] = useState(0);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [page, setPage] = useState<Page | null>(null);
  // The content type, when this is an entry: its fields fill the side panel (TYP-02).
  const [type, setType] = useState<ContentType | null>(null);
  const fieldKeys = useMemo(() => (type?.fields ?? []).map((field) => field.key), [type]);
  // The site's own theme for the canvas (B-16); null until it loads, or when the site has none.
  const [theme, setTheme] = useState<SiteTheme | null>(null);
  // The canvas waits for the theme, so it doesn't open in the neutral look and then switch.
  const [themeSettled, setThemeSettled] = useState(false);
  const puckConfig = useMemo(() => configFor(type?.fields ?? [], theme ?? undefined, type?.singularName), [type, theme]);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [published, setPublished] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [checks, setChecks] = useState<PublishChecks | null>(null);
  const [publishing, setPublishing] = useState(false);
  // The review workflow (GOV-07): which checks panel step is waiting, which dialog is open, a step in flight.
  const [checksFor, setChecksFor] = useState<'publish' | 'submit' | 'schedule' | 'approve'>('publish');
  // Where focus goes after a step whose button just disappeared (the strip changes with the status).
  const statusRef = useRef<HTMLSpanElement>(null);
  const [dialog, setDialog] = useState<'approve' | 'schedule' | 'sendBack' | null>(null);
  const [stepping, setStepping] = useState(false);
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

  // Once per editor: the theme is the site's, not the page's. A failure leaves the neutral fallback.
  useEffect(() => {
    let cancelled = false;
    // Started inside a promise, so even a synchronous throw (no membership) only means the neutral look.
    Promise.resolve()
      .then(getSiteDetails)
      .then((site) => {
        if (!cancelled) setTheme(readSiteTheme(site.theme));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setThemeSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
  // Before the early returns below would skip it: what this person may do with this page (GOV-07).
  const role = getActiveMembership()?.role;
  const canWrite = canWriteContent(role);
  if (load.status === 'loading' || !page || !themeSettled) return <div className="editor-loading">Loading…</div>;
  if (load.status === 'error') return <div className="editor-loading">Couldn&rsquo;t load this page: {load.message}</div>;

  const access = editorAccess(page, {
    userId: getSession()?.user.id,
    canWrite,
    canPublish: canPublishContent(role),
    canReview: canReviewContent(role),
  });
  const kindName = (type?.singularName ?? 'Page').toLowerCase();

  function handleChange(data: Data<EditorComponents>) {
    // After a restore whose reload failed, the editor holds the old content: never save it over the restored one.
    if (staleAfterRestoreRef.current) return;
    // Read-only (in review, scheduled, a live page this person can't publish, a Viewer): nothing to save,
    // and the API would refuse it anyway (GOV-07).
    if (access.readOnly) return;
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
          setNotice(null);
        })
        .catch((error: unknown) => {
          // Answered after the page moved: the move saved this edit first, so the old
          // address's 404 isn't a real failure.
          if (savingSlug !== slugRef.current) return;
          dirtyRef.current = true;
          // A value the API refused is named; the blocks beside it were saved all the same.
          setSaveError(
            error instanceof FieldValuesError ? `Fields not saved: ${error.message}` : 'Could not save — check your connection',
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
    // After a restore whose reload failed the editor holds the old content: never publish it over the restore.
    if (!latestDataRef.current || publishing || staleAfterRestoreRef.current) return;
    setPublishing(true);
    try {
      if (!skipWarnings) {
        await saveDraft(page!.slug, latestDataRef.current, fieldKeys);
        const result = await getPublishChecks(page!.slug);
        if (result.errors.length > 0 || result.warnings.length > 0) {
          setChecksFor('publish');
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
      // "Published" replaces whatever the line said before, an "Unscheduled" from Publish now included.
      setNotice(null);
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

  /**
   * One review or scheduling step (GOV-07): the page the API answers with replaces the editor's, and the
   * status line says what happened. A refusal with publish checks opens the checks panel; anything else is
   * thrown again for a dialog to show, or shown in the status line when no dialog is open.
   */
  async function runStep(step: () => Promise<Page>, done: string, fromDialog = false): Promise<boolean> {
    setStepping(true);
    setSaveError(null);
    try {
      const fresh = await step();
      latestDataRef.current = fresh.data;
      setPage(fresh);
      setChecks(null);
      setDialog(null);
      setNotice(done);
      setPublished(false);
      // The button that started it has usually gone with the old status: say where we are instead.
      window.setTimeout(() => statusRef.current?.focus(), 0);
      return true;
    } catch (error) {
      const refused = publishChecksFromError(error);
      if (refused) {
        setDialog(null);
        setChecksFor('publish');
        setChecks(refused);
        return false;
      }
      const message = error instanceof ApiError ? error.message : 'That didn’t work — check your connection';
      if (fromDialog) throw new Error(message);
      setSaveError(message);
      return false;
    } finally {
      setStepping(false);
    }
  }

  /**
   * Before submitting or scheduling: save what is on screen, then show the publish checks when there is
   * anything to say. Errors stop the step; warnings offer "anyway". Returns true when the step can go ahead.
   */
  async function checkBefore(stepName: 'submit' | 'schedule' | 'approve'): Promise<boolean> {
    setSaveError(null);
    try {
      // A reviewer's page is locked: nothing of theirs to save first.
      if (stepName !== 'approve') await flushPending();
      const result = await getPublishChecks(page!.slug);
      if (result.errors.length === 0 && result.warnings.length === 0) return true;
      setChecksFor(stepName);
      setChecks(result);
      return false;
    } catch (error) {
      setSaveError(error instanceof FieldValuesError ? `Fields not saved: ${error.message}` : 'Could not save — check your connection');
      return false;
    }
  }

  async function submitNow(skipWarnings = false) {
    if (stepping) return;
    if (!skipWarnings && !(await checkBefore('submit'))) return;
    await runStep(() => submitForReview(page!.slug), 'Submitted for review');
  }

  async function openSchedule(skipWarnings = false) {
    if (!skipWarnings && !(await checkBefore('schedule'))) return;
    setChecks(null);
    setDialog('schedule');
  }

  // A reviewer reads the publish checks' warnings before approving, as a publisher does before Publish.
  async function openApprove(skipWarnings = false) {
    if (!skipWarnings && !(await checkBefore('approve'))) return;
    setChecks(null);
    setDialog('approve');
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

  // A restore replaced the page on the server (GOV-01): read it again and start the editor over from it.
  // Anything still on the autosave timer is dropped: the restore already kept (or replaced) what was there.
  async function handleRestored(result: RestoreResult, revision: RevisionSummary) {
    window.clearTimeout(timeoutRef.current);
    // Until the restored page is read back, autosave must not write the old content over it.
    dirtyRef.current = false;
    staleAfterRestoreRef.current = true;
    setEditorStale(true);
    try {
      const fresh = await getPage(page!.slug);
      if (!fresh) {
        setSaveError('Restored, but the editor couldn’t reload. Reload this page before editing.');
        return;
      }
      staleAfterRestoreRef.current = false;
      setEditorStale(false);
      setHistoryOpen(false);
      latestDataRef.current = fresh.data;
      setPage(fresh);
      setReloads((count) => count + 1);
      setSaveError(null);
      setNotice(restoredNotice(result.droppedTerms, revision));
    } catch {
      setSaveError('Restored, but the editor couldn’t reload. Reload this page before editing.');
    }
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
        <Link to={type ? `/content/${type.prefix}` : '/pages'} className="editor-back" aria-label={`Back to ${type?.name ?? 'Pages'}`}>
          <span aria-hidden="true">&larr;</span> {type?.name ?? 'Pages'}
        </Link>
        <div className="editor-heading">
          <span className="editor-mode">{access.readOnly ? 'Viewing' : 'Editing'}</span>
          <span className="editor-title">{page.title}</span>
        </div>
        {/* The dot says the state at a glance (error, saved, quiet); the words carry the detail. */}
        <span
          ref={statusRef}
          tabIndex={-1}
          className="editor-status"
          data-state={saveError ? 'error' : published || savedAt ? 'ok' : 'idle'}
          role="status"
        >
          {(saveError || published || savedAt) && !(notice && !saveError) && <span className="editor-status-dot" aria-hidden="true" />}
          {saveError ?? notice ?? (published ? 'Published' : savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '')}
        </span>
        <span className="editor-site">{getActiveMembership()?.siteName ?? 'No site'}</span>
        {!access.readOnly && (
          <button type="button" className="editor-secondary" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}>
            {type?.singularName ?? 'Page'} settings
          </button>
        )}
        <button type="button" className="editor-secondary" aria-haspopup="dialog" onClick={() => setHistoryOpen(true)}>
          History
        </button>
        {canWrite && <SharePreview slug={page.slug} />}
        {access.schedule && (
          <button type="button" className="editor-secondary" aria-haspopup="dialog" disabled={publishing || stepping} onClick={() => openSchedule()}>
            Schedule…
          </button>
        )}
        {access.submit && (
          <button type="button" className="editor-publish" disabled={stepping || staleAfterRestoreRef.current} onClick={() => submitNow()}>
            {stepping ? 'Submitting…' : 'Submit for review'}
          </button>
        )}
        {/* This is the only Publish button — Puck's own native one (rendered
            in its header via `overrides.headerActions`) is suppressed below.
            D-019 originally found Puck's button didn't render at all in this
            version; it does now (D-028 corrects that), which produced two
            live Publish buttons stacked on top of each other. `onPublish`
            stays wired on <Puck> below regardless, so Puck's suppressed
            button would still work if the override were ever removed. */}
        {access.publish && (
          <button
            ref={publishButtonRef}
            type="button"
            className="editor-publish"
            disabled={publishing || stepping || editorStale}
            onClick={() => publishNow()}
          >
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
        )}
      </header>

      <WorkflowStrip
        page={page}
        kind={kindName}
        access={access}
        busy={stepping || publishing}
        onApprove={() => openApprove()}
        onSendBack={() => setDialog('sendBack')}
        onWithdraw={() => runStep(() => withdrawFromReview(page.slug), 'Withdrawn: back to draft')}
        onPublishNow={() => runStep(() => publishScheduledNow(page.slug), 'Published')}
        onUnschedule={() => runStep(() => unschedulePage(page.slug), 'Unscheduled: back to draft')}
      />

      {checks && (
        <div className="editor-checks">
          <PublishChecksPanel
            checks={checks}
            onClose={() => setChecks(null)}
            action={
              checksFor === 'submit'
                ? { verb: 'submitting', anyway: 'Submit anyway' }
                : checksFor === 'schedule'
                  ? { verb: 'scheduling', anyway: 'Schedule anyway' }
                  : checksFor === 'approve'
                    ? { verb: 'approving', anyway: 'Approve anyway' }
                    : undefined
            }
            onPublishAnyway={() =>
              checksFor === 'submit'
                ? submitNow(true)
                : checksFor === 'schedule'
                  ? openSchedule(true)
                  : checksFor === 'approve'
                    ? openApprove(true)
                    : publishNow(true)
            }
          />
        </div>
      )}

      <WhenDialog
        open={dialog === 'approve' || dialog === 'schedule'}
        title={dialog === 'approve' ? `Approve “${page.title}”` : `Schedule “${page.title}”`}
        allowNow={dialog === 'approve'}
        onClose={() => setDialog(null)}
        onConfirm={(publishAt) =>
          dialog === 'approve'
            ? runStep(() => approvePage(page.slug, page.updatedAt, publishAt), publishAt ? 'Approved and scheduled' : 'Approved and published', true)
            : runStep(() => schedulePage(page.slug, publishAt!), 'Scheduled', true)
        }
      />

      <SendBackDialog
        open={dialog === 'sendBack'}
        kind={kindName}
        submitter={page.submittedBy?.name ?? null}
        onClose={() => setDialog(null)}
        onSend={(note) => runStep(() => sendBackPage(page.slug, note), 'Sent back to draft', true)}
      />

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

      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        slug={page.slug}
        status={page.status}
        kind={type?.singularName ?? 'Page'}
        canRestoreLive={canPublishContent(role)}
        restoreBlocked={isLocked(page.status) || !canWrite ? access.readOnlyNote : null}
        flushPending={flushPending}
        onRestored={handleRestored}
      />

      <div className="editor-puck">
        {/* Keyed to remount Puck when another page loads — Puck owns its own
            internal state and won't otherwise notice a new page. Keyed by the
            slug it loaded under, so changing this page's address doesn't. */}
        <Puck
          key={`${puckKey}:${reloads}:${access.readOnly ? 'read' : 'edit'}`}
          config={puckConfig}
          data={page.data}
          iframe={{ waitForStyles: true }}
          // Read-only: nothing can be added, moved, removed or edited (GOV-07).
          permissions={access.readOnly ? { drag: false, duplicate: false, delete: false, edit: false, insert: false } : undefined}
          onChange={handleChange}
          onPublish={() => publishNow()}
          // Suppresses Puck's own native Publish button (see D-028) so only
          // the one in .editor-topbar exists — an empty fragment, not null,
          // since this override's return type is ReactElement, not nullable.
          overrides={{ headerActions: () => <></>, drawerItem: BlockDrawerItem }}
        />
      </div>
    </div>
  );
}

export default EditorPage;
