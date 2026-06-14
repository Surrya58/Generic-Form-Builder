import type { ReactNode } from 'react'
import type { Repository } from '../../persistence'
import { defaultRepository, RepositoryContext } from './repositoryContextStore'

export interface RepositoryProviderProps {
  /** Defaults to a localStorage-backed repository; tests inject an in-memory one. */
  repository?: Repository
  children: ReactNode
}

export function RepositoryProvider({ repository, children }: RepositoryProviderProps) {
  return (
    <RepositoryContext.Provider value={repository ?? defaultRepository}>
      {children}
    </RepositoryContext.Provider>
  )
}
