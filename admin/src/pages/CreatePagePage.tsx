import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { createPage, listStarterLayouts, type StarterLayout } from '../lib/contentApi'
import { config } from '../puck/config'
import { ApiError } from '../lib/api'
import type { ContentType } from '../lib/typesApi'
import './CreatePagePage.css'

// With `contentType`, adds an entry of that type instead of a page (TYP-01).
function CreatePagePage({ contentType }: { contentType?: ContentType } = {}) {
  const noun = contentType?.singularName ?? 'Page'
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  // The starter arrangements to begin from (TYP-04). Blank is always first; a new Post
  // starts from Article, the one made for long-form writing.
  const [layouts, setLayouts] = useState<StarterLayout[]>([])
  const [layout, setLayout] = useState<string>(contentType?.prefix === 'blog' ? 'article' : '')

  useEffect(() => {
    // A failure only means no templates are offered: a blank page still works.
    listStarterLayouts().then(setLayouts, () => setLayouts([]))
  }, [])
  const [error, setError] = useState<string | null>(null)

  // Only a layout the screen actually loaded is sent: if the list couldn't be fetched, a new Post must still
  // be created blank, not ask the server for a layout the person never saw.
  const startFrom = layouts.some((option) => option.key === layout) ? layout : undefined

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    setError(null)
    try {
      const page = await createPage(title, '', contentType?.prefix, startFrom)
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

          {layouts.length > 0 && (
            <fieldset className="layout-picker" disabled={creating}>
              <legend id="layout-picker-label">Start from</legend>
              <div className="layout-picker-grid" role="radiogroup" aria-labelledby="layout-picker-label">
                <LayoutOption
                  value=""
                  checked={startFrom === undefined}
                  name="Blank"
                  description="An empty page. Add blocks yourself."
                  onSelect={setLayout}
                />
                {layouts.map((option) => (
                  <LayoutOption
                    key={option.key}
                    value={option.key}
                    checked={startFrom === option.key}
                    name={option.name}
                    description={option.description}
                    includes={blockNames(option)}
                    onSelect={setLayout}
                  />
                ))}
              </div>
            </fieldset>
          )}

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

/** "Hero, Feature grid, Stats": what a layout is made of, in the editor's own names for the blocks. */
function blockNames(layout: StarterLayout): string {
  const labels = layout.blocks.map((block) => {
    const key = block.type.charAt(0).toUpperCase() + block.type.slice(1)
    return (config.components as Record<string, { label?: string }>)[key]?.label ?? block.type
  })
  return [...new Set(labels)].join(', ')
}

function LayoutOption({
  value,
  checked,
  name,
  description,
  includes,
  onSelect,
}: {
  value: string
  checked: boolean
  name: string
  description: string
  includes?: string
  onSelect: (value: string) => void
}) {
  return (
    <label className={`layout-option${checked ? ' is-selected' : ''}`}>
      <input
        type="radio"
        name="starting-layout"
        className="layout-option-input"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
      />
      <span className="layout-option-name">
        {name}
        {/* The selected card says so in a mark as well as in its outline, so it never relies on colour alone. */}
        {checked && (
          <svg className="layout-option-check" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path d="m4 10.5 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="layout-option-description">{description}</span>
      {includes && <span className="layout-option-includes">{includes}</span>}
    </label>
  )
}

export default CreatePagePage
