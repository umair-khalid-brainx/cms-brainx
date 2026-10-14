import { useEffect, useId, useRef, useSyncExternalStore } from 'react'
import { Link } from '../lib/siteRouter'
import type { PageStatus, PageSummary } from '../lib/contentApi'
import { seoSummary } from '../lib/seoSummary'
import { updatedLabel } from '../lib/listFilter'
import { scheduleLabel } from '../lib/workflow'
import { siteUrl } from '../data/site'
import './ContentSidePanel.css'

const STATUS_LABELS: Record<PageStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
  in_review: 'In review',
  scheduled: 'Scheduled',
}

type Props = {
  page: PageSummary
  /** "Edit" when this person can change the page, "Open" when the editor will be read-only. */
  canEdit: boolean
  onClose: () => void
}

const fullDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '')

/**
 * A read-only side view of a page or post (ADM-05), opened from the list without leaving it. Only shows what the
 * list already carries. Escape and the close button dismiss it; the list puts focus back on the row.
 * Below 720px it is a full-screen sheet and keeps Tab inside it.
 */
const NARROW = '(max-width: 720px)'
function subscribeNarrow(notify: () => void) {
  const query = window.matchMedia(NARROW)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}

export default function ContentSidePanel({ page, canEdit, onClose }: Props) {
  // Below 720px the panel is a full-screen sheet that traps Tab, so it is announced as modal too.
  const narrow = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches)
  const titleId = useId()
  const rootRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Focus moves in when it opens (the list restores it on close).
  useEffect(() => {
    closeRef.current?.focus()
  }, [page.slug])

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !window.matchMedia(NARROW).matches) return
      const focusable = rootRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])

  const seo = seoSummary(page.seo)
  const row = (label: string, value: React.ReactNode) => (
    <div className="csp-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )

  return (
    <>
      <div className="csp-scrim" onClick={onClose} aria-hidden="true" />
      <aside ref={rootRef} className="csp" role="dialog" aria-modal={narrow} aria-labelledby={titleId}>
        <header className="csp-head">
          <div>
            <p className="csp-eyebrow">Details</p>
            <h2 id={titleId} className="csp-title">
              {page.title}
            </h2>
          </div>
          <button ref={closeRef} type="button" className="csp-close" aria-label="Close details" onClick={onClose}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </header>

        <div className="csp-body">
          <dl className="csp-list">
            {row('Status', <span className={`pages-status pages-status-${page.status}`}>{STATUS_LABELS[page.status]}</span>)}
            {row('Path', <code className="csp-path">{page.path}</code>)}
            {page.status === 'scheduled' && page.publishAt && row('Goes live', <time dateTime={page.publishAt}>{scheduleLabel(page.publishAt)}</time>)}
            {page.updatedAt && row('Last updated', <time dateTime={page.updatedAt} title={fullDate(page.updatedAt)}>{updatedLabel(page.updatedAt)}</time>)}
            {page.archivedAt && row('Archived', <time dateTime={page.archivedAt}>{fullDate(page.archivedAt)}</time>)}
            {page.submittedAt && row('Sent for review', <time dateTime={page.submittedAt}>{fullDate(page.submittedAt)}</time>)}
            {page.categories.length > 0 && row('Categories', <ul className="csp-chips">{page.categories.map((t) => <li key={t.id}>{t.name}</li>)}</ul>)}
            {page.tags.length > 0 && row('Tags', <ul className="csp-chips">{page.tags.map((t) => <li key={t.id}>{t.name}</li>)}</ul>)}
          </dl>

          {page.reviewNote && (
            <section className="csp-section">
              <h3>Review note</h3>
              <p className="csp-note">{page.reviewNote}</p>
            </section>
          )}

          <section className="csp-section">
            <h3>Search and sharing</h3>
            {seo.empty ? (
              <p className="csp-muted">Nothing set. Search engines use the page title.</p>
            ) : (
              <dl className="csp-list">{seo.lines.map((line) => row(line.label, line.value))}</dl>
            )}
          </section>
        </div>

        <footer className="csp-foot">
          {page.status !== 'archived' && (
            <Link to={`/editor/${page.slug}`} className="csp-btn csp-btn-primary">
              {canEdit ? 'Edit' : 'Open'}
            </Link>
          )}
          {page.status !== 'archived' && (
            <a href={siteUrl(page.path)} target="_blank" rel="noreferrer" className="csp-btn">
              View live <span aria-hidden="true">&#8599;</span>
            </a>
          )}
        </footer>
      </aside>
    </>
  )
}
