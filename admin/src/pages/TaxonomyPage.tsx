import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { getActiveMembership } from '../lib/activeSite'
import { ApiError } from '../lib/api';
import { canPublishContent } from '../lib/roles';
import { TERM_NAME_MAX, entriesLabel, nameProblem, tidyTermName, type Term, type TermKind } from '../lib/terms';
import { createTerm, deleteTerm, listTerms, renameTerm } from '../lib/termsApi';
import './PagesListPage.css';
import './TaxonomyPage.css';

const TABS: { kind: TermKind; label: string; one: string; hint: string }[] = [
  {
    kind: 'category',
    label: 'Categories',
    one: 'category',
    hint: 'The main topics of your entries. People pick from this list while editing.',
  },
  {
    kind: 'tag',
    label: 'Tags',
    one: 'tag',
    hint: 'Free-form labels. New ones are also created while tagging an entry.',
  },
];

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

const failure = (caught: unknown, fallback: string) => (caught instanceof ApiError ? caught.message : fallback);

/**
 * The Categories & Tags screen (TAX-01): one flat list of each per site, shared by every content type that uses
 * them. Anyone can look; adding, renaming and deleting needs publish rights, like the API. Deleting a term takes
 * it off every entry, so the confirmation says how many.
 */
function TaxonomyPage() {
  const id = useId();
  const mayEdit = canPublishContent(getActiveMembership()?.role);
  const [terms, setTerms] = useState<Term[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [tab, setTab] = useState<TermKind>('category');
  const [announcement, setAnnouncement] = useState('');
  const tabRefs = useRef<Record<TermKind, HTMLButtonElement | null>>({ category: null, tag: null });

  useEffect(() => {
    let cancelled = false;
    listTerms()
      .then((rows) => {
        if (cancelled) return;
        setTerms(rows);
        setLoad({ status: 'ready' });
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setLoad({ status: 'error', message: caught instanceof Error ? caught.message : 'Couldn’t load the lists' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Arrow keys move between the two tabs, as a tab list should.
  function onTabKey(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = tab === 'category' ? 'tag' : 'category';
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  const sorted = (rows: Term[]) => [...rows].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="taxonomy">
      <div className="pages-header">
        <h1 className="pages-title">Categories &amp; Tags</h1>
      </div>
      <p className="taxonomy-intro">
        One list of each for the whole site. A content type uses them once Categories or Tags is switched on for it under Content
        types.
      </p>

      <p className="taxonomy-announcer" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="taxonomy-tabs" role="tablist" aria-label="Which list" onKeyDown={onTabKey}>
        {TABS.map(({ kind, label }) => (
          <button
            key={kind}
            ref={(element) => {
              tabRefs.current[kind] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${kind}`}
            aria-selected={tab === kind}
            aria-controls={`${id}-panel-${kind}`}
            tabIndex={tab === kind ? 0 : -1}
            className={`taxonomy-tab${tab === kind ? ' taxonomy-tab--active' : ''}`}
            onClick={() => setTab(kind)}
          >
            {label}
            {load.status === 'ready' ? (
              <span className="taxonomy-tab-count"> {terms.filter((t) => t.kind === kind).length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {TABS.map((spec) => (
        <div
          key={spec.kind}
          role="tabpanel"
          id={`${id}-panel-${spec.kind}`}
          aria-labelledby={`${id}-tab-${spec.kind}`}
          hidden={tab !== spec.kind}
        >
          <TermList
            kind={spec.kind}
            one={spec.one}
            hint={spec.hint}
            terms={sorted(terms.filter((term) => term.kind === spec.kind))}
            load={load}
            mayEdit={mayEdit}
            announce={setAnnouncement}
            onChange={setTerms}
          />
        </div>
      ))}
    </div>
  );
}

function TermList({
  kind,
  one,
  hint,
  terms,
  load,
  mayEdit,
  announce,
  onChange,
}: {
  kind: TermKind;
  one: string;
  hint: string;
  terms: Term[];
  load: LoadState;
  mayEdit: boolean;
  announce: (message: string) => void;
  onChange: (update: (terms: Term[]) => Term[]) => void;
}) {
  const id = useId();
  const addRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const problem = nameProblem(name, kind);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createTerm(kind, name);
      onChange((rows) => [...rows, created]);
      setName('');
      announce(`Added the ${one} “${created.name}”.`);
      addRef.current?.focus();
    } catch (caught) {
      setError(failure(caught, `Couldn’t add the ${one}. Check your connection and try again.`));
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(term: Term, next: string): Promise<boolean> {
    const problem = nameProblem(next, kind);
    if (problem) {
      setRowError(problem);
      return false;
    }
    if (tidyTermName(next) === term.name) {
      setEditingId(null);
      return true;
    }
    setBusyId(term.id);
    setRowError(null);
    try {
      const saved = await renameTerm(term.id, next);
      onChange((rows) => rows.map((row) => (row.id === term.id ? { ...row, name: saved.name, slug: saved.slug } : row)));
      setEditingId(null);
      announce(`Renamed to “${saved.name}”.`);
      return true;
    } catch (caught) {
      setRowError(failure(caught, `Couldn’t rename the ${one}. Check your connection and try again.`));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(term: Term) {
    const effect =
      term.entryCount === 0
        ? 'No entries use it.'
        : `${entriesLabel(term.entryCount)} will lose it. The ${term.entryCount === 1 ? 'entry itself is' : 'entries themselves are'} not deleted.`;
    if (!window.confirm(`Delete the ${one} “${term.name}”? ${effect}`)) return;
    setBusyId(term.id);
    setRowError(null);
    try {
      await deleteTerm(term.id);
      onChange((rows) => rows.filter((row) => row.id !== term.id));
      announce(`Deleted the ${one} “${term.name}”.`);
    } catch (caught) {
      setRowError(failure(caught, `Couldn’t delete the ${one}. Check your connection and try again.`));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <p className="taxonomy-hint">{hint}</p>

      {mayEdit ? (
        <form className="taxonomy-form" onSubmit={handleAdd} noValidate>
          <label htmlFor={`${id}-name`}>New {one}</label>
          <div className="taxonomy-form-row">
            <input
              ref={addRef}
              id={`${id}-name`}
              value={name}
              maxLength={TERM_NAME_MAX}
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
            />
            <button type="submit" className="taxonomy-add" disabled={saving || !name.trim()}>
              {saving ? 'Adding…' : `Add ${one}`}
            </button>
          </div>
          {error ? (
            <p id={`${id}-error`} className="taxonomy-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <p className="taxonomy-hint">Only people who can publish can add, rename or delete these.</p>
      )}

      {rowError ? (
        <p className="taxonomy-error taxonomy-row-error" role="alert">
          {rowError}
        </p>
      ) : null}

      {load.status === 'loading' ? (
        <p className="pages-loading">Loading…</p>
      ) : load.status === 'error' ? (
        <p className="pages-error">Couldn’t load the lists: {load.message}</p>
      ) : terms.length === 0 ? (
        <p className="taxonomy-empty">
          {mayEdit
            ? `No ${one === 'category' ? 'categories' : 'tags'} yet. Add the first one above.`
            : `No ${one === 'category' ? 'categories' : 'tags'} yet.`}
        </p>
      ) : (
        <div className="taxonomy-table-wrap">
          <table className="pages-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="taxonomy-slug">Address part</th>
                <th>Used by</th>
                {mayEdit ? (
                  <th>
                    <span className="taxonomy-sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {terms.map((term) => (
                <tr key={term.id}>
                  <td>
                    {editingId === term.id ? (
                      <RenameField
                        term={term}
                        busy={busyId === term.id}
                        onSave={(next) => handleRename(term, next)}
                        onCancel={() => {
                          setEditingId(null);
                          setRowError(null);
                        }}
                      />
                    ) : (
                      <span className="taxonomy-name">{term.name}</span>
                    )}
                  </td>
                  <td className="pages-row-path taxonomy-slug">{term.slug}</td>
                  <td className="taxonomy-count">{entriesLabel(term.entryCount)}</td>
                  {mayEdit ? (
                    <td className="taxonomy-actions">
                      {editingId === term.id ? null : (
                        <>
                          <button
                            type="button"
                            className="taxonomy-link"
                            disabled={busyId === term.id}
                            aria-label={`Rename the ${one} ${term.name}`}
                            onClick={() => {
                              setRowError(null);
                              setEditingId(term.id);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="taxonomy-link taxonomy-delete"
                            disabled={busyId === term.id}
                            aria-label={`Delete the ${one} ${term.name}`}
                            onClick={() => handleDelete(term)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** The name as an input in its row: Enter saves, Esc leaves it alone. */
function RenameField({
  term,
  busy,
  onSave,
  onCancel,
}: {
  term: Term;
  busy: boolean;
  onSave: (name: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(term.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!busy) onCancel();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!busy) void onSave(value);
    }
  }

  return (
    <div className="taxonomy-rename">
      <input
        ref={inputRef}
        value={value}
        maxLength={TERM_NAME_MAX}
        autoComplete="off"
        aria-label={`New name for ${term.name}`}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <button type="button" className="taxonomy-link" disabled={busy} onClick={() => void onSave(value)}>
        {busy ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className="taxonomy-link" disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

export default TaxonomyPage;
