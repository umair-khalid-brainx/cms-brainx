import { useEffect, useState } from 'react';
import { getActiveMembership } from '../lib/activeSite'
import { Link } from '../lib/siteRouter';
import PublishChecksPanel from '../components/PublishChecksPanel';
import Select, { type SelectOption } from '../components/Select';
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

// The row's dropdown lists every status except the one the page is already
// in, minus any the user's role can't move to (UI affordance only — the API
// enforces). Leaving or entering Archived needs the same right as archiving.
// A page in review or scheduled has no menu: it's locked until that step ends.
// A live page can be changed only by someone who can publish (GOV-07).
function statusOptions(current: PageStatus): SelectOption<PageStatus>[] {
  const role = getActiveMembership()?.role;
  const canArchive = canArchiveContent(role);
  if (isLocked(current) || !canWriteContent(role)) return [];
  if (current === 'published' && !canPublishContent(role)) return [];
  return MENU_STATUSES
    .filter((status) => status !== current)
    .filter((status) => status !== 'published' || canPublishContent(role))
    .filter(() => current !== 'archived' || canArchive)
    .filter((status) => status !== 'archived' || canArchive)
    .map((value) => ({ value, label: STATUS_LABELS[value] }));
}

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
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // The copy just made, so its row can be highlighted and announced.
  const [justCopied, setJustCopied] = useState<PageSummary | null>(null);
  // A publish (or restore to published) the API refused, with why (CNT-12).
  const [refused, setRefused] = useState<{ page: PageSummary; checks: PublishChecks } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    setJustCopied(null);
    setRefused(null);
    (tab === 'archived' ? listArchivedPages(prefix) : listPages(prefix))
      .then((result) => {
        if (cancelled) return;
        if (tab !== 'archived') setPages(result);
        else setArchived(result);
        setLoad({ status: 'ready' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({ status: 'error', message: error instanceof Error ? error.message : `Failed to load ${noun.plural.toLowerCase()}` });
      });
    return () => {
      cancelled = true;
    };
  }, [tab, prefix, noun.plural]);

  async function handleStatusChange(page: PageSummary, status: PageStatus) {
    if (status === 'archived' && !window.confirm(`Archive "${page.title}"? It will be hidden from the site and moved to the Archived tab.`)) return;
    setBusySlug(page.slug);
    setActionError(null);
    setJustCopied(null);
    setRefused(null);
    try {
      const updated = await setPageStatus(page.slug, status);
      // A page crossing the archived line leaves this tab's list; any other
      // move (draft <-> published) just updates its row in place.
      if (page.status === 'archived') setArchived((prev) => prev.filter((p) => p.slug !== page.slug));
      else if (status === 'archived') setPages((prev) => prev.filter((p) => p.slug !== page.slug));
      else setPages((prev) => prev.map((p) => (p.slug === page.slug ? updated : p)));
    } catch (error) {
      const checks = publishChecksFromError(error);
      if (checks) setRefused({ page, checks });
      else setActionError(error instanceof Error ? error.message : 'Could not change this page’s status');
    } finally {
      setBusySlug(null);
    }
  }

  function statusMenu(page: PageSummary) {
    const options = statusOptions(page.status);
    if (options.length === 0) return null;
    return (
      <Select
        className="pages-row-status-menu"
        value={page.status}
        placeholder={busySlug === page.slug ? 'Saving…' : 'Change status'}
        options={options}
        disabled={busySlug === page.slug}
        onChange={(status) => handleStatusChange(page, status)}
      />
    );
  }

  async function handleDuplicate(page: PageSummary) {
    setBusySlug(page.slug);
    setActionError(null);
    try {
      const copy = await duplicatePage(page.slug);
      // Newest first, matching the API's order (updatedAt desc).
      setPages((prev) => [copy, ...prev]);
      setJustCopied(copy);
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

  const inReview = pages.filter((page) => page.status === 'in_review');
  const rows = tab === 'active' ? pages : tab === 'review' ? inReview : archived;

  return (
    <>
      <div className="pages-header">
        <h1 className="pages-title">{noun.plural}</h1>
        <span className="pages-count">
          {load.status === 'ready' ? `${rows.length} ${tab === 'active' ? noun.plural.toLowerCase() : tab === 'review' ? 'in review' : 'archived'}` : ''}
        </span>
        {canWrite && (
          <Link to={contentType ? `/content/${contentType.prefix}/new` : '/pages/new'} className="pages-add">
            Add {noun.singular}
          </Link>
        )}
      </div>

      <div className="pages-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'active'} className={`pages-tab ${tab === 'active' ? 'pages-tab-active' : ''}`} onClick={() => setTab('active')}>
          {noun.plural}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'review'} className={`pages-tab ${tab === 'review' ? 'pages-tab-active' : ''}`} onClick={() => setTab('review')}>
          In review
        </button>
        <button type="button" role="tab" aria-selected={tab === 'archived'} className={`pages-tab ${tab === 'archived' ? 'pages-tab-active' : ''}`} onClick={() => setTab('archived')}>
          Archived
        </button>
      </div>

      {load.status === 'error' && <p className="pages-error">{load.message}</p>}
      {load.status === 'loading' && <p className="pages-loading">Loading…</p>}
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

      {load.status === 'ready' && rows.length === 0 && (
        <p className="pages-loading">
          {tab === 'active'
            ? `No ${noun.plural.toLowerCase()} yet.`
            : tab === 'review'
              ? `Nothing is waiting for review.`
              : `No archived ${noun.plural.toLowerCase()}.`}
        </p>
      )}

      {load.status === 'ready' && rows.length > 0 && tab !== 'archived' && (
        <table className="pages-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Path</th>
              <th>Status</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {/* Pages show each child under its parent, like WordPress (CNT-05); entries never nest. */}
            {(contentType || tab === 'review' ? rows.map((page) => ({ page, depth: 1 })) : orderAsTree(rows)).map(({ page, depth }) => (
              <tr key={page.slug} className={justCopied?.slug === page.slug ? 'pages-row-new' : undefined}>
                <td>
                  {depth > 1 ? (
                    // The path column already says where it sits, so the dashes are only for the eye.
                    <span className="pages-row-indent" aria-hidden="true">
                      {'\u2014 '.repeat(depth - 1)}
                    </span>
                  ) : null}
                  <Link to={`/editor/${page.slug}`} className="pages-row-title">
                    {page.title}
                  </Link>
                </td>
                <td className="pages-row-path">{page.path}</td>
                <td>
                  <span className={`pages-status pages-status-${page.status}`}>{STATUS_LABELS[page.status]}</span>
                  {page.status === 'scheduled' && page.publishAt && (
                    <span className="pages-status-when">
                      <time dateTime={page.publishAt}>{scheduleLabel(page.publishAt)}</time>
                    </span>
                  )}
                </td>
                <td className="pages-row-actions">
                  <Link to={`/editor/${page.slug}`}>{canEdit(page.status) ? 'Edit' : 'Open'}</Link>
                  <a href={siteUrl(page.path)} target="_blank" rel="noreferrer">
                    View
                    <span aria-hidden="true">&#8599;</span>
                  </a>
                  {canWrite && (
                    <button
                      type="button"
                      className="pages-row-duplicate"
                      disabled={busySlug === page.slug}
                      onClick={() => handleDuplicate(page)}
                    >
                      {busySlug === page.slug ? 'Duplicating…' : 'Duplicate'}
                    </button>
                  )}
                  {statusMenu(page)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {load.status === 'ready' && rows.length > 0 && tab === 'archived' && (
        <table className="pages-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Path</th>
              <th>Archived</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {archived.map((page) => (
              <tr key={page.slug}>
                <td className="pages-row-title">{page.title}</td>
                <td className="pages-row-path">{page.path}</td>
                <td className="pages-row-path">{page.archivedAt ? new Date(page.archivedAt).toLocaleDateString() : ''}</td>
                <td className="pages-row-actions">
                  {statusMenu(page)}
                  <button
                    type="button"
                    className="pages-row-delete"
                    disabled={busySlug === page.slug}
                    onClick={() => handleDelete(page)}
                  >
                    {busySlug === page.slug ? 'Deleting…' : 'Delete Permanently'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default PagesListPage;
