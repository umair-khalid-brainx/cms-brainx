import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { createPage, listPages, type PageSummary } from '../lib/contentApi'
import { siteUrl } from '../data/site'
import { getSession } from '../lib/auth'
import { ApiError } from '../lib/api'
import './DashboardPage.css'

// Activity is still fake flavor data — see FND-01/CNT-01. At a Glance and
// Quick Draft are real now: they read/write the real content API (CNT-01),
// same as the Pages list and editor.

const activity = [
  { slug: 'home', title: 'Home', action: 'Published', time: '2 hours ago' },
  { slug: 'wholesale', title: 'Wholesale', action: 'Published', time: 'Yesterday' },
  { slug: 'visit-the-farm', title: 'Visit the Farm', action: 'Published', time: '3 days ago' },
  { slug: 'harvest-log', title: 'Harvest Log', action: 'Published', time: '5 days ago' },
]

function DashboardPage() {
  const siteName = getSession()?.memberships[0]?.siteName ?? '—'
  const [pages, setPages] = useState<PageSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listPages()
      .then((result) => {
        if (cancelled) return
        setPages(result)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const publishedCount = pages.filter((page) => page.status === 'published').length
  const draftCount = pages.length - publishedCount

  async function handleQuickDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() && !body.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const page = await createPage(title, body)
      setPages((prev) => [...prev, page])
      setTitle('')
      setBody('')
      setSavedSlug(page.slug)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save draft — check your connection')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="dash-header">
        <h1 className="dash-title">Dashboard</h1>
        <div className="dash-header-actions">
          <a href={siteUrl()} target="_blank" rel="noreferrer" className="dash-visit-site">
            Visit Site
            <span aria-hidden="true">&#8599;</span>
          </a>
          <Link to="/pages/new" className="dash-new-page">
            Open Page Builder
          </Link>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          <section className="dash-widget">
            <h2 className="dash-widget-title">At a Glance</h2>
            <ul className="dash-glance">
              <li>
                <strong>{loaded ? pages.length : '—'}</strong> Pages
              </li>
              <li>
                <strong>{loaded ? publishedCount : '—'}</strong> Published
              </li>
              <li>
                <strong>{loaded ? draftCount : '—'}</strong> Drafts
              </li>
              <li>
                <strong>{siteName}</strong> current site
              </li>
            </ul>
          </section>

          <section className="dash-widget">
            <h2 className="dash-widget-title">Activity</h2>
            <ul className="dash-activity">
              {activity.map((item) => (
                <li key={item.slug}>
                  <Link to={`/editor/${item.slug}`} className="dash-activity-title">
                    {item.title}
                  </Link>
                  <span className="dash-activity-meta">
                    {item.action} &middot; {item.time}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="dash-col">
          <section className="dash-widget">
            <h2 className="dash-widget-title">Quick Draft</h2>
            <form className="dash-quick-draft" onSubmit={handleQuickDraft}>
              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={submitting}
              />
              <textarea
                placeholder="What's on your mind?"
                rows={4}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                disabled={submitting}
              />
              <button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save Draft'}
              </button>
            </form>
            {error ? <p className="dash-quick-draft-error">{error}</p> : null}
            {savedSlug ? (
              <p className="dash-quick-draft-note">
                Saved as a draft page — <Link to={`/editor/${savedSlug}`}>open it in the editor</Link>.
              </p>
            ) : null}
          </section>

          <section className="dash-widget">
            <h2 className="dash-widget-title">Site Health</h2>
            <p className="dash-health">
              <span className="dash-health-dot" />
              Your site is running smoothly.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}

export default DashboardPage
