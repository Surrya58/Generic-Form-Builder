import { useMemo, useReducer, type ReactNode } from 'react'
import type { Template } from '../domain'
import { BuilderContext, type BuilderContextValue } from './builderContextStore'
import { builderReducer, createInitialState } from './builderReducer'

export function BuilderProvider({
  template,
  children,
}: {
  template: Template
  children: ReactNode
}) {
  const [state, dispatch] = useReducer(builderReducer, template, createInitialState)
  const value = useMemo<BuilderContextValue>(() => ({ state, dispatch }), [state])

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>
}
