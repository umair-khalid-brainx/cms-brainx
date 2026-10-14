import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getActiveMembership } from '../lib/activeSite';
import { Link } from '../lib/siteRouter';
import ContentSidePanel from '../components/ContentSidePanel';
import Menu, { type MenuItem } from '../components/Menu';
import PublishChecksPanel from '../components/PublishChecksPanel';
import Select from '../components/Select';
import {
  deletePage,
  duplicatePage,
  listArchivedPages,
  listPages,
  publishChecksFromError,
  setPageStatus,
  type PageStatus,
  type PageSummary,
  type PublishChecks,
} from '../lib/contentApi';
import { filterRows, statusCounts, updatedLabel, type StatusFilter } from '../lib/listFilter';
import { canArchiveContent, canPublishContent, canWriteContent } from '../lib/roles';
import { isLocked, scheduleLabel } from '../lib/workflow';
import { siteUrl } from '../data/site';
import type { ContentType } from '../lib/typesApi';
import { orderAsTree } from '../lib/pageTree';
import './PagesListPage.css';

// "In review" is the active list filtered here, not a list of its own (GOV-07).
type Tab = 'active' | 'review' | 'archived';
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

const STATUS_LABELS: Record<PageStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
  in_review: 'In review',
  scheduled: 'Scheduled',
};

// What the status menu can move a page to: review and scheduling have their own steps in the editor (GOV-07).
const MENU_STATUSES: PageStatus[] = ['draft', 'published', 'archived'];

// The statuses a row can be moved to, minus the one it is already in and any the user's role can't move to (UI
// affordance only — the API enforces). Leaving or entering Archived needs the same right as archiving.
// A page in review or scheduled has no menu: it's locked until that step ends.
// A live page can be changed only by someone who can publish (GOV-07).
function statusTargets(current: PageStatus): PageStatus[] {
  const role = getActiveMembership()?.role;
  const canArchive = canArchiveContent(role);
  if (isLocked(current) || !canWriteContent(role)) return [];
  if (current === 'published' && !canPublishContent(role)) return [];
  return MENU_STATUSES
    .filter((status) => status !== current)
    .filter((status) => status !== 'published' || canPublishContent(role))
    .filter(() => current !== 'archived' || canArchive)
    .filter((status) => status !== 'archived' || canArchive);
}

function statusItemLabel(from: PageStatus, to: PageStatus): string {
  if (from === 'archived') return `Restore as ${STATUS_LABELS[to]}`;
  if (to === 'published') return 'Publish';
  if (to === 'draft') return 'Move to draft';
  return 'Archive';
}

const SKELETON_ROWS = [0, 1, 2, 3, 4];

// The same screen lists a site's pages, or with `contentType` the entries of one
// content type (TYP-01): the same statuses, archive tab, duplicate and editor.
function PagesListPage({ contentType }: { contentType?: ContentType } = {}) {
  const noun = contentType ? { plural: contentType.name, singular: contentType.singularName } : { plural: 'Pages', singular: 'Page' };
  const prefix = contentType?.prefix;
  const [tab, setTab] = useState<Tab>('active');
  // Affordance only (admin/CLAUDE.md invariant 3): a Viewer sees the list without its actions.
  const role = getActiveMembership()?.role;
  const canWrite = canWriteContent(role);
  // "Edit" where this person can change the page, "Open" where the editor will be read-only (GOV-07).
  const canEdit = (status: PageStatus) => canWrite && !isLocked(status) && (status !== 'published' || canPublishContent(role));
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [archived, setArchived] = useState<PageSummary[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // The copy just made, so its row can be highlighted and announced.
  const [justCopied, setJustCopied] = useState<PageSummary | null>(null);
  // A publish (or restore to published) the API refused, with why (CNT-12).
  const [refused, setRefused] = useState<{ page: PageSummary; checks: PublishChecks } | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // The side panel's page is in the address (`?view=<slug>`), so it can be shared (ADM-05).
  const [searchParams, setSearchParams] = useSearchParams();
  const viewSlug = searchParams.get('view');
  const tableRef = useRef<HTMLDivElement>(null);

  // Both lists load together so the tab counts are right; moving to a tab quietly refreshes it.
  const fetchList = useCallback(
    async (which: 'active' | 'archived') => {
      const result = await (which === 'archived' ? listArchivedPages(prefix) : listPages(prefix));
      if (which === 'archived') setArchived(result);
      else setPages(result);
    },
    [prefix],
  );

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    Promise.all([fetchList('active'), fetchList('archived')])
      .then(() => {
        if (!cancelled) setLoad({ status: 'ready' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({ status: 'error', message: error instanceof Error ? error.message : `Failed to load ${noun.plural.toLowerCase()}` });
      });
    return () => {
      cancelled = true;
    };
  }, [fetchList, noun.plural, reloadKey]);

  function changeTab(next: Tab) {
    if (next === tab) return;
    setTab(next);
    setJustCopied(null);
    setRefused(null);
    setActionError(null);
    setStatusFilter('all');
    if (load.status === 'ready') fetchList(next === 'archived' ? 'archived' : 'active').catch((error: unknown) =>
        setActionError(error instanceof Error ? error.message : 'Could not refresh the list'),
      );
  }

  async function handleStatusChange(page: PageSummary, status: PageStatus) {
    if (status === 'archived' && !window.confirm(`Archive "${page.title}"? It will be hidden from the site and moved to the Archived tab.`)) return;
    setBusySlug(page.slug);
    setActionError(null);
    setJustCopied(null);
    setRefused(null);
    try {
      const updated = await setPageStatus(page.slug, status);
      // A page crossing the archived line changes list; any other move (draft <-> published) updates its row in place.
      if (page.status === 'archived') {
        setArchived((prev) => prev.filter((p) => p.slug !== page.slug));
        setPages((prev) => [updated, ...prev]);
      } else if (status === 'archived') {
        setPages((prev) => prev.filter((p) => p.slug !== page.slug));
        setArchived((prev) => [updated, ...prev]);
      } else setPages((prev) => prev.map((p) => (p.slug === page.slug ? updated : p)));
    } catch (error) {
      const checks = publishChecksFromError(error);
      if (checks) setRefused({ page, checks });
      else setActionError(error instanceof Error ? error.message : 'Could not change this page’s status');
    } finally {
      setBusySlug(null);
    }
  }

  async function handleDuplicate(page: PageSummary) {
    setBusySlug(page.slug);
    setActionError(null);
    try {
      const copy = await duplicatePage(page.slug);
      // Newest first, matching the API's order (updatedAt desc).
      setPages((prev) => [copy, ...prev]);
      setJustCopied(copy);
      setQuery('');
      setStatusFilter('all');
      setTab('active');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not duplicate this page');
    } finally {
      setBusySlug(null);
    }
  }

  async function handleDelete(page: PageSummary) {
    if (!window.confirm(`Permanently delete "${page.title}"? This can't be undone.`)) return;
    setBusySlug(page.slug);
    setActionError(null);
    try {
      await deletePage(page.slug);
      setArchived((prev) => prev.filter((p) => p.slug !== page.slug));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete this page');
    } finally {
      setBusySlug(null);
    }
  }

  const openDetails = (page: PageSummary) => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('view', page.slug); return next; }, { replace: true });
  const closeDetails = useCallback(
    (slug: string) => {
      setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete('view'); return next; }, { replace: true });
      // Focus goes back to the row's title once the panel has gone.
      requestAnimationFrame(() => {
        const trigger = Array.from(tableRef.current?.querySelectorAll<HTMLElement>('[data-row-trigger]') ?? []).find((el) => el.dataset.rowTrigger === slug);
        trigger?.focus();
      });
    },
    [setSearchParams],
  );

  function rowMenu(page: PageSummary): MenuItem[] {
    const items: MenuItem[] = [];
    if (page.status !== 'archived') {
      items.push({ id: 'edit', label: canEdit(page.status) ? 'Edit' : 'Open', href: `/editor/${page.slug}` });
    }
    items.push({ id: 'details', label: 'Details', onSelect: () => openDetails(page) });
    if (page.status !== 'archived') items.push({ id: 'live', label: 'View live', href: siteUrl(page.path), external: true });
    let first = true;
    if (canWrite && page.status !== 'archived') {
      items.push({ id: 'duplicate', label: 'Duplicate', separatorBefore: true, onSelect: () => handleDuplicate(page) });
      first = false;
    }
    for (const target of statusTargets(page.status)) {
      items.push({
        id: `status-${target}`,
        label: statusItemLabel(page.status, target),
        separatorBefore: first,
        onSelect: () => handleStatusChange(page, target),
      });
      first = false;
    }
    if (page.status === 'archived' && canWrite) {
      items.push({ id: 'delete', label: 'Delete permanently', danger: true, separatorBefore: true, onSelect: () => handleDelete(page) });
    }
    return items;
  }

  const inReview = useMemo(() => pages.filter((page) => page.status === 'in_review'), [pages]);
  const tabRows = tab === 'active' ? pages : tab === 'review' ? inReview : archived;
  const counts = useMemo(() => statusCounts(tabRows), [tabRows]);
  const rows = useMemo(() => filterRows(tabRows, query, tab === 'active' ? statusFilter : 'all'), [tabRows, query, statusFilter, tab]);
  const filtering = query.trim() !== '' || (tab === 'active' && statusFilter !== 'all');
  // Pages show each child under its parent (CNT-05) while nothing is filtered; entries never nest.
  const ordered = useMemo(
    () => (contentType || tab !== 'active' || filtering ? rows.map((page) => ({ page, depth: 1 })) : orderAsTree(rows)),
    [rows, contentType, tab, filtering],
  );

  const viewPage = viewSlug ? [...pages, ...archived].find((page) => page.slug === viewSlug) : undefined;
  // A shared link to a page that is gone (or in another type's list) just opens the list.
  useEffect(() => {
    if (viewSlug && load.status === 'ready' && !viewPage) {
      setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete('view'); return next; }, { replace: true });
    }
  }, [viewSlug, viewPage, load.status, setSearchParams]);

  const statusOptionsForFilter = (['all', 'published', 'draft', 'in_review', 'scheduled'] as StatusFilter[])
    .filter((value) => value === 'all' || counts[value] > 0 || statusFilter === value)
    .map((value) => ({ value, label: `${value === 'all' ? 'All statuses' : STATUS_LABELS[value]} (${counts[value]})` }));

  const loaded = load.status === 'ready';
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'active', label: 'All', count: pages.length },
    { id: 'review', label: 'In review', count: inReview.length },
    { id: 'archived', label: 'Archived', count: archived.length },
  ];
  const noun2 = noun.plural.toLowerCase();

  return (
    <>
      <div className="pages-header">
        <h1 className="pages-title">{noun.plural}</h1>
        <span className="pages-count">{loaded ? `${pages.length} ${pages.length === 1 ? noun.singular.toLowerCase() : noun2}` : ''}</span>
        {canWrite && (
          <Link to={contentType ? `/content/${contentType.prefix}/new` : '/pages/new'} className="pages-add">
            Add {noun.singular}
          </Link>
        )}
      </div>

      <div className="pages-tabs" role="tablist" aria-label={`${noun.plural} views`}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`pages-tab ${tab === item.id ? 'pages-tab-active' : ''}`}
            onClick={() => changeTab(item.id)}
          >
            {item.label}
            {loaded && <span className="pages-tab-count">{item.count}</span>}
          </button>
        ))}
      </div>

      {loaded && tabRows.length > 0 && (
        <div className="pl-toolbar">
          <div className="pl-search">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13.5 13.5L17 17" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title or path"
              aria-label={`Search ${noun2} by title or path`}
            />
          </div>
          {tab === 'active' && (
            <Select className="pl-status-filter" aria-label="Filter by status" value={statusFilter} onChange={setStatusFilter} options={statusOptionsForFilter} />
          )}
        </div>
      )}

      {load.status === 'error' && (
        <div className="pl-state pl-state-error" role="alert">
          <p className="pages-error">{load.message}</p>
          <button type="button" className="pl-btn" onClick={() => setReloadKey((key) => key + 1)}>
            Try again
          </button>
        </div>
      )}
      {actionError && (
        <p className="pages-error" role="alert">
          {actionError}
        </p>
      )}
      {refused && (
        <div className="pages-checks">
          <PublishChecksPanel checks={refused.checks} pageTitle={refused.page.title} onClose={() => setRefused(null)}>
            {refused.page.status !== 'archived' && <Link to={`/editor/${refused.page.slug}`}>Fix in editor</Link>}
          </PublishChecksPanel>
        </div>
      )}
      <p className="pages-notice" aria-live="polite">
        {justCopied && tab === 'active' && (
          <>
            Created “{justCopied.title}” at {justCopied.path} as a draft.{' '}
            <Link to={`/editor/${justCopied.slug}`}>Open in editor</Link>
          </>
        )}
      </p>

      {load.status === 'loading' && (
        <div className="pl-skeleton" aria-busy="true" aria-label={`Loading ${noun2}`}>
          <p className="pages-loading">Loading…</p>
          {SKELETON_ROWS.map((row) => (
            <div key={row} className="pl-skeleton-row" />
          ))}
        </div>
      )}

      {loaded && ordered.length === 0 && (
        <div className="pl-state">
          {filtering ? (
            <>
              <p className="pl-state-title">No {noun2} match{query.trim() ? ` “${query.trim()}”` : ' this filter'}.</p>
              <button
                type="button"
                className="pl-btn"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('all');
                }}
              >
                Clear search and filter
              </button>
            </>
          ) : tab === 'active' ? (
            <>
              <p className="pl-state-title">No {noun2} yet.</p>
              {canWrite && (
                <Link to={contentType ? `/content/${contentType.prefix}/new` : '/pages/new'} className="pages-add pl-state-add">
                  Add {noun.singular}
                </Link>
              )}
            </>
          ) : tab === 'review' ? (
            <p className="pl-state-title">Nothing is waiting for review.</p>
          ) : (
            <p className="pl-state-title">No archived {noun2}.</p>
          )}
        </div>
      )}

      {loaded && ordered.length > 0 && (
        <div ref={tableRef}>
          <table className="pages-table pl-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>{tab === 'archived' ? 'Archived' : 'Updated'}</th>
                <th>
                  <span className="pl-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ordered.map(({ page, depth }) => {
                const busy = busySlug === page.slug;
                const when = tab === 'archived' ? page.archivedAt ?? page.updatedAt : page.updatedAt;
                const terms = [...page.categories, ...page.tags];
                return (
                  <tr
                    key={page.slug}
                    className={`${justCopied?.slug === page.slug ? 'pages-row-new' : ''} ${viewSlug === page.slug ? 'pl-row-open' : ''}`}
                    aria-busy={busy || undefined}
                  >
                    <td className="pl-cell-title" style={depth > 1 ? { paddingLeft: `${1 + (depth - 1) * 1.25}rem` } : undefined}>
                      {depth > 1 && <span className="pl-indent" aria-hidden="true" />}
                      <button
                        type="button"
                        className="pages-row-title pl-title-btn"
                        data-row-trigger={page.slug}
                        aria-haspopup="dialog"
                        onClick={() => openDetails(page)}
                      >
                        {page.title}
                      </button>
                      <span className="pages-row-path pl-path">{page.path}</span>
                      {terms.length > 0 && (
                        <ul className="pl-terms" aria-label="Categories and tags">
                          {terms.map((term) => (
                            <li key={`${term.id}`}>{term.name}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="pl-cell-status">
                      <span className={`pages-status pages-status-${page.status}`}>{busy ? 'Saving…' : STATUS_LABELS[page.status]}</span>
                      {page.status === 'scheduled' && page.publishAt && (
                        <span className="pages-status-when">
                          <time dateTime={page.publishAt}>{scheduleLabel(page.publishAt)}</time>
                        </span>
                      )}
                    </td>
                    <td className="pl-cell-updated">
                      {when && (
                        <time dateTime={when} title={new Date(when).toLocaleString()}>
                          {updatedLabel(when)}
                        </time>
                      )}
                    </td>
                    <td className="pl-cell-actions">
                      <Menu label={`Actions for ${page.title}`} items={rowMenu(page)} disabled={busy} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewPage && <ContentSidePanel page={viewPage} canEdit={canEdit(viewPage.status)} onClose={() => closeDetails(viewPage.slug)} />}
    </>
  );
}

export default PagesListPage;
