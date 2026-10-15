import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { getActiveMembership } from '../lib/activeSite'
import ChromeTextCard from '../components/ChromeTextCard';
import MenuEditor from '../components/MenuEditor';
import Select from '../components/Select';
import { ApiError } from '../lib/api';
import { PRESET_NAME_MAX, createPreset, deletePreset, listPresets, type ChromePreset } from '../lib/chromeApi';
import { listPages, type PageSummary } from '../lib/contentApi';
import type { MenuLocation } from '../lib/menusApi';
import { canManageSite } from '../lib/roles';
import './MenusPage.css';

const TABS: { location: MenuLocation; label: string }[] = [
  { location: 'header', label: 'Header' },
  { location: 'footer', label: 'Footer' },
];

/**
 * The Menus screen (GOV-03): the header navigation and the footer's link groups of the site, with the words and
 * logo that go with them. Besides the site's own header and footer, a site can keep saved ones: a page or post
 * picks one (or none) in its settings, and every page that picks it shows the changes made here. Both editors stay
 * mounted, so switching tabs never loses what was changed in the other; each saves on its own. Leaving with
 * unsaved changes asks first: closing or reloading the browser tab, and clicking a link to another screen. (The
 * browser's Back button is not covered: the app uses a router without navigation blocking, B-32.)
 */
function MenusPage() {
  const id = useId();
  const canEdit = canManageSite(getActiveMembership()?.role);
  const [tab, setTab] = useState<MenuLocation>('header');
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [pagesError, setPagesError] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [presets, setPresets] = useState<ChromePreset[]>([]);
  const [presetsError, setPresetsError] = useState(false);
  // Which header or footer each tab edits: a saved one's id, or null for the site's own.
  const [selected, setSelected] = useState<Record<MenuLocation, string | null>>({ header: null, footer: null });
  const [naming, setNaming] = useState<MenuLocation | null>(null);
  const [newName, setNewName] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = useRef<Record<MenuLocation, boolean>>({ header: false, footer: false });
  const tabRefs = useRef<Record<MenuLocation, HTMLButtonElement | null>>({ header: null, footer: null });

  useEffect(() => {
    let cancelled = false;
    listPages()
      .then((list) => !cancelled && setPages(list))
      .catch(() => !cancelled && setPagesError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listPresets()
      .then((list) => !cancelled && setPresets(list))
      .catch(() => !cancelled && setPresetsError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const options = (location: MenuLocation) => [
    { value: '', label: `Site ${location} (every page by default)` },
    ...presets.filter((preset) => preset.location === location).map((preset) => ({ value: preset.id, label: `${preset.name}${preset.usedBy > 0 ? ` · used on ${preset.usedBy}` : ''}` })),
  ];

  // Switching to another header or footer unmounts the editor of this one: ask first if it has unsaved links.
  function choose(location: MenuLocation, id: string | null) {
    if (dirty.current[location] && !window.confirm('You have menu changes that are not saved. Switch without saving?')) return;
    dirty.current[location] = false;
    setSelected((current) => ({ ...current, [location]: id }));
    setNaming(null);
    setProblem('');
  }

  async function create(event: React.FormEvent, location: MenuLocation) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;
    if (dirty.current[location] && !window.confirm('You have menu changes that are not saved. Switch without saving?')) return;
    setBusy(true);
    setProblem('');
    try {
      // The API starts it as a copy of the site's own links and words, so a new one is never emptier than what it replaces.
      const created = await createPreset(location, name);
      setPresets((current) => [...current, created]);
      dirty.current[location] = false;
      setSelected((current) => ({ ...current, [location]: created.id }));
      setNaming(null);
      setNewName('');
      setAnnouncement(`Created the ${location} “${created.name}”. It starts as a copy of the site’s own.`);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 400 || error.status === 409)) {
        const body = error.body as { message?: string | string[] } | null;
        setProblem(Array.isArray(body?.message) ? body.message.join(' ') : error.message);
      } else {
        setProblem('Couldn’t create it. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(preset: ChromePreset) {
    const used = preset.usedBy > 0 ? ` ${preset.usedBy} ${preset.usedBy === 1 ? 'page uses' : 'pages use'} it and will show the site’s own ${preset.location} instead.` : '';
    if (!window.confirm(`Delete “${preset.name}”?${used}`)) return;
    try {
      await deletePreset(preset.id);
      dirty.current[preset.location] = false;
      setPresets((current) => current.filter((candidate) => candidate.id !== preset.id));
      setSelected((current) => ({ ...current, [preset.location]: null }));
      setAnnouncement(`Deleted “${preset.name}”.`);
    } catch {
      setProblem('Couldn’t delete it. Check your connection and try again.');
    }
  }

  // Closing or reloading the tab with unsaved changes: the browser's own "leave this page?" question.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current.header || dirty.current.footer) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // Clicking a link to another screen inside the admin unmounts both editors: ask first.
  useEffect(() => {
    const guard = (event: MouseEvent) => {
      if (!dirty.current.header && !dirty.current.footer) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.origin !== window.location.origin) return;
      if (link.pathname === window.location.pathname) return;
      if (!window.confirm('You have menu changes that are not saved. Leave without saving?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', guard, true);
    return () => document.removeEventListener('click', guard, true);
  }, []);

  const onDirtyChange = useCallback((location: MenuLocation, value: boolean) => {
    dirty.current[location] = value;
  }, []);

  // Arrow keys move between the two tabs, as a tab list should.
  function onTabKey(event: React.KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = tab === 'header' ? 'footer' : 'header';
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="menus">
      <div className="menus-header">
        <h1 className="menus-title">Menus</h1>
      </div>

      <p className="menus-announcer" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="menus-tabs" role="tablist" aria-label="Which menu" onKeyDown={onTabKey}>
        {TABS.map(({ location, label }) => (
          <button
            key={location}
            ref={(element) => {
              tabRefs.current[location] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${location}`}
            aria-selected={tab === location}
            aria-controls={`${id}-panel-${location}`}
            tabIndex={tab === location ? 0 : -1}
            className={`menus-tab${tab === location ? ' menus-tab--active' : ''}`}
            onClick={() => setTab(location)}
          >
            {label}
          </button>
        ))}
      </div>

      {TABS.map(({ location }) => (
        <div
          key={location}
          role="tabpanel"
          id={`${id}-panel-${location}`}
          aria-labelledby={`${id}-tab-${location}`}
          hidden={tab !== location}
        >
          <div className="menus-set">
            <label className="menus-set-label" id={`${id}-set-${location}`}>
              Editing
            </label>
            <Select
              aria-label={`Which ${location}`}
              value={selected[location] ?? ''}
              onChange={(value) => choose(location, value || null)}
              options={options(location)}
            />
            {canEdit && naming !== location ? (
              <button type="button" className="settings-secondary" onClick={() => { setNaming(location); setNewName(''); setProblem(''); }}>
                {`New saved ${location}`}
              </button>
            ) : null}
            {canEdit && selected[location] ? (
              <button
                type="button"
                className="settings-secondary"
                onClick={() => {
                  const preset = presets.find((candidate) => candidate.id === selected[location]);
                  if (preset) void remove(preset);
                }}
              >
                Delete this {location}
              </button>
            ) : null}
          </div>
          {naming === location ? (
            <form className="menus-new" onSubmit={(event) => create(event, location)}>
              <label htmlFor={`${id}-new-${location}`}>Name</label>
              <input
                id={`${id}-new-${location}`}
                value={newName}
                maxLength={PRESET_NAME_MAX}
                autoComplete="off"
                autoFocus
                placeholder={location === 'header' ? 'e.g. Landing page header' : 'e.g. Short footer'}
                onChange={(event) => setNewName(event.target.value)}
              />
              <button type="submit" className="settings-save" disabled={!newName.trim() || busy}>
                {busy ? 'Creating…' : 'Create'}
              </button>
              <button type="button" className="settings-secondary" onClick={() => setNaming(null)}>
                Cancel
              </button>
            </form>
          ) : null}
          {presetsError ? <p className="settings-error-note" role="alert">Couldn’t load the saved {location}s. Reload the page to try again.</p> : null}
          {problem ? <p className="settings-error-note" role="alert">{problem}</p> : null}
          <p className="menus-set-hint">
            {selected[location]
              ? `A saved ${location}: pages pick it in their settings, under “Header and footer”. Changes here show on every page that uses it.`
              : `The site’s own ${location} shows on every page that doesn’t pick another.`}
          </p>

          <ChromeTextCard
            key={`text-${location}-${selected[location] ?? 'site'}`}
            location={location}
            preset={presets.find((candidate) => candidate.id === selected[location]) ?? null}
            canEdit={canEdit}
            onPresetSaved={(next) => setPresets((current) => current.map((candidate) => (candidate.id === next.id ? next : candidate)))}
          />

          <MenuEditor
            key={`menu-${location}-${selected[location] ?? 'site'}`}
            location={location}
            presetId={selected[location]}
            canEdit={canEdit}
            pages={pages}
            pagesError={pagesError}
            announce={setAnnouncement}
            onDirtyChange={onDirtyChange}
          />
        </div>
      ))}
    </div>
  );
}

export default MenusPage;
