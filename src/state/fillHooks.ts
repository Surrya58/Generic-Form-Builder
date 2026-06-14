import { useContext } from 'react'
import { FillContext, type FillContextValue } from './fillContextStore'

export function useFill(): FillContextValue {
  const context = useContext(FillContext)
  if (context === null) {
    throw new Error('useFill must be used within a FillProvider')
  }
  return context
}
