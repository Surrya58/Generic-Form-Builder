import type { StorageResult } from './types'

export type AutosaveStatus = 'idle' | 'editing' | 'saving' | 'saved' | 'failed'

export interface AutosaveControllerOptions<T> {
  /** Time to wait after the last `notify()` before saving. */
  debounceMs: number
  /** Performs the actual write. Must not throw — return a StorageResult instead. */
  save: (payload: T) => StorageResult<unknown>
  onStatusChange?: (status: AutosaveStatus) => void
}

export interface AutosaveController<T> {
  getStatus(): AutosaveStatus
  getPayload(): T | undefined
  getLastError(): StorageResult<unknown> | undefined
  /** Record a new payload. Debounces/coalesces rapid calls into a single save. */
  notify(payload: T): void
  /** Re-attempts the save with the latest payload and re-arms auto-save if it succeeds. */
  retry(): void
  /**
   * If a debounced save is pending, performs it immediately. No-op if
   * there is nothing pending (idle, already saving/saved, or frozen
   * after a failure — use `retry()` for that).
   */
  flush(): void
  /** Cancels any pending debounced save. */
  dispose(): void
}

/**
 * Pure (no React, no DOM) autosave state machine.
 *
 * Lifecycle: idle -> editing -(debounce)-> saving -> saved | failed.
 * A failed save freezes the controller (no further auto-saves) while
 * keeping the latest payload; `retry()` re-arms it.
 */
export function createAutosaveController<T>(
  options: AutosaveControllerOptions<T>,
): AutosaveController<T> {
  const { debounceMs, save, onStatusChange } = options

  let status: AutosaveStatus = 'idle'
  let payload: T | undefined
  let lastError: StorageResult<unknown> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  function setStatus(next: AutosaveStatus): void {
    status = next
    onStatusChange?.(status)
  }

  function clearTimer(): void {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function performSave(): void {
    if (payload === undefined) return

    setStatus('saving')
    const result = save(payload)
    if (result.ok) {
      lastError = undefined
      setStatus('saved')
    } else {
      lastError = result
      setStatus('failed')
    }
  }

  function notify(next: T): void {
    payload = next

    if (status === 'failed') {
      // Frozen: remember the latest payload but don't auto-retry.
      return
    }

    setStatus('editing')
    clearTimer()
    timer = setTimeout(() => {
      timer = undefined
      performSave()
    }, debounceMs)
  }

  function retry(): void {
    if (status !== 'failed') return
    clearTimer()
    performSave()
  }

  function flush(): void {
    if (timer === undefined) return
    clearTimer()
    performSave()
  }

  function dispose(): void {
    clearTimer()
  }

  return {
    getStatus: () => status,
    getPayload: () => payload,
    getLastError: () => lastError,
    notify,
    retry,
    flush,
    dispose,
  }
}
