import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { createDraftPage, listPages } from '../lib/pagesStore'
import { currentSite, siteUrl } from '../data/site'
import './DashboardPage.css'

// Activity is still fake flavor data — see FND-01/CNT-01. At a Glance and
// Quick Draft are real now: they read/write the same local pagesStore the
// Pages list and editor use.

const activity = [
  { slug: 'home', title: 'Home', action: 'Published', time: '2 hours ago' },
  { slug: 'wholesale', title: 'Wholesale', action: 'Published', time: 'Yesterday' },
  { slug: 'visit-the-farm', title: 'Visit the Farm', action: 'Published', time: '3 days ago' },
  { slug: 'harvest-log', title: 'Harvest Log', action: 'Published', time: '5 days ago' },
]

function DashboardPage() {
  const [pages, setPages] = useState(() => listPages())
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [savedSlug, setSavedSlug] = useState<string | null>(null)

  const publishedCount = pages.filter((page) => page.status === 'published').length
  const draftCount = pages.length - publishedCount

  function handleQuickDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() && !body.trim()) return
    const page = createDraftPage(title, body)
    setPages(listPages())
    setTitle('')
    setBody('')
    setSavedSlug(page.slug)
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
          <Link to="/pages" className="dash-new-page">
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
                <strong>{pages.length}</strong> Pages
              </li>
              <li>
                <strong>{publishedCount}</strong> Published
              </li>
              <li>
                <strong>{draftCount}</strong> Drafts
              </li>
              <li>
                <strong>{currentSite.name}</strong> current site
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
              />
              <textarea
                placeholder="What's on your mind?"
                rows={4}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
              <button type="submit">Save Draft</button>
            </form>
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
