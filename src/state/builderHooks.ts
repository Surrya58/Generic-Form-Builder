import { useContext } from 'react'
import type { Field } from '../domain'
import { BuilderContext, type BuilderContextValue } from './builderContextStore'

export function useBuilder(): BuilderContextValue {
  const context = useContext(BuilderContext)
  if (context === null) {
    throw new Error('useBuilder must be used within a BuilderProvider')
  }
  return context
}

/** The currently selected field, or null if none is selected. */
export function useSelectedField(): Field | null {
  const { state } = useBuilder()
  return state.template.fields.find((field) => field.id === state.selectedFieldId) ?? null
}

/** Whether the template has unsaved changes since the last save (or load). */
export function useIsDirty(): boolean {
  const { state } = useBuilder()
  return state.template !== state.savedTemplate
}
