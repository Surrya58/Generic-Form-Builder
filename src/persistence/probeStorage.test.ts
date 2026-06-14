import { describe, expect, it } from 'vitest'
import { probeStorage } from './probeStorage'
import { createMockStorageAdapter, createThrowingStorageAdapter } from './testFixtures'

describe('probeStorage', () => {
  it('returns "writable" when the adapter accepts a write/remove round-trip', () => {
    expect(probeStorage(createMockStorageAdapter())).toBe('writable')
  })

  it('returns "unavailable" when the adapter throws', () => {
    expect(probeStorage(createThrowingStorageAdapter(new Error('blocked')))).toBe('unavailable')
  })

  it('does not leave the sentinel key behind', () => {
    const adapter = createMockStorageAdapter()
    probeStorage(adapter)
    expect(adapter.getItem('fb:__probe__')).toBeNull()
  })
})
