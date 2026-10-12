import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import type { PageSummary } from '../lib/contentApi';
import {
  CHILDREN_MAX,
  LABEL_MAX,
  TOP_ITEMS_MAX,
  add,
  canDrop,
  canIndent,
  canMoveDown,
  canMoveUp,
  canOutdent,
  countItems,
  find,
  indent,
  indentProblem,
  itemAt,
  linkItem,
  linkProblem,
  moveDown,
  moveTo,
  moveUp,
  outdent,
  pageItem,
  remove,
  rename,
  sameMenu,
  type DropZone,
  type Menu,
  type MenuNode,
} from '../lib/menuEditor';
import { getMenu, saveMenu, type MenuLocation } from '../lib/menusApi';
import './MenuEditor.css';

type Props = {
  location: MenuLocation;
  canEdit: boolean;
  /** The site's pages (not archived), to add to the menu. */
  pages: PageSummary[];
  /** The list of pages couldn't be loaded. */
  pagesError: boolean;
  /** Said to screen readers, in the screen's one live region. */
  announce: (message: string) => void;
  onDirtyChange: (location: MenuLocation, dirty: boolean) => void;
};

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; problems: string[] };

const NAME: Record<MenuLocation, string> = { header: 'Header', footer: 'Footer' };

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ICONS = {
  up: 'M10 16V4m-5 5 5-5 5 5',
  down: 'M10 4v12m-5-5 5 5 5-5',
  indent: 'M4 10h11m-4-4 4 4-4 4',
  outdent: 'M16 10H5m4-4-4 4 4 4',
  remove: 'M5 6h10m-8 0V4h6v2m-7 0 .7 10h6.6L14 6',
};

/**
 * One menu of the site: its items as a tree two levels deep at most, changed by buttons (which work
 * with a keyboard, a screen reader and a finger) or, with a mouse, by dragging an item's handle onto
 * another item. Nothing is stored until Save, which replaces the whole menu at once (GOV-03).
 */
function MenuEditor({ location, canEdit, pages, pagesError, announce, onDirtyChange }: Props) {
  const id = useId();
  const [saved, setSaved] = useState<Menu | null>(null);
  const [menu, setMenu] = useState<Menu>([]);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [hint, setHint] = useState<{ key: string; zone: DropZone } | null>(null);
  // After a move the button that was pressed has moved with its item: focus follows it.
  const focusAfter = useRef<{ key: string; action: string } | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    getMenu(location)
      .then((loaded) => {
        if (cancelled) return;
        setSaved(loaded);
        setMenu(loaded);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [location]);

  const dirty = saved !== null && !sameMenu(saved, menu);
  useEffect(() => {
    onDirtyChange(location, dirty);
  }, [dirty, location, onDirtyChange]);

  useEffect(() => {
    const pending = focusAfter.current;
    if (!pending) return;
    focusAfter.current = null;
    // An empty key means "nothing left to keep the place of": the first thing in the add panel.
    if (pending.key === '') {
      rootRef.current?.querySelector<HTMLElement>('.menu-search')?.focus();
      return;
    }
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-item="${pending.key}"]`);
    const button = row?.querySelector<HTMLButtonElement>(`button[data-action="${pending.action}"]:not(:disabled)`);
    (button ?? row?.querySelector<HTMLElement>('input'))?.focus();
  }, [menu]);

  const inMenu = useMemo(() => new Set(menu.flatMap((node) => [node, ...node.children]).map((node) => node.contentId)), [menu]);

  function change(next: Menu, message: string, focus?: { key: string; action: string }) {
    setMenu(next);
    setStatus({ kind: 'idle' });
    if (focus) focusAfter.current = focus;
    if (message) announce(message);
  }

  const position = (next: Menu, key: string) => {
    const place = find(next, key);
    if (!place) return '';
    const level = place.child === null ? next.length : next[place.top].children.length;
    return ` Now item ${(place.child ?? place.top) + 1} of ${level}${place.child === null ? '' : ` under “${next[place.top].label}”`}.`;
  };

  function act(node: MenuNode, action: 'up' | 'down' | 'indent' | 'outdent') {
    const apply = { up: moveUp, down: moveDown, indent, outdent }[action];
    const next = apply(menu, node.key);
    const verb = { up: 'up', down: 'down', indent: 'under the item above', outdent: 'out to the top level' }[action];
    change(next, `Moved “${node.label}” ${verb}.${position(next, node.key)}`, { key: node.key, action });
  }

  function drop(event: DragEvent, target: MenuNode) {
    event.preventDefault();
    const zone = zoneFor(event, target);
    if (dragKey && zone) {
      const from = find(menu, dragKey);
      if (from) {
        const next = moveTo(menu, dragKey, target.key, zone);
        change(
          next,
          `Moved “${itemAt(menu, from).label}” ${zone === 'inside' ? 'under' : zone} “${target.label}”.${position(next, dragKey)}`,
        );
      }
    }
    setDragKey(null);
    setHint(null);
  }

  /** Which part of the item the pointer is over, as far as dropping there is allowed. */
  function zoneFor(event: DragEvent, target: MenuNode): DropZone | null {
    if (!dragKey) return null;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const y = (event.clientY - box.top) / box.height;
    const wanted: DropZone = y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'inside';
    for (const zone of [wanted, y < 0.5 ? 'before' : 'after'] as DropZone[]) {
      if (canDrop(menu, dragKey, target.key, zone)) return zone;
    }
    return null;
  }

  async function handleSave() {
    if (!dirty || status.kind === 'saving') return;
    setStatus({ kind: 'saving' });
    try {
      const stored = await saveMenu(location, menu);
      setSaved(stored);
      setMenu(stored);
      setStatus({ kind: 'saved' });
      announce(`${NAME[location]} menu saved. Every page of your site shows it now.`);
    } catch (error) {
      // A 400 lists what it refused, one sentence each; anything else is a connection problem.
      if (error instanceof ApiError && error.status === 400) {
        const body = error.body as { message?: string | string[] } | null;
        setStatus({ kind: 'error', problems: Array.isArray(body?.message) ? body.message : [error.message] });
      } else if (error instanceof ApiError && error.status === 403) {
        setStatus({ kind: 'error', problems: ['Only owners and administrators can change a menu.'] });
      } else {
        setStatus({ kind: 'error', problems: ['Couldn’t save. Check your connection and try again.'] });
      }
    }
  }

  if (loadError) {
    return (
      <p className="menu-error" role="alert">
        Couldn’t load the {NAME[location].toLowerCase()} menu. Reload the page to try again.
      </p>
    );
  }
  if (!saved) return <p className="menu-help">Loading…</p>;

  const busy = status.kind === 'saving';

  function renderItem(node: MenuNode, level: 1 | 2) {
    const hidden = node.page && node.page.status !== 'published';
    const hintHere = hint?.key === node.key ? hint.zone : null;
    const labelId = `${id}-${node.key}-label`;
    const button = (action: 'up' | 'down' | 'indent' | 'outdent', label: string, enabled: boolean, why?: string | null) => (
      <button
        type="button"
        className="menu-tool"
        data-action={action}
        disabled={!canEdit || busy || !enabled}
        aria-label={`${label}: ${node.label || 'this item'}`}
        title={enabled ? label : (why ?? label)}
        onClick={() => act(node, action)}
      >
        <Icon d={ICONS[action]} />
      </button>
    );

    return (
      <li key={node.key} className={`menu-item menu-item--level-${level}`}>
        <div
          className={`menu-row${dragKey === node.key ? ' menu-row--dragging' : ''}${hintHere ? ` menu-row--drop-${hintHere}` : ''}`}
          data-item={node.key}
          onDragOver={(event) => {
            const zone = zoneFor(event, node);
            if (!zone) return;
            event.preventDefault();
            if (hint?.key !== node.key || hint.zone !== zone) setHint({ key: node.key, zone });
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setHint((current) => (current?.key === node.key ? null : current));
          }}
          onDrop={(event) => drop(event, node)}
        >
          {canEdit ? (
            <span
              className="menu-handle"
              draggable={!busy}
              // Mouse only, and not a button: Firefox won't start a drag from one, and a keyboard or screen-reader
              // user has the arrow buttons beside it, so it is no tab stop either.
              aria-hidden="true"
              title="Drag to move"
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', node.key);
                const row = (event.currentTarget as HTMLElement).closest('.menu-row');
                if (row) event.dataTransfer.setDragImage(row, 16, 16);
                setDragKey(node.key);
              }}
              onDragEnd={() => {
                setDragKey(null);
                setHint(null);
              }}
            >
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                <path
                  d="M7 5h.01M13 5h.01M7 10h.01M13 10h.01M7 15h.01M13 15h.01"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          ) : null}

          <div className="menu-main">
            <label className="menu-sr-only" htmlFor={labelId}>
              Label
            </label>
            <input
              id={labelId}
              className="menu-label"
              value={node.label}
              maxLength={LABEL_MAX}
              disabled={!canEdit || busy}
              autoComplete="off"
              onChange={(event) => change(rename(menu, node.key, event.target.value), '')}
            />
            <p className="menu-meta">
              {node.page ? (
                <>
                  <span className="menu-kind">Page</span> {node.page.title} <span className="menu-path">{node.page.path}</span>
                  {hidden ? (
                    <span className="menu-badge" title="Visitors don’t see this item until the page is published.">
                      {node.page.status === 'archived' ? 'Archived: hidden' : 'Draft: hidden'}
                    </span>
                  ) : null}
                </>
              ) : node.contentId ? (
                <>
                  <span className="menu-kind">Page</span> <span className="menu-badge">Page removed: hidden</span>
                </>
              ) : (
                <>
                  <span className="menu-kind">Link</span> <span className="menu-path">{node.url}</span>
                </>
              )}
            </p>
          </div>

          {canEdit ? (
            <div className="menu-tools" role="group" aria-label={`Move or remove ${node.label || 'this item'}`}>
              {button('up', 'Move up', canMoveUp(menu, node.key))}
              {button('down', 'Move down', canMoveDown(menu, node.key))}
              {level === 1
                ? button('indent', 'Put under the item above', canIndent(menu, node.key), indentProblem(menu, node.key))
                : null}
              {level === 2 ? button('outdent', 'Move out to the top level', canOutdent(menu, node.key)) : null}
              <button
                type="button"
                className="menu-tool menu-tool--danger"
                disabled={busy}
                aria-label={`Remove: ${node.label || 'this item'}`}
                title="Remove from the menu"
                onClick={() => {
                  // Focus goes to the next item's label (or the previous one's), so a keyboard user keeps their place;
                  // with nothing left, to the first thing in the add panel.
                  const keys = menu.flatMap((entry) => [entry.key, ...entry.children.map((child) => child.key)]);
                  const at = keys.indexOf(node.key);
                  const remaining = keys.filter((key) => key !== node.key && !node.children.some((child) => child.key === key));
                  const neighbour = remaining[Math.min(at, remaining.length - 1)];
                  change(remove(menu, node.key), `Removed “${node.label}” from the ${NAME[location].toLowerCase()} menu.`, {
                    key: neighbour ?? '',
                    action: 'label',
                  });
                }}
              >
                <Icon d={ICONS.remove} />
              </button>
            </div>
          ) : null}
        </div>

        {node.children.length > 0 ? (
          <ul className="menu-list menu-list--children">{node.children.map((child) => renderItem(child, 2))}</ul>
        ) : null}
      </li>
    );
  }

  return (
    <section ref={rootRef} className="menu-editor" aria-label={`${NAME[location]} menu`}>
      <p className="menu-help">
        {location === 'header'
          ? 'The navigation at the top of every page. An item with items under it opens them as a dropdown.'
          : 'The links at the bottom of every page. Each top item is the title of a column; the items under it are its links.'}{' '}
        Pages that aren’t published are hidden from visitors until they are.
      </p>

      <div className="menu-columns">
        <div className="menu-tree">
          {menu.length === 0 ? (
            <p className="menu-empty">This menu is empty. {canEdit ? 'Add a page or a link.' : ''}</p>
          ) : (
            <ul className="menu-list">{menu.map((node) => renderItem(node, 1))}</ul>
          )}
          <p className="menu-count">
            {countItems(menu)} {countItems(menu) === 1 ? 'item' : 'items'}. Up to {TOP_ITEMS_MAX} at the top level and{' '}
            {CHILDREN_MAX} under each.
          </p>
        </div>

        {canEdit ? (
          <aside className="menu-add" aria-label="Add to the menu">
            <AddPage
              pages={pages}
              pagesError={pagesError}
              inMenu={inMenu}
              disabled={busy || menu.length >= TOP_ITEMS_MAX}
              onAdd={(page) => {
                const node = pageItem({ id: page.id, title: page.title, path: page.path, status: page.status });
                change(add(menu, node), `Added the page “${page.title}” to the end of the ${NAME[location].toLowerCase()} menu.`);
              }}
            />
            <AddLink
              disabled={busy || menu.length >= TOP_ITEMS_MAX}
              onAdd={(label, url) => {
                change(
                  add(menu, linkItem(label, url)),
                  `Added the link “${label}” to the end of the ${NAME[location].toLowerCase()} menu.`,
                );
              }}
            />
          </aside>
        ) : null}
      </div>

      {canEdit ? (
        <div className="menu-savebar">
          <button type="button" className="menu-save" disabled={!dirty || busy} onClick={handleSave}>
            {busy ? 'Saving…' : `Save ${NAME[location].toLowerCase()} menu`}
          </button>
          {dirty && !busy ? (
            <button
              type="button"
              className="menu-quiet"
              onClick={() => {
                setMenu(saved);
                setStatus({ kind: 'idle' });
                announce('Changes undone.');
              }}
            >
              Undo changes
            </button>
          ) : null}
          {dirty ? <span className="menu-unsaved">Unsaved changes</span> : null}
          {status.kind === 'saved' ? (
            <span className="menu-saved" role="status">
              Saved. Every page of your site shows it now.
            </span>
          ) : null}
        </div>
      ) : (
        <p className="menu-help">Only owners and administrators can change a menu.</p>
      )}
      {status.kind === 'error' ? (
        <ul className="menu-error menu-error-list" role="alert">
          {status.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Search the site's pages and add one to the end of the menu. */
function AddPage({
  pages,
  pagesError,
  inMenu,
  disabled,
  onAdd,
}: {
  pages: PageSummary[];
  pagesError: boolean;
  inMenu: ReadonlySet<string | null>;
  disabled: boolean;
  onAdd: (page: PageSummary) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = pages.filter(
    (page) => !needle || page.title.toLowerCase().includes(needle) || page.path.toLowerCase().includes(needle),
  );
  const shown = matches.slice(0, 8);

  return (
    <div className="menu-add-block">
      <h3 id={`${id}-h`}>Add a page</h3>
      <label className="menu-sr-only" htmlFor={`${id}-q`}>
        Find a page
      </label>
      <input
        id={`${id}-q`}
        type="search"
        className="menu-search"
        placeholder="Find a page"
        value={query}
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
      />
      {pagesError ? (
        <p className="menu-help" role="alert">
          Couldn’t load your pages. Reload to try again.
        </p>
      ) : pages.length === 0 ? (
        <p className="menu-help">There are no pages yet.</p>
      ) : shown.length === 0 ? (
        <p className="menu-help">No page matches “{query}”.</p>
      ) : (
        <ul className="menu-pick" aria-labelledby={`${id}-h`}>
          {shown.map((page) => (
            <li key={page.id}>
              <span className="menu-pick-title">
                {page.title}
                <span className="menu-path"> {page.path}</span>
                {page.status !== 'published' ? <span className="menu-badge">Draft</span> : null}
                {inMenu.has(page.id) ? <span className="menu-badge menu-badge--info">In the menu</span> : null}
              </span>
              <button
                type="button"
                className="menu-quiet"
                disabled={disabled}
                aria-label={`Add the page ${page.title}`}
                onClick={() => onAdd(page)}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
      {matches.length > shown.length ? (
        <p className="menu-help">{matches.length - shown.length} more. Type to narrow the list.</p>
      ) : null}
      <p className="menu-help">For posts or other entries, add a link to their address.</p>
    </div>
  );
}

/** A label and an address, added to the end of the menu. */
function AddLink({ disabled, onAdd }: { disabled: boolean; onAdd: (label: string, url: string) => void }) {
  const id = useId();
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (label.trim() === '') return setProblem('Give the link a label.');
    const why = linkProblem(url);
    if (why) return setProblem(why);
    onAdd(label, url);
    setLabel('');
    setUrl('');
    setProblem(null);
  }

  return (
    <form className="menu-add-block" onSubmit={submit} noValidate>
      <h3>Add a link</h3>
      <label htmlFor={`${id}-l`}>Label</label>
      <input
        id={`${id}-l`}
        value={label}
        maxLength={LABEL_MAX}
        autoComplete="off"
        aria-invalid={problem && label.trim() === '' ? true : undefined}
        onChange={(event) => {
          setLabel(event.target.value);
          setProblem(null);
        }}
      />
      <label htmlFor={`${id}-u`}>Address</label>
      <input
        id={`${id}-u`}
        value={url}
        placeholder="/find-us or https://…"
        autoComplete="off"
        spellCheck={false}
        aria-describedby={problem ? `${id}-e` : undefined}
        aria-invalid={problem && label.trim() !== '' ? true : undefined}
        onChange={(event) => {
          setUrl(event.target.value);
          setProblem(null);
        }}
      />
      {problem ? (
        <p id={`${id}-e`} className="menu-error" role="alert">
          {problem}
        </p>
      ) : null}
      <button type="submit" className="menu-quiet menu-quiet--solid" disabled={disabled}>
        Add link
      </button>
    </form>
  );
}

export default MenuEditor;
