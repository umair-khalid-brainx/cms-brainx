import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { getActiveMembership } from '../lib/activeSite'
import { ApiError } from '../lib/api';
import { FieldValuesError, listArchivedPages, listPages, updatePageSettings, type PageSummary } from '../lib/contentApi';
import { hasLiveBelow, parentChoices } from '../lib/pageTree';
import { collapseToOne, toggleSection, type SectionId } from '../lib/settingsSections';
import Select from './Select';
import SettingsSection from './SettingsSection';
import PageSeoSection from './PageSeoSection';
import PageTermsSection from './PageTermsSection';
import { canPublishContent } from '../lib/roles';
import { normaliseSlug, parentPath } from '../lib/slug';
import { siteUrl } from '../data/site';
import './PageSettingsPanel.css';

const NARROW = '(max-width: 30rem)';

const STATUS_WORDS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In review',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
};

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

  // Which groups are open, and which hold an unsaved edit. One group at a time on a phone-width screen.
  const [openSections, setOpenSections] = useState<SectionId[]>(['general', 'url']);
  const [single, setSingle] = useState(() => window.matchMedia(NARROW).matches);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  // Stable setters, one per field, so a field's effect doesn't re-run on every render of the panel.
  const dirtyFor = useMemo(() => {
    const make = (key: string) => (value: boolean) => setDirty((current) => (current[key] === value ? current : { ...current, [key]: value }));
    return { title: make('title'), address: make('address'), parent: make('parent'), seo: make('seo'), terms: make('terms') };
  }, []);

  useEffect(() => {
    const query = window.matchMedia(NARROW);
    const update = () => {
      setSingle(query.matches);
      if (query.matches) setOpenSections(collapseToOne);
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const toggle = (id: SectionId) => setOpenSections((current) => toggleSection(current, id, single));

  const liveBelow = tree !== null && hasLiveBelow(tree, page.id);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setSession((current) => current + 1);
      setAddressSaved(false);
      setAnnouncement('');
      setDirty({});
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
          <SettingsSection
            title="General"
            summary={page.title}
            open={openSections.includes('general')}
            onToggle={() => toggle('general')}
            unsaved={!!dirty.title}
          >
            {/* Keyed by slug and by open, so each field starts from what's saved. */}
            <TitleField
              key={`title-${session}-${page.slug}`}
              page={page}
              onDirty={dirtyFor.title}
              onSaved={(saved) => {
                setAnnouncement('Title saved. The address stays the same.');
                onSaved(saved);
              }}
            />
          </SettingsSection>

          <SettingsSection
            title="URL and hierarchy"
            summary={page.path}
            open={openSections.includes('url')}
            onToggle={() => toggle('url')}
            unsaved={!!dirty.address || !!dirty.parent}
          >
            <AddressField
              key={`address-${session}-${page.slug}`}
              page={page}
              kind={kind}
              flushPending={flushPending}
              justSaved={addressSaved}
              liveBelow={liveBelow}
              onDirty={dirtyFor.address}
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
                onDirty={dirtyFor.parent}
                onSaved={(saved) => {
                  setTreeVersion((count) => count + 1);
                  setAnnouncement(`Moved. The address is now ${siteUrl(saved.path)}.`);
                  onSaved(saved);
                }}
              />
            )}
          </SettingsSection>

          {/* Keyed like the fields above, so it starts from what's saved on every open and after a move. */}
          <SettingsSection
            title="SEO and sharing"
            open={openSections.includes('seo')}
            onToggle={() => toggle('seo')}
            unsaved={!!dirty.seo}
          >
            <PageSeoSection
              key={`seo-${session}-${page.slug}`}
              page={page}
              siteName={getActiveMembership()?.siteName ?? ''}
              announce={setAnnouncement}
              onDirty={dirtyFor.seo}
              onSaved={onSaved}
            />
          </SettingsSection>

          {isEntry && (hasCategories || hasTags) ? (
            <SettingsSection
              title={hasCategories && hasTags ? 'Categories and tags' : hasCategories ? 'Categories' : 'Tags'}
              open={openSections.includes('terms')}
              onToggle={() => toggle('terms')}
              unsaved={!!dirty.terms}
            >
              <PageTermsSection
                key={`terms-${session}-${page.slug}`}
                page={page}
                hasCategories={hasCategories}
                hasTags={hasTags}
                announce={setAnnouncement}
                onDirty={dirtyFor.terms}
                onSaved={onSaved}
              />
            </SettingsSection>
          ) : null}

          <SettingsSection
            title="Publishing"
            summary={STATUS_WORDS[page.status] ?? page.status}
            open={openSections.includes('publishing')}
            onToggle={() => toggle('publishing')}
          >
            <div className="page-settings-field">
              <span className="page-settings-label">Status</span>
              <p className="page-settings-status">
                <span className={`page-settings-status-pill page-settings-status-${page.status}`}>{STATUS_WORDS[page.status] ?? page.status}</span>
                {page.status === 'scheduled' && page.publishAt ? <span>{`Goes live ${new Date(page.publishAt).toLocaleString()}`}</span> : null}
              </p>
              <p className="page-settings-hint">
                Publish, schedule, send for review and see earlier versions from the bar above the editor.
              </p>
            </div>
          </SettingsSection>
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

function TitleField({ page, onSaved, onDirty }: { page: PageSummary; onSaved: (page: PageSummary) => void; onDirty: (dirty: boolean) => void }) {
  const id = useId();
  const [title, setTitle] = useState(page.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = title.trim() !== page.title && title.trim() !== '';
  useEffect(() => {
    onDirty(changed);
    return () => onDirty(false);
  }, [changed, onDirty]);

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
  onDirty,
  onSaved,
}: {
  page: PageSummary;
  kind: string;
  flushPending: () => Promise<void>;
  /** This field was just remounted by its own save. */
  justSaved: boolean;
  /** Live pages sit below this one, so moving it changes live addresses too. */
  liveBelow: boolean;
  onDirty: (dirty: boolean) => void;
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
  const mayMove = !(live || liveBelow) || canPublishContent(getActiveMembership()?.role);
  const origin = siteUrl('/');
  const before = `${parentPath(page.path)}/`;
  const normalised = normaliseSlug(slug);
  const changed = normalised !== '' && normalised !== page.slug;
  const thing = kind.toLowerCase();
  useEffect(() => {
    onDirty(editing && changed);
    return () => onDirty(false);
  }, [editing, changed, onDirty]);

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
  onDirty,
  onSaved,
}: {
  page: PageSummary;
  /** The site's pages, or null while they load. */
  tree: PageSummary[] | null;
  loadError: boolean;
  liveBelow: boolean;
  flushPending: () => Promise<void>;
  onDirty: (dirty: boolean) => void;
  onSaved: (page: PageSummary) => void;
}) {
  const id = useId();
  const selectRef = useRef<HTMLDivElement>(null);
  const choices = tree ? parentChoices(tree, page.id) : null;
  const [parentId, setParentId] = useState(page.parentId ?? '');
  // Narrows the list by title: with nested pages, the select's own type-to-jump isn't enough.
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHome = page.path === '/';
  const live = page.status === 'published';
  const mayMove = !(live || liveBelow) || canPublishContent(getActiveMembership()?.role);
  const changed = parentId !== (page.parentId ?? '');
  useEffect(() => {
    onDirty(changed);
    return () => onDirty(false);
  }, [changed, onDirty]);
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
      requestAnimationFrame(() => selectRef.current?.querySelector('button')?.focus());
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
        {/* Title first, so typing a title jumps to it; where it sits comes after. */}
        <div ref={selectRef} className="page-settings-select-wrap">
          <Select
            id={`${id}-parent`}
            className="page-settings-select"
            aria-describedby={`${id}-parent-hint${changed && live ? ` ${id}-parent-live` : ''}${error ? ` ${id}-parent-error` : ''}`}
            aria-invalid={error ? true : undefined}
            value={parentId}
            disabled={!choices || !mayMove || saving}
            onChange={(next) => {
              setParentId(next);
              setError(null);
            }}
            options={[
              { value: '', label: 'None (top level)' },
              ...shown.map(({ page: candidate, disabledReason }) => {
                const notes = [
                  candidate.parentId && titles.has(candidate.parentId) ? `under ${titles.get(candidate.parentId)}` : null,
                  candidate.status === 'archived' ? 'archived' : null,
                  disabledReason,
                ].filter(Boolean);
                return {
                  value: candidate.id,
                  label: notes.length ? `${candidate.title} (${notes.join(', ')})` : candidate.title,
                  disabled: disabledReason !== null && candidate.id !== page.parentId,
                };
              }),
            ]}
          />
        </div>
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
