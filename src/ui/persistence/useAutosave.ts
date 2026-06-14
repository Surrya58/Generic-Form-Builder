import { useEffect, useRef, useState } from 'react'
import {
  createAutosaveController,
  type AutosaveController,
  type AutosaveStatus,
} from '../../persistence/autosave'
import type { StorageResult } from '../../persistence/types'

export interface UseAutosaveOptions<T> {
  /** Time to wait after the last change before saving. */
  debounceMs: number
  /** Performs the actual write. Must not throw — return a StorageResult instead. */
  save: (payload: T) => StorageResult<unknown>
  /** When false, edits are tracked but never trigger a save. Defaults to true. */
  enabled?: boolean
}

export interface UseAutosaveResult {
  status: AutosaveStatus
  /** When the most recent successful save completed, or null if none yet. */
  lastSavedAt: Date | null
  lastError: StorageResult<unknown> | undefined
  /** Re-attempts the save after a failure. No-op unless `status` is 'failed'. */
  retry: () => void
  /** Performs a pending debounced save immediately, e.g. before navigating away. */
  flush: () => void
}

/**
 * Drives a `createAutosaveController` from a value that changes over time
 * (e.g. the in-progress template). The first render is treated as the
 * initial load and does not schedule a save — only subsequent changes to
 * `payload` do.
 *
 * Also flushes any pending save when the page is about to lose focus or
 * become hidden, so edits aren't lost to the debounce window if the user
 * navigates away.
 */
export function useAutosave<T>(payload: T, options: UseAutosaveOptions<T>): UseAutosaveResult {
  const { debounceMs, enabled = true } = options

  const saveRef = useRef(options.save)
  useEffect(() => {
    saveRef.current = options.save
  })

  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [lastError, setLastError] = useState<StorageResult<unknown> | undefined>(undefined)

  const controllerRef = useRef<AutosaveController<T> | null>(null)

  useEffect(() => {
    let latestError: StorageResult<unknown> | undefined
    const controller = createAutosaveController<T>({
      debounceMs,
      save: (next) => {
        const result = saveRef.current(next)
        latestError = result.ok ? undefined : result
        return result
      },
      onStatusChange: (next) => {
        setStatus(next)
        if (next === 'saved') {
          setLastSavedAt(new Date())
          setLastError(undefined)
        } else if (next === 'failed') {
          setLastError(latestError)
        }
      },
    })
    controllerRef.current = controller

    return () => {
      controller.dispose()
      controllerRef.current = null
    }
  }, [debounceMs])

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (enabled) controllerRef.current?.notify(payload)
  }, [payload, enabled])

  useEffect(() => {
    function flush() {
      controllerRef.current?.flush()
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') flush()
    }

    window.addEventListener('blur', flush)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('blur', flush)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return {
    status,
    lastSavedAt,
    lastError,
    retry: () => controllerRef.current?.retry(),
    flush: () => controllerRef.current?.flush(),
  }
}
