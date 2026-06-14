import type { StorageAdapter } from './types'

/** The real adapter, backed by window.localStorage. */
export function createLocalStorageAdapter(): StorageAdapter {
  return {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => {
      localStorage.setItem(key, value)
    },
    removeItem: (key) => {
      localStorage.removeItem(key)
    },
  }
}
