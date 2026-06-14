import { useContext } from 'react'
import type { Repository } from '../../persistence'
import { RepositoryContext } from './repositoryContextStore'

/** The Repository used to load and save templates, instances, and drafts. */
export function useRepository(): Repository {
  return useContext(RepositoryContext)
}
