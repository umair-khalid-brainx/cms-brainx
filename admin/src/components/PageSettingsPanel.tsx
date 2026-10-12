import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ApiError } from '../lib/api';
import { getSession } from '../lib/auth';
import { FieldValuesError, listArchivedPages, listPages, updatePageSettings, type PageSummary } from '../lib/contentApi';
import { hasLiveBelow, parentChoices } from '../lib/pageTree';
import PageSeoSection from './PageSeoSection';
import PageTermsSection from './PageTermsSection';
import { canPublishContent } from '../lib/roles';
import { normaliseSlug, parentPath } from '../lib/slug';
import { siteUrl } from '../data/site';
import './PageSettingsPanel.css';

type Props = {
  open: boolean;
  onClose: () => void;
  page: PageSummary;
  /** "Page", or the type's singular name for an entry ("Post"). */
  kind: string;
  /** Entries live under their type's address, so only pages get a parent (CNT-05). */
  isEntry: boolean;
  /** What the entry's type has switched on (TAX-01); both false for a page. */
  hasCategories?: boolean;
  hasTags?: boolean;
  /** Saves whatever the editor hasn't autosaved yet, so a move never strands an edit at the old address. */
  flushPending: () => Promise<void>;
  onSaved: (page: PageSummary) => void;
};

/**
 * The editor's Page settings (CNT-04): a panel that slides in from the right.
 * Its sections grow over week 4 (parent page, SEO, categories and tags), so each
 * one is its own <section> with its own heading and its own save.
 *
 * A native modal <dialog>: the browser keeps focus inside it, closes it on Esc
 * and hands focus back to the button that opened it.
 */
function PageSettingsPanel({ open, onClose, page, kind, isEntry, hasCategories = false, hasTags = false, flushPending, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Bumped on every open, so the fields start from what's saved each time instead
  // of keeping a half-typed draft from last time.
  const [session, setSession] = useState(0);
  // The address field remounts under the new slug after a move; this tells the new
  // one to take focus, instead of focus falling back to the page.
  const [addressSaved, setAddressSaved] = useState(false);
  // One live region, always in the page, so screen readers announce every save.
  const [announcement, setAnnouncement] = useState('');
  // Where a click started: dragging a text selection out onto the backdrop
  // shouldn't close the panel.
  const pressedOnBackdropRef = useRef(false);
  // The site's pages, archived ones too (they're still in the tree the API checks): the
  // parent picker's choices, and whether live pages sit below this one (CNT-05).
  const [tree, setTree] = useState<PageSummary[] | null>(null);
  const [treeError, setTreeError] = useState(false);
  // Bumped after a move: the tree changed, so it's read again.
  const [treeVersion, setTreeVersion] = useState(0);

  useEffect(() => {
    if (!open || isEntry) return;
    let cancelled = false;
    Promise.all([listPages(), listArchivedPages()])
      .then(([active, archived]) => !cancelled && setTree([...active, ...archived]))
      .catch(() => !cancelled && setTreeError(true));
    return () => {
      cancelled = true;
    };
  }, [open, isEntry, page.id, treeVersion]);

  const liveBelow = tree !== null && hasLiveBelow(tree, page.id);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setSession((current) => current + 1);
      setAddressSaved(false);
      setAnnouncement('');
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="page-settings"
      aria-labelledby="page-settings-heading"
      onClose={onClose}
      onMouseDown={(event) => {
        pressedOnBackdropRef.current = event.target === event.currentTarget;
      }}
      // A click on the backdrop lands on the <dialog> itself, never on its content.
      onClick={(event) => {
        if (event.target === event.currentTarget && pressedOnBackdropRef.current) onClose();
      }}
    >
      <div className="page-settings-inner">
        <header className="page-settings-header">
          <h2 id="page-settings-heading">{kind} settings</h2>
          <button type="button" className="page-settings-close" aria-label="Close settings" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <p className="page-settings-announcer" role="status" aria-live="polite">
          {announcement}
        </p>

        <div className="page-settings-body">
          <section className="page-settings-section" aria-labelledby="page-settings-general">
            <h3 id="page-settings-general">General</h3>
            {/* Keyed by slug and by open, so each field starts from what's saved. */}
            <TitleField
              key={`title-${session}-${page.slug}`}
              page={page}
              onSaved={(saved) => {
                setAnnouncement('Title saved. The address stays the same.');
                onSaved(saved);
              }}
            />
            <AddressField
              key={`address-${session}-${page.slug}`}
              page={page}
              kind={kind}
              flushPending={flushPending}
              justSaved={addressSaved}
              liveBelow={liveBelow}
              onSaved={(saved) => {
                setAddressSaved(true);
                setTreeVersion((count) => count + 1);
                setAnnouncement(`Address saved. It is now ${siteUrl(saved.path)}.`);
                onSaved(saved);
              }}
            />
            {isEntry ? null : (
              <ParentField
                key={`parent-${session}-${page.slug}`}
                page={page}
                tree={tree}
                loadError={treeError}
                liveBelow={liveBelow}
                flushPending={flushPending}
                onSaved={(saved) => {
                  setTreeVersion((count) => count + 1);
                  setAnnouncement(`Moved. The address is now ${siteUrl(saved.path)}.`);
                  onSaved(saved);
                }}
              />
            )}
          </section>

          {isEntry && (hasCategories || hasTags) ? (
            <PageTermsSection
              key={`terms-${session}-${page.slug}`}
              page={page}
              hasCategories={hasCategories}
              hasTags={hasTags}
              announce={setAnnouncement}
              onSaved={onSaved}
            />
          ) : null}

          {/* Keyed like the fields above, so it starts from what's saved on every open and after a move. */}
          <PageSeoSection
            key={`seo-${session}-${page.slug}`}
            page={page}
            siteName={getSession()?.memberships[0]?.siteName ?? ''}
            announce={setAnnouncement}
            onSaved={onSaved}
          />
        </div>
      </div>
    </dialog>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  // A move first saves unsaved edits; one of the entry's field values was refused.
  if (error instanceof FieldValuesError) return `Fields not saved: ${error.message}. Fix them, then change the address.`;
  return 'Couldn’t save. Check your connection and try again.';
}

function TitleField({ page, onSaved }: { page: PageSummary; onSaved: (page: PageSummary) => void }) {
  const id = useId();
  const [title, setTitle] = useState(page.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = title.trim() !== page.title && title.trim() !== '';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!changed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updatePageSettings(page.slug, { title: title.trim() });
      setTitle(result.title);
      onSaved(result);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="page-settings-field" onSubmit={submit} noValidate>
      <label htmlFor={`${id}-title`}>Title</label>
      <div className="page-settings-row">
        <input
          id={`${id}-title`}
          value={title}
          maxLength={200}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-title-hint${error ? ` ${id}-title-error` : ''}`}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button type="submit" className="page-settings-button" disabled={!changed || saving}>
          {saving ? 'Saving…' : 'Save title'}
        </button>
      </div>
      <p id={`${id}-title-hint`} className="page-settings-hint">
        Changing the title doesn’t change the address.
      </p>
      {error ? (
        <p id={`${id}-title-error`} className="page-settings-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function AddressField({
  page,
  kind,
  flushPending,
  justSaved,
  liveBelow,
  onSaved,
}: {
  page: PageSummary;
  kind: string;
  flushPending: () => Promise<void>;
  /** This field was just remounted by its own save. */
  justSaved: boolean;
  /** Live pages sit below this one, so moving it changes live addresses too. */
  liveBelow: boolean;
  onSaved: (page: PageSummary) => void;
}) {
  const id = useId();
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [slug, setSlug] = useState(page.slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHome = page.path === '/';
  const live = page.status === 'published';
  // Moving a live page, or one with live pages below it, is a publishing-level change
  // (D-053, D-054); the API enforces it.
  const mayMove = !(live || liveBelow) || canPublishContent(getSession()?.memberships[0]?.role);
  const origin = siteUrl('/');
  const before = `${parentPath(page.path)}/`;
  const normalised = normaliseSlug(slug);
  const changed = normalised !== '' && normalised !== page.slug;
  const thing = kind.toLowerCase();

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (justSaved) changeButtonRef.current?.focus();
    // Only on mount: a fresh field after a move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cancel() {
    setEditing(false);
    setSlug(page.slug);
    setError(null);
    // Back to the button that opened it, not to <body>.
    requestAnimationFrame(() => changeButtonRef.current?.focus());
  }

  // Esc anywhere in the address form leaves the address alone instead of closing the panel.
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    // Mid-save, Esc does nothing: the move is already on its way.
    if (!saving) cancel();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (normalised === '') {
      setError('The address needs at least one letter or number.');
      return;
    }
    if (!changed) {
      cancel();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await flushPending();
      onSaved(await updatePageSettings(page.slug, { slug: normalised }));
    } catch (caught) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  }

  return (
    <div className="page-settings-field">
      <span className="page-settings-label" id={`${id}-label`}>
        Address
      </span>

      {!editing ? (
        <div className="page-settings-address-row">
          <p className="page-settings-address" role="group" aria-labelledby={`${id}-label`}>
            <span className="page-settings-address-origin">{origin}</span>
            <span className="page-settings-address-path">{page.path === '/' ? '/' : page.path}</span>
          </p>
          {isHome || !mayMove ? null : (
            <button
              ref={changeButtonRef}
              type="button"
              className="page-settings-button"
              onClick={() => setEditing(true)}
            >
              Change
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={submit} onKeyDown={handleKeyDown} noValidate>
          <div className="page-settings-slug-input">
            <span className="page-settings-slug-prefix" aria-hidden="true">
              {before}
            </span>
            <input
              ref={inputRef}
              id={`${id}-slug`}
              aria-label={`New address for this ${thing}, after ${origin}${before}`}
              value={slug}
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${id}-preview${error ? ` ${id}-error` : ''}${live ? ` ${id}-live` : ''}`}
              onChange={(event) => {
                setSlug(event.target.value);
                setError(null);
              }}
            />
          </div>

          <p id={`${id}-preview`} className="page-settings-preview">
            {normalised ? (
              <>
                Will be <span className="page-settings-preview-url">{`${origin}${before}${normalised}`}</span>
              </>
            ) : (
              'Type letters or numbers for the address.'
            )}
          </p>

          {live ? (
            <p id={`${id}-live`} className="page-settings-warning">
              This {thing} is live. Its old address will send visitors to the new one (see Redirects).
            </p>
          ) : null}

          {error ? (
            <p id={`${id}-error`} className="page-settings-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="page-settings-actions">
            <button type="submit" className="page-settings-button page-settings-button-primary" disabled={saving || !changed}>
              {saving ? 'Saving…' : 'Save address'}
            </button>
            <button type="button" className="page-settings-button page-settings-button-quiet" onClick={cancel} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {isHome ? <p className="page-settings-hint">The home page always lives at the site’s main address.</p> : null}
      {!isHome && !mayMove ? (
        <p className="page-settings-hint">
          {live ? `This ${thing} is live` : `Pages under this ${thing} are live`}, so only someone who can publish can change its
          address.
        </p>
      ) : null}
    </div>
  );
}

function ParentField({
  page,
  tree,
  loadError,
  liveBelow,
  flushPending,
  onSaved,
}: {
  page: PageSummary;
  /** The site's pages, or null while they load. */
  tree: PageSummary[] | null;
  loadError: boolean;
  liveBelow: boolean;
  flushPending: () => Promise<void>;
  onSaved: (page: PageSummary) => void;
}) {
  const id = useId();
  const selectRef = useRef<HTMLSelectElement>(null);
  const choices = tree ? parentChoices(tree, page.id) : null;
  const [parentId, setParentId] = useState(page.parentId ?? '');
  // Narrows the list by title: with nested pages, the select's own type-to-jump isn't enough.
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHome = page.path === '/';
  const live = page.status === 'published';
  const mayMove = !(live || liveBelow) || canPublishContent(getSession()?.memberships[0]?.role);
  const changed = parentId !== (page.parentId ?? '');
  const chosen = choices?.find((choice) => choice.page.id === parentId)?.page;
  const newPath = `${chosen ? chosen.path : ''}/${page.slug}`;
  const titles = new Map((choices ?? []).map(({ page: candidate }) => [candidate.id, candidate.title]));
  const needle = filter.trim().toLowerCase();
  // The current choice always stays in the list, so filtering never changes what's selected.
  const shown = (choices ?? []).filter(
    ({ page: candidate }) => !needle || candidate.id === parentId || candidate.title.toLowerCase().includes(needle),
  );

  if (isHome) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!changed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await flushPending();
      onSaved(await updatePageSettings(page.slug, { parentId: parentId || null }));
      // The Move button just turned itself off; focus stays on the choice instead of falling to the page.
      requestAnimationFrame(() => selectRef.current?.focus());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="page-settings-field" onSubmit={submit} noValidate>
      <label htmlFor={`${id}-parent`}>Parent page</label>
      {choices ? (
        <input
          type="search"
          className="page-settings-filter"
          placeholder="Find a page"
          aria-label="Find a parent page by title"
          aria-controls={`${id}-parent`}
          value={filter}
          disabled={!mayMove || saving}
          onChange={(event) => setFilter(event.target.value)}
        />
      ) : null}
      <div className="page-settings-row">
        <select
          ref={selectRef}
          id={`${id}-parent`}
          className="page-settings-select"
          value={parentId}
          disabled={!choices || !mayMove || saving}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-parent-hint${error ? ` ${id}-parent-error` : ''}${changed && live ? ` ${id}-parent-live` : ''}`}
          onChange={(event) => {
            setParentId(event.target.value);
            setError(null);
          }}
        >
          <option value="">None (top level)</option>
          {/* Title first, so typing a title jumps to it; where it sits comes after. */}
          {shown.map(({ page: candidate, disabledReason }) => {
            const notes = [
              candidate.parentId && titles.has(candidate.parentId) ? `under ${titles.get(candidate.parentId)}` : null,
              candidate.status === 'archived' ? 'archived' : null,
              disabledReason,
            ].filter(Boolean);
            return (
              <option key={candidate.id} value={candidate.id} disabled={disabledReason !== null && candidate.id !== page.parentId}>
                {notes.length ? `${candidate.title} (${notes.join(', ')})` : candidate.title}
              </option>
            );
          })}
        </select>
        <button type="submit" className="page-settings-button" disabled={!changed || saving}>
          {saving ? 'Moving…' : 'Move page'}
        </button>
      </div>
      <p id={`${id}-parent-hint`} className="page-settings-hint">
        {loadError
          ? 'Couldn’t load the list of pages. Close and reopen to try again.'
          : !mayMove
            ? `${live ? 'This page is live' : 'Pages under this page are live'}, so only someone who can publish can move it.`
            : changed
              ? `Will be ${siteUrl(newPath)}, and any pages under it move with it.`
              : 'Pages can be nested up to 3 levels deep.'}
      </p>
      {changed && live ? (
        <p id={`${id}-parent-live`} className="page-settings-warning">
          This page is live. Its old address, and those of pages under it, will send visitors to the new ones (see Redirects).
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-parent-error`} className="page-settings-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export default PageSettingsPanel;
