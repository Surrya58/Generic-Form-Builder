import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosaveController, type AutosaveStatus } from './autosave'
import type { StorageResult } from './types'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const ok: StorageResult<unknown> = { ok: true, value: undefined }
const quotaError: StorageResult<unknown> = { ok: false, error: 'quota', message: 'full' }

describe('autosave controller', () => {
  it('starts idle and does not save until notified', () => {
    const save = vi.fn((): StorageResult<unknown> => ok)
    const controller = createAutosaveController({ debounceMs: 1000, save })

    expect(controller.getStatus()).toBe('idle')
    vi.advanceTimersByTime(5000)
    expect(save).not.toHaveBeenCalled()
  })

  it('debounces and coalesces rapid notify() calls into a single save of the latest payload', () => {
    const save = vi.fn((): StorageResult<unknown> => ok)
    const controller = createAutosaveController({ debounceMs: 1000, save })

    controller.notify('a')
    vi.advanceTimersByTime(400)
    controller.notify('b')
    vi.advanceTimersByTime(400)
    controller.notify('c')

    // Still within the debounce window of the last notify().
    vi.advanceTimersByTime(999)
    expect(save).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('c')
  })

  it('transitions editing -> saving -> saved on a successful save', () => {
    const save = vi.fn((): StorageResult<unknown> => ok)
    const statuses: AutosaveStatus[] = []
    const controller = createAutosaveController({
      debounceMs: 1000,
      save,
      onStatusChange: (status) => statuses.push(status),
    })

    controller.notify('payload')
    expect(controller.getStatus()).toBe('editing')

    vi.advanceTimersByTime(1000)
    expect(controller.getStatus()).toBe('saved')
    expect(statuses).toEqual(['editing', 'saving', 'saved'])
  })

  it('freezes on a failed save: stops auto-retrying but keeps the latest payload', () => {
    const save = vi.fn((): StorageResult<unknown> => quotaError)
    const controller = createAutosaveController({ debounceMs: 1000, save })

    controller.notify('first')
    vi.advanceTimersByTime(1000)

    expect(controller.getStatus()).toBe('failed')
    expect(controller.getLastError()).toEqual(quotaError)
    expect(save).toHaveBeenCalledTimes(1)

    // New edits update the in-memory payload but must not trigger a save.
    controller.notify('second')
    vi.advanceTimersByTime(10_000)

    expect(controller.getStatus()).toBe('failed')
    expect(controller.getPayload()).toBe('second')
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('retry() re-attempts the save and re-arms autosave on success', () => {
    const save = vi.fn((): StorageResult<unknown> => quotaError)
    const controller = createAutosaveController({ debounceMs: 1000, save })

    controller.notify('first')
    vi.advanceTimersByTime(1000)
    expect(controller.getStatus()).toBe('failed')

    save.mockImplementation((): StorageResult<unknown> => ok)
    controller.retry()

    expect(controller.getStatus()).toBe('saved')
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('first')

    // Autosave is re-armed: a new edit schedules another debounced save.
    controller.notify('second')
    expect(controller.getStatus()).toBe('editing')
    vi.advanceTimersByTime(1000)
    expect(save).toHaveBeenCalledTimes(3)
    expect(save).toHaveBeenLastCalledWith('second')
  })

  it('retry() is a no-op unless the controller is in the failed state', () => {
    const save = vi.fn((): StorageResult<unknown> => ok)
    const controller = createAutosaveController({ debounceMs: 1000, save })

    controller.retry()
    expect(save).not.toHaveBeenCalled()

    controller.notify('payload')
    vi.advanceTimersByTime(1000)
    expect(controller.getStatus()).toBe('saved')

    controller.retry()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('dispose() cancels a pending debounced save', () => {
    const save = vi.fn((): StorageResult<unknown> => ok)
    const controller = createAutosaveController({ debounceMs: 1000, save })

    controller.notify('payload')
    controller.dispose()
    vi.advanceTimersByTime(5000)

    expect(save).not.toHaveBeenCalled()
  })

  it('flush() immediately performs a pending debounced save', () => {
    const save = vi.fn((): StorageResult<unknown> => ok)
    const controller = createAutosaveController({ debounceMs: 1000, save })

    controller.notify('payload')
    controller.flush()

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('payload')
    expect(controller.getStatus()).toBe('saved')

    // The debounced timer was cancelled, so it doesn't fire a second save.
    vi.advanceTimersByTime(5000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flush() is a no-op when nothing is pending', () => {
    const save = vi.fn((): StorageResult<unknown> => ok)
    const controller = createAutosaveController({ debounceMs: 1000, save })

    controller.flush()
    expect(save).not.toHaveBeenCalled()
    expect(controller.getStatus()).toBe('idle')

    controller.notify('payload')
    vi.advanceTimersByTime(1000)
    expect(controller.getStatus()).toBe('saved')

    controller.flush()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flush() is a no-op while frozen after a failure (use retry() instead)', () => {
    const save = vi.fn((): StorageResult<unknown> => quotaError)
    const controller = createAutosaveController({ debounceMs: 1000, save })

    controller.notify('payload')
    vi.advanceTimersByTime(1000)
    expect(controller.getStatus()).toBe('failed')

    controller.flush()
    expect(save).toHaveBeenCalledTimes(1)
    expect(controller.getStatus()).toBe('failed')
  })
})
