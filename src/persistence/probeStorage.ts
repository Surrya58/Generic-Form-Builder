import type { StorageAdapter } from './types'

const PROBE_KEY = 'fb:__probe__'

/**
 * Tries a tiny write/remove round-trip so the app can detect private-mode
 * or otherwise blocked storage at boot, before any real data is at risk.
 */
export function probeStorage(adapter: StorageAdapter): 'writable' | 'unavailable' {
  try {
    adapter.setItem(PROBE_KEY, '1')
    adapter.removeItem(PROBE_KEY)
    return 'writable'
  } catch {
    return 'unavailable'
  }
}
