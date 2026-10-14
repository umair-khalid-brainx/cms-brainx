import { useParams } from 'react-router'
import { Link, Navigate } from '../lib/siteRouter'
import { useContentTypes, type ContentTypesState } from '../lib/contentTypesContext'
import CreatePagePage from './CreatePagePage'
import PagesListPage from './PagesListPage'

// The two screens a content type adds to the admin (TYP-01): its entries, and
// adding one. They are the Pages screens pointed at the type, found by the
// address prefix in the URL (`/content/events`).
function useRouteType() {
  const { prefix } = useParams()
  const { state, types } = useContentTypes()
  return { prefix, state, type: types.find((candidate) => candidate.prefix === prefix) }
}

function Missing({ state }: { state: ContentTypesState }) {
  if (state.status === 'loading') return <p className="pages-loading">Loading…</p>
  if (state.status === 'error') return <p className="pages-error">{state.message}</p>
  return (
    <p className="pages-loading">
      There is no content type at this address. <Link to="/pages">Back to pages</Link>
    </p>
  )
}

export function TypeEntriesPage() {
  const { prefix, state, type } = useRouteType()
  if (!type) return <Missing state={state} />
  // `key` so moving between two types starts a fresh list instead of showing the old one.
  return <PagesListPage key={prefix} contentType={type} />
}

export function CreateEntryPage() {
  const { prefix, state, type } = useRouteType()
  if (!type) return state.status === 'ready' ? <Navigate to="/pages" replace /> : <Missing state={state} />
  return <CreatePagePage key={prefix} contentType={type} />
}
