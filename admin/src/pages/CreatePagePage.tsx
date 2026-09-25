import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { createPage } from '../lib/contentApi'
import { ApiError } from '../lib/api'
import './CreatePagePage.css'

function CreatePagePage() {
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
      const page = await createPage(title)
      navigate(`/editor/${page.slug}`, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this page — check your connection')
      setCreating(false)
    }
  }

  return (
    <>
      <div className="create-page-header">
        <h1 className="create-page-title">Add New Page</h1>
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
            <Link to="/pages" className="create-page-cancel">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </>
  )
}

export default CreatePagePage
