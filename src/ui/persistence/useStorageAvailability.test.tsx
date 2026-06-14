import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStorageAvailability } from './useStorageAvailability'
import {
  createMockStorageAdapter,
  createThrowingStorageAdapter,
} from '../../persistence/testFixtures'

describe('useStorageAvailability', () => {
  it('reports writable when the adapter accepts a probe write', () => {
    const adapter = createMockStorageAdapter()
    const { result } = renderHook(() => useStorageAvailability(adapter))
    expect(result.current).toBe('writable')
  })

  it('reports unavailable when the adapter throws', () => {
    const adapter = createThrowingStorageAdapter(new Error('blocked'))
    const { result } = renderHook(() => useStorageAvailability(adapter))
    expect(result.current).toBe('unavailable')
  })
})
