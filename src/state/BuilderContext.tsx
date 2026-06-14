import { useMemo, useReducer, type ReactNode } from 'react'
import type { Template } from '../domain'
import { BuilderContext, type BuilderContextValue } from './builderContextStore'
import { builderReducer, createInitialState } from './builderReducer'

export function BuilderProvider({
  template,
  draftTemplate,
  children,
}: {
  /** The last saved template — the baseline for the dirty check and Discard. */
  template: Template
  /**
   * A restored autosaved draft (from a refresh mid-edit) to use as the
   * working copy. `template` stays the saved baseline, so Discard reverts to
   * it and the autosave status reflects unsaved changes.
   */
  draftTemplate?: Template
  children: ReactNode
}) {
  const [state, dispatch] = useReducer(builderReducer, null, () => {
    const initial = createInitialState(template)
    return draftTemplate ? { ...initial, template: draftTemplate } : initial
  })
  const value = useMemo<BuilderContextValue>(() => ({ state, dispatch }), [state])

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>
}
