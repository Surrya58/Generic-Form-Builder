import { useState } from 'react'
import { probeStorage } from '../../persistence/probeStorage'
import type { StorageAdapter } from '../../persistence/types'

/**
 * Probes `adapter` once, on first render, so the Builder/Fill screens can
 * warn the user up front if storage is unavailable (e.g. private browsing)
 * rather than only discovering it on the first failed autosave.
 */
export function useStorageAvailability(adapter: StorageAdapter): 'writable' | 'unavailable' {
  const [status] = useState(() => probeStorage(adapter))
  return status
}
