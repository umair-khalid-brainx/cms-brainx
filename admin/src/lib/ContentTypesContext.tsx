import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ContentTypesContext, type ContentTypesState, type ContentTypesValue } from './contentTypesContext'
import { listContentTypes } from './typesApi'

// The site's content types, loaded once for the whole admin and shared: the
// sidebar lists them, and the Types screen reloads them after every change, so a
// new type shows up in the navigation straight away without a page reload (TYP-01).
export function ContentTypesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContentTypesState>({ status: 'loading' })

  const refresh = useCallback(async () => {
    try {
      setState({ status: 'ready', types: await listContentTypes() })
    } catch (error) {
      // A failed reload keeps what the sidebar already shows; only a first load that fails is an error.
      setState((current) =>
        current.status === 'ready'
          ? current
          : { status: 'error', message: error instanceof Error ? error.message : 'Could not load content types' },
      )
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<ContentTypesValue>(
    () => ({ state, types: state.status === 'ready' ? state.types : [], refresh }),
    [state, refresh],
  )
  return <ContentTypesContext.Provider value={value}>{children}</ContentTypesContext.Provider>
}
