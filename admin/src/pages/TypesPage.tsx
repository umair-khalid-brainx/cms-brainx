import { useState } from 'react'
import { Link } from 'react-router'
import { ContentTypeForm } from '../components/ContentTypeForm'
import { useContentTypes } from '../lib/contentTypesContext'
import { getSession } from '../lib/auth'
import { canManageSite } from '../lib/roles'
import { deleteContentType, type ContentType } from '../lib/typesApi'
import './PagesListPage.css'
import './TypesPage.css'

// Where a site's staff add the kinds of content it needs beyond pages (TYP-01):
// events, team members, case studies. A new type joins the sidebar at once.
function TypesPage() {
  const { state, types, refresh } = useContentTypes()
  // Affordance only: the API refuses everyone but owners and administrators.
  const canManage = canManageSite(getSession()?.memberships[0]?.role)
  const [editing, setEditing] = useState<ContentType | 'new' | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSaved(saved: ContentType) {
    const wasNew = editing === 'new'
    setEditing(null)
    setActionError(null)
    await refresh()
    setNotice(wasNew ? `Added ${saved.name}. It is in the menu now.` : `Saved ${saved.name}.`)
  }

  async function handleDelete(type: ContentType) {
    if (!window.confirm(`Delete the content type “${type.name}”? This can’t be undone.`)) return
    setBusyId(type.id)
    setActionError(null)
    setNotice(null)
    try {
      await deleteContentType(type.id)
      await refresh()
      setNotice(`Deleted ${type.name}.`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete this content type')
    } finally {
      setBusyId(null)
    }
  }

  if (!canManage) {
    return <p className="pages-loading">Only owners and administrators can manage content types.</p>
  }

  return (
    <>
      <div className="pages-header">
        <h1 className="pages-title">Content types</h1>
        <span className="pages-count">{state.status === 'ready' ? `${types.length} ${types.length === 1 ? 'type' : 'types'}` : ''}</span>
        <button
          type="button"
          className="pages-add types-add"
          onClick={() => {
            setNotice(null)
            setEditing('new')
          }}
        >
          Add type
        </button>
      </div>

      <p className="types-intro">
        Pages are for one-off content. Add a content type for things you publish many of, like events, team members or
        case studies. Each type gets its own place in the menu and its own web address.
      </p>

      {state.status === 'loading' && <p className="pages-loading">Loading…</p>}
      {state.status === 'error' && <p className="pages-error">{state.message}</p>}
      {actionError && (
        <p className="pages-error" role="alert">
          {actionError}
        </p>
      )}
      <p className="pages-notice" aria-live="polite">
        {notice}
      </p>

      {state.status === 'ready' && (
        <table className="pages-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>Entries</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {types.map((type) => (
              <tr key={type.id}>
                <td>
                  <Link to={`/content/${type.prefix}`} className="pages-row-title">
                    {type.name}
                  </Link>
                  {type.isBuiltIn && <span className="types-badge">Built in</span>}
                </td>
                <td className="pages-row-path">/{type.prefix}</td>
                <td className="pages-row-path">
                  {type.entryCount === 0 ? 'None yet' : `${type.entryCount} ${type.entryCount === 1 ? 'entry' : 'entries'}`}
                </td>
                <td className="pages-row-actions">
                  <button type="button" className="types-action" onClick={() => setEditing(type)}>
                    Edit
                  </button>
                  {!type.isBuiltIn && (
                    <button
                      type="button"
                      className="pages-row-delete"
                      disabled={busyId === type.id || type.locked}
                      title={type.locked ? 'Delete its entries first (archived ones count)' : undefined}
                      onClick={() => handleDelete(type)}
                    >
                      {busyId === type.id ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <ContentTypeForm
          type={editing === 'new' ? undefined : editing}
          onSaved={handleSaved}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

export default TypesPage
