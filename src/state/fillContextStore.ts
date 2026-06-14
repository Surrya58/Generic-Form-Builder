import { createContext, type Dispatch } from 'react'
import type { FillAction, FillState } from './fillReducer'

export interface FillContextValue {
  state: FillState
  dispatch: Dispatch<FillAction>
}

export const FillContext = createContext<FillContextValue | null>(null)
