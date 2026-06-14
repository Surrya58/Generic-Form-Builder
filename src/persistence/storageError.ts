import type { StorageResult } from './types'

/**
 * Maps a thrown storage error to a typed result. Handles the standard
 * QuotaExceededError (DOMException code 22) as well as Safari's legacy
 * QUOTA_EXCEEDED_ERR (code 1014).
 */
export function classifyStorageError(error: unknown): StorageResult<never> {
  if (error instanceof DOMException) {
    const isQuotaError =
      error.name === 'QuotaExceededError' ||
      error.name === 'QUOTA_EXCEEDED_ERR' ||
      error.code === 22 ||
      error.code === 1014

    if (isQuotaError) {
      return { ok: false, error: 'quota', message: error.message || 'Storage quota exceeded' }
    }

    if (error.name === 'SecurityError') {
      return { ok: false, error: 'unavailable', message: error.message || 'Storage is unavailable' }
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  return { ok: false, error: 'unknown', message }
}
