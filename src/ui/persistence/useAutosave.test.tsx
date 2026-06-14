import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAutosave } from './useAutosave'
import type { StorageResult } from '../../persistence/types'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const ok: StorageResult<unknown> = { ok: true, value: undefined }
const quotaError: StorageResult<unknown> = { ok: false, error: 'quota', message: 'full' }

describe('useAutosave', () => {
  it('does not save on the initial render, even after the debounce window', () => {
    const save = vi.fn((): StorageResult<unknown> => ok)
    const { result } = renderHook(() => useAutosave('initial', { debounceMs: 1000, save }))

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(save).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('debounces and saves when the payload changes, reporting saved status and a timestamp', () => {
    const save = vi.fn((): StorageResult<unknown> => ok)
    const { result, rerender } = renderHook(
      ({ payload }) => useAutosave(payload, { debounceMs: 1000, save }),
      {
        initialProps: { payload: 'initial' },
      },
    )

    rerender({ payload: 'changed' })
    expect(result.current.status).toBe('editing')

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('changed')
    expect(result.current.status).toBe('saved')
    expect(result.current.lastSavedAt).toBeInstanceOf(Date)
  })

  it('reports a failed status and the error when the save fails', () => {
    const save = vi.fn((): StorageResult<unknown> => quotaError)
    const { result, rerender } = renderHook(
      ({ payload }) => useAutosave(payload, { debounceMs: 1000, save }),
      {
        initialProps: { payload: 'initial' },
      },
    )

    rerender({ payload: 'changed' })
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.status).toBe('failed')
    expect(result.current.lastError).toEqual(quotaError)
  })

  it('retry() re-attempts the save and clears the error on success', () => {
    const save = vi.fn((): StorageResult<unknown> => quotaError)
    const { result, rerender } = renderHook(
      ({ payload }) => useAutosave(payload, { debounceMs: 1000, save }),
      {
        initialProps: { payload: 'initial' },
      },
    )

    rerender({ payload: 'changed' })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.status).toBe('failed')

    save.mockImplementation((): StorageResult<unknown> => ok)
    act(() => {
      result.current.retry()
    })

    expect(result.current.status).toBe('saved')
    expect(result.current.lastError).toBeUndefined()
  })

  it('does not schedule a save when disabled', () => {
    const save = vi.fn((): StorageResult<unknown> => ok)
    const { rerender } = renderHook(
      ({ payload, enabled }) => useAutosave(payload, { debounceMs: 1000, save, enabled }),
      { initialProps: { payload: 'initial', enabled: false } },
    )

    rerender({ payload: 'changed', enabled: false })
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(save).not.toHaveBeenCalled()
  })

  it('flush() saves immediately, bypassing the debounce window', () => {
    const save = vi.fn((): StorageResult<unknown> => ok)
    const { result, rerender } = renderHook(
      ({ payload }) => useAutosave(payload, { debounceMs: 1000, save }),
      {
        initialProps: { payload: 'initial' },
      },
    )

    rerender({ payload: 'changed' })
    act(() => {
      result.current.flush()
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('saved')
  })

  it('flushes a pending save when the window loses focus', () => {
    const save = vi.fn((): StorageResult<unknown> => ok)
    const { rerender } = renderHook(
      ({ payload }) => useAutosave(payload, { debounceMs: 1000, save }),
      {
        initialProps: { payload: 'initial' },
      },
    )

    rerender({ payload: 'changed' })
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('changed')
  })

  it('flushes a pending save when the document becomes hidden', () => {
    const save = vi.fn((): StorageResult<unknown> => ok)
    const { rerender } = renderHook(
      ({ payload }) => useAutosave(payload, { debounceMs: 1000, save }),
      {
        initialProps: { payload: 'initial' },
      },
    )

    rerender({ payload: 'changed' })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(save).toHaveBeenCalledTimes(1)
  })

  it('dispose on unmount cancels a pending debounced save', () => {
    const save = vi.fn((): StorageResult<unknown> => ok)
    const { rerender, unmount } = renderHook(
      ({ payload }) => useAutosave(payload, { debounceMs: 1000, save }),
      {
        initialProps: { payload: 'initial' },
      },
    )

    rerender({ payload: 'changed' })
    unmount()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(save).not.toHaveBeenCalled()
  })
})
