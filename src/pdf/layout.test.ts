import { describe, expect, it } from 'vitest'
import { wrapText } from './layout'

describe('wrapText', () => {
  it('keeps text that fits on a single line', () => {
    expect(wrapText('hello world', 11, false, 500)).toEqual(['hello world'])
  })

  it('wraps text wider than the max width onto multiple lines', () => {
    const lines = wrapText(Array.from({ length: 80 }, () => 'word').join(' '), 11, false, 120)
    expect(lines.length).toBeGreaterThan(1)
  })

  it('honors explicit newlines', () => {
    expect(wrapText('first\nsecond', 11, false, 500)).toEqual(['first', 'second'])
  })

  it('hard-breaks a single word too long to fit', () => {
    const lines = wrapText('x'.repeat(200), 11, false, 50)
    expect(lines.length).toBeGreaterThan(1)
  })
})
