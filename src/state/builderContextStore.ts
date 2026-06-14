import { createContext, type Dispatch } from 'react'
import type { BuilderAction, BuilderState } from './builderReducer'

export interface BuilderContextValue {
  state: BuilderState
  dispatch: Dispatch<BuilderAction>
}

export const BuilderContext = createContext<BuilderContextValue | null>(null)
