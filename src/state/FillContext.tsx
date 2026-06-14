import { useMemo, useReducer, type ReactNode } from 'react'
import { FillContext, type FillContextValue } from './fillContextStore'
import { createInitialFillState, fillReducer, type FillInit } from './fillReducer'

export function FillProvider({ init, children }: { init: FillInit; children: ReactNode }) {
  const [state, dispatch] = useReducer(fillReducer, init, createInitialFillState)
  const value = useMemo<FillContextValue>(() => ({ state, dispatch }), [state])

  return <FillContext.Provider value={value}>{children}</FillContext.Provider>
}
