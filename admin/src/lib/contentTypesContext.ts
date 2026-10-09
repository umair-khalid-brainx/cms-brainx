import { createContext, useContext } from 'react'
import type { ContentType } from './typesApi'

export type ContentTypesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; types: ContentType[] }

export type ContentTypesValue = {
  state: ContentTypesState
  /** Types, or an empty list until they have loaded. */
  types: ContentType[]
  /** Reload after a type is created, renamed or deleted, so the sidebar changes at once. */
  refresh: () => Promise<void>
}

export const ContentTypesContext = createContext<ContentTypesValue | null>(null)

export function useContentTypes(): ContentTypesValue {
  const value = useContext(ContentTypesContext)
  if (!value) throw new Error('useContentTypes must be used inside ContentTypesProvider')
  return value
}
