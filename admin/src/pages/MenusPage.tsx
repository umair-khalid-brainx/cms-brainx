import { useCallback, useEffect, useId, useRef, useState } from 'react';
import MenuEditor from '../components/MenuEditor';
import { getSession } from '../lib/auth';
import { listPages, type PageSummary } from '../lib/contentApi';
import type { MenuLocation } from '../lib/menusApi';
import { canManageSite } from '../lib/roles';
import './MenusPage.css';

const TABS: { location: MenuLocation; label: string }[] = [
  { location: 'header', label: 'Header' },
  { location: 'footer', label: 'Footer' },
];

/**
 * The Menus screen (GOV-03): the header navigation and the footer's link groups of the site. Both editors stay
 * mounted, so switching tabs never loses what was changed in the other; each saves on its own. Leaving with
 * unsaved changes asks first: closing or reloading the browser tab, and clicking a link to another screen. (The
 * browser's Back button is not covered: the app uses a router without navigation blocking, B-32.)
 */
function MenusPage() {
  const id = useId();
  const canEdit = canManageSite(getSession()?.memberships[0]?.role);
  const [tab, setTab] = useState<MenuLocation>('header');
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [pagesError, setPagesError] = useState(false);
  const [announcement, setAnnouncement] = useState('');
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
          <MenuEditor
            location={location}
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
