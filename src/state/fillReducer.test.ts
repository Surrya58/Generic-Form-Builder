import { describe, expect, it } from 'vitest'
import { createInitialFillState, fillReducer } from './fillReducer'

describe('fillReducer', () => {
  const initial = createInitialFillState({ templateId: 't', instanceId: 'i', values: { a: 1 } })

  it('sets a single field value without disturbing others', () => {
    const next = fillReducer(initial, { type: 'setValue', fieldId: 'b', value: 2 })
    expect(next.values).toEqual({ a: 1, b: 2 })
    expect(initial.values).toEqual({ a: 1 })
  })

  it('overwrites an existing value', () => {
    const next = fillReducer(initial, { type: 'setValue', fieldId: 'a', value: 9 })
    expect(next.values).toEqual({ a: 9 })
  })

  it('resets all values', () => {
    const next = fillReducer(initial, { type: 'reset', values: { x: 'y' } })
    expect(next.values).toEqual({ x: 'y' })
  })
})
