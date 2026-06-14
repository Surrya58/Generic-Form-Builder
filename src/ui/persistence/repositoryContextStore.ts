import { createContext } from 'react'
import { createLocalStorageAdapter, createRepository, type Repository } from '../../persistence'

export const defaultRepository = createRepository(createLocalStorageAdapter())

export const RepositoryContext = createContext<Repository>(defaultRepository)
