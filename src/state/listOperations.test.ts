import { describe, expect, it } from 'vitest'
import { insertField, moveItem } from './listOperations'

interface Item {
  id: string
  label: string
}

function items(...ids: string[]): Item[] {
  return ids.map((id) => ({ id, label: `label-${id}` }))
}

function ids(list: Item[]): string[] {
  return list.map((item) => item.id)
}

describe('moveItem', () => {
  it('moves an item earlier in the list', () => {
    const result = moveItem(items('a', 'b', 'c', 'd'), 'c', 0)

    expect(ids(result)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('moves an item later in the list', () => {
    const result = moveItem(items('a', 'b', 'c', 'd'), 'a', 2)

    expect(ids(result)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an item by one position', () => {
    const result = moveItem(items('a', 'b', 'c'), 'b', 0)

    expect(ids(result)).toEqual(['b', 'a', 'c'])
  })

  it('clamps a negative toIndex to the start of the list', () => {
    const result = moveItem(items('a', 'b', 'c'), 'c', -5)

    expect(ids(result)).toEqual(['c', 'a', 'b'])
  })

  it('clamps a too-large toIndex to the end of the list', () => {
    const result = moveItem(items('a', 'b', 'c'), 'a', 99)

    expect(ids(result)).toEqual(['b', 'c', 'a'])
  })

  it('returns the same array reference when fromId is not found', () => {
    const list = items('a', 'b', 'c')
    const result = moveItem(list, 'missing', 0)

    expect(result).toBe(list)
  })

  it('returns the same array reference when toIndex is already the item position', () => {
    const list = items('a', 'b', 'c')
    const result = moveItem(list, 'b', 1)

    expect(result).toBe(list)
  })

  it('treats an out-of-range toIndex that clamps back to the current position as a no-op', () => {
    const list = items('a', 'b', 'c')
    const result = moveItem(list, 'c', 99)

    expect(result).toBe(list)
  })

  it('is a no-op on a single-item list regardless of toIndex', () => {
    const list = items('only')
    const result = moveItem(list, 'only', 5)

    expect(result).toBe(list)
  })

  it('preserves the identity of items it does not move', () => {
    const list = items('a', 'b', 'c', 'd')
    const result = moveItem(list, 'a', 2)

    expect(result.find((item) => item.id === 'd')).toBe(list.find((item) => item.id === 'd'))
  })
})

describe('insertField', () => {
  it('inserts an item in the middle of the list', () => {
    const result = insertField(items('a', 'b', 'c'), { id: 'x', label: 'label-x' }, 1)

    expect(ids(result)).toEqual(['a', 'x', 'b', 'c'])
  })

  it('inserts at the start of the list', () => {
    const result = insertField(items('a', 'b'), { id: 'x', label: 'label-x' }, 0)

    expect(ids(result)).toEqual(['x', 'a', 'b'])
  })

  it('inserts at the end of the list', () => {
    const result = insertField(items('a', 'b'), { id: 'x', label: 'label-x' }, 2)

    expect(ids(result)).toEqual(['a', 'b', 'x'])
  })

  it('clamps a negative index to the start of the list', () => {
    const result = insertField(items('a', 'b'), { id: 'x', label: 'label-x' }, -5)

    expect(ids(result)).toEqual(['x', 'a', 'b'])
  })

  it('clamps a too-large index to the end of the list', () => {
    const result = insertField(items('a', 'b'), { id: 'x', label: 'label-x' }, 99)

    expect(ids(result)).toEqual(['a', 'b', 'x'])
  })

  it('inserts into an empty list', () => {
    const result = insertField<Item>([], { id: 'x', label: 'label-x' }, 0)

    expect(ids(result)).toEqual(['x'])
  })

  it('preserves the identity of items already in the list', () => {
    const list = items('a', 'b')
    const result = insertField(list, { id: 'x', label: 'label-x' }, 1)

    expect(result.find((item) => item.id === 'a')).toBe(list.find((item) => item.id === 'a'))
    expect(result.find((item) => item.id === 'b')).toBe(list.find((item) => item.id === 'b'))
  })
})
