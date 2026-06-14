import { describe, expect, it } from 'vitest'
import { assertNever } from './assertNever'

describe('assertNever', () => {
  it('throws when called with an unexpected value', () => {
    expect(() => assertNever('unexpected' as never)).toThrow(/Unexpected value/)
  })
})
