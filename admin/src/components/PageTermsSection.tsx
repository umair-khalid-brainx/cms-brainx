import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ApiError } from '../lib/api';
import { updatePageSettings, type PageSummary } from '../lib/contentApi';
import {
  MAX_TAGS_PER_ENTRY,
  TERM_NAME_MAX,
  addTags,
  removeLastTag,
  removeTag,
  sameIds,
  sameTags,
  tagSuggestions,
  termKey,
  type Term,
} from '../lib/terms';
import { listTerms } from '../lib/termsApi';
import './PageTermsSection.css';

type Props = {
  page: PageSummary;
  /** What the entry's type has switched on; the section shows only those. */
  hasCategories: boolean;
  hasTags: boolean;
  onSaved: (page: PageSummary) => void;
  /** Said to screen readers when a save lands, in the panel's one live region. */
  announce: (message: string) => void;
};

/**
 * "Categories and tags" in Page settings (TAX-01), for an entry of a type that uses them. Categories are
 * checkboxes from the site's list; tags are typed, with the site's existing tags suggested, and a new name
 * becomes a new tag when saved. One save for the whole section, like Search and sharing.
 */
function PageTermsSection({ page, hasCategories, hasTags, onSaved, announce }: Props) {
  const id = useId();
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>(() => page.categories.map((c) => c.id));
  const [tags, setTags] = useState<string[]>(() => page.tags.map((t) => t.name));
  const [pending, setPending] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTerms()
      .then((rows) => !cancelled && setTerms(rows))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const saved = {
    categoryIds: page.categories.map((c) => c.id),
    tags: page.tags.map((t) => t.name),
  };
  const changed =
    (hasCategories && !sameIds(categoryIds, saved.categoryIds)) ||
    (hasTags && (!sameTags(tags, saved.tags) || pending.trim() !== ''));

  const categories = (terms ?? []).filter((term) => term.kind === 'category');
  const allTagNames = (terms ?? []).filter((term) => term.kind === 'tag').map((term) => term.name);

  function toggleCategory(termId: string, on: boolean) {
    setCategoryIds((current) => (on ? [...current, termId] : current.filter((value) => value !== termId)));
    setFailed(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!changed || saving) return;
    // Text still in the box counts: the person meant to add it.
    let finalTags = tags;
    if (hasTags && pending.trim()) {
      const result = addTags(tags, pending);
      if (result.problem) {
        setProblem(result.problem);
        return;
      }
      finalTags = result.tags;
    }
    setSaving(true);
    setProblem(null);
    setFailed(null);
    try {
      const result = await updatePageSettings(page.slug, {
        ...(hasCategories && { categoryIds }),
        ...(hasTags && { tags: finalTags }),
      });
      setCategoryIds(result.categories.map((c) => c.id));
      setTags(result.tags.map((t) => t.name));
      setPending('');
      announce('Categories and tags saved.');
      onSaved(result);
      // A tag typed here is new to the list: read it again so it is suggested next time.
      void listTerms()
        .then(setTerms)
        .catch(() => {});
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) {
        const body = caught.body as { message?: string | string[] } | null;
        setProblem(Array.isArray(body?.message) ? body.message.join(' ') : caught.message);
      } else {
        setFailed('Couldn’t save. Check your connection and try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  function undo() {
    setCategoryIds(saved.categoryIds);
    setTags(saved.tags);
    setPending('');
    setProblem(null);
  }

  return (
    <section className="page-settings-section" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>{hasCategories && hasTags ? 'Categories and tags' : hasCategories ? 'Categories' : 'Tags'}</h3>

      <form onSubmit={submit} noValidate>
        {hasCategories ? (
          <fieldset className="terms-categories">
            <legend>Categories</legend>
            {loadError ? (
              <p className="page-settings-error" role="alert">
                Couldn’t load the categories. Close and reopen settings to try again.
              </p>
            ) : terms === null ? (
              <p className="page-settings-hint">Loading…</p>
            ) : categories.length === 0 ? (
              <p className="page-settings-hint">
                There are no categories yet. Someone who can publish adds them under Categories &amp; Tags.
              </p>
            ) : (
              <ul className="terms-checks">
                {categories.map((term) => (
                  <li key={term.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={categoryIds.includes(term.id)}
                        onChange={(event) => toggleCategory(term.id, event.target.checked)}
                      />
                      {term.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        ) : null}

        {hasTags ? (
          <TagInput
            id={`${id}-tags`}
            tags={tags}
            pending={pending}
            known={allTagNames}
            onTags={(next) => {
              setTags(next);
              setFailed(null);
            }}
            onPending={(value) => {
              setPending(value);
              setProblem(null);
            }}
            onProblem={setProblem}
          />
        ) : null}

        {problem ? (
          <p className="page-settings-error" role="alert">
            {problem}
          </p>
        ) : null}
        {failed ? (
          <p className="page-settings-error" role="alert">
            {failed}
          </p>
        ) : null}

        <div className="page-settings-actions">
          <button type="submit" className="page-settings-button page-settings-button-primary" disabled={!changed || saving}>
            {saving ? 'Saving…' : 'Save categories and tags'}
          </button>
          {changed && !saving ? (
            <button type="button" className="page-settings-button page-settings-button-quiet" onClick={undo}>
              Undo changes
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

/**
 * A token input: type a name and press Enter or comma to add it, Backspace on an empty box removes the last,
 * and each token has its own remove button. The site's existing tags are offered as the person types, as an
 * ARIA combobox with a listbox; a name that isn't in the list becomes a new tag on save.
 */
function TagInput({
  id,
  tags,
  pending,
  known,
  onTags,
  onPending,
  onProblem,
}: {
  id: string;
  tags: string[];
  pending: string;
  known: string[];
  onTags: (tags: string[]) => void;
  onPending: (value: string) => void;
  onProblem: (message: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [said, setSaid] = useState('');
  const suggestions = tagSuggestions(known, tags, pending);
  const listOpen = open && suggestions.length > 0;
  const isNew = pending.trim() !== '' && !known.some((name) => termKey(name) === termKey(pending));

  function commit(raw: string) {
    const result = addTags(tags, raw);
    onTags(result.tags);
    const added = result.tags.filter((name) => !tags.includes(name));
    if (added.length > 0) setSaid(`Added ${added.join(', ')}. ${result.tags.length} tags.`);
    onPending('');
    onProblem(result.problem ?? null);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      // Enter adds; it never submits the section's form.
      event.preventDefault();
      if (listOpen && active >= 0) commit(suggestions[active]);
      else if (pending.trim()) commit(pending);
    } else if (event.key === ',') {
      event.preventDefault();
      if (pending.trim()) commit(pending);
    } else if (event.key === 'Backspace' && pending === '' && tags.length > 0) {
      setSaid(`Removed ${tags[tags.length - 1]}. ${tags.length - 1} tags.`);
      onTags(removeLastTag(tags));
    } else if (event.key === 'Escape' && listOpen) {
      // Closes the suggestions, not the panel around them.
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className="terms-tags">
      <label htmlFor={`${id}-input`} className="terms-tags-label">
        Tags
      </label>
      <div className="terms-tags-box" onClick={() => inputRef.current?.focus()}>
        <ul className="terms-tokens" aria-label="Tags on this entry">
          {tags.map((tag) => (
            <li key={termKey(tag)} className="terms-token">
              <span>{tag}</span>
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSaid(`Removed ${tag}. ${tags.length - 1} tags.`);
                  onTags(removeTag(tags, tag));
                  inputRef.current?.focus();
                }}
              >
                <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                  <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
        <input
          ref={inputRef}
          id={`${id}-input`}
          value={pending}
          maxLength={TERM_NAME_MAX}
          autoComplete="off"
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={listOpen && active >= 0 ? `${id}-option-${active}` : undefined}
          aria-describedby={`${id}-hint`}
          readOnly={tags.length >= MAX_TAGS_PER_ENTRY && pending === ''}
          onChange={(event) => {
            // A comma typed or pasted in the middle splits into several.
            if (event.target.value.includes(',')) commit(event.target.value);
            else {
              onPending(event.target.value);
              setOpen(true);
              setActive(-1);
            }
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
          }}
        />
      </div>
      <ul id={`${id}-list`} role="listbox" aria-label="Existing tags" className="terms-suggestions" hidden={!listOpen}>
        {suggestions.map((name, index) => (
          <li
            key={name}
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={index === active}
            className={index === active ? 'terms-option terms-option--active' : 'terms-option'}
            // Mouse down, not click: the input must not lose focus first.
            onMouseDown={(event) => {
              event.preventDefault();
              commit(name);
            }}
          >
            {name}
          </li>
        ))}
      </ul>
      <p id={`${id}-hint`} className="page-settings-hint">
        {isNew
          ? `Press Enter to add “${pending.trim()}” as a new tag.`
          : `Type a tag and press Enter or comma. Up to ${MAX_TAGS_PER_ENTRY}; ${tags.length} added.`}
      </p>
      {/* Keeps the box's own count and the token announcements out of the visual layout. */}
      <span className="terms-sr-only" role="status">
        {tags.length >= MAX_TAGS_PER_ENTRY ? `${said} You have reached the limit of ${MAX_TAGS_PER_ENTRY} tags.` : said}
      </span>
    </div>
  );
}

export default PageTermsSection;
