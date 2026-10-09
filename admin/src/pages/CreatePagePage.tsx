import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { createPage } from '../lib/contentApi'
import { ApiError } from '../lib/api'
import type { ContentType } from '../lib/typesApi'
import './CreatePagePage.css'

// With `contentType`, adds an entry of that type instead of a page (TYP-01).
function CreatePagePage({ contentType }: { contentType?: ContentType } = {}) {
  const noun = contentType?.singularName ?? 'Page'
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    setError(null)
    try {
      const page = await createPage(title, '', contentType?.prefix)
      navigate(`/editor/${page.slug}`, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not create this ${noun.toLowerCase()} — check your connection`)
      setCreating(false)
    }
  }

  return (
    <>
      <div className="create-page-header">
        <h1 className="create-page-title">Add New {noun}</h1>
      </div>

      <section className="create-page-card">
        <form className="create-page-form" onSubmit={handleSubmit}>
          <label htmlFor="new-page-title">Title</label>
          <input
            id="new-page-title"
            type="text"
            placeholder="Untitled"
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={creating}
          />

          {error ? <p className="create-page-error">{error}</p> : null}

          <div className="create-page-actions">
            <button type="submit" className="create-page-submit" disabled={creating || !title.trim()}>
              {creating ? 'Creating…' : 'Start Editing'}
            </button>
            <Link to={contentType ? `/content/${contentType.prefix}` : '/pages'} className="create-page-cancel">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </>
  )
}

export default CreatePagePage
