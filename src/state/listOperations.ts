/**
 * Moves the item with id `fromId` to `toIndex` in a new array, leaving
 * the relative order of every other item unchanged. `toIndex` is
 * clamped to the list's bounds. If `fromId` isn't present, or it is
 * already at (a clamped) `toIndex`, the original array reference is
 * returned unchanged.
 */
export function moveItem<T extends { id: string }>(
  list: T[],
  fromId: string,
  toIndex: number,
): T[] {
  const item = list.find((entry) => entry.id === fromId)
  if (item === undefined) return list

  const fromIndex = list.indexOf(item)
  const clampedToIndex = Math.min(Math.max(toIndex, 0), list.length - 1)
  if (clampedToIndex === fromIndex) return list

  const withoutItem = list.filter((entry) => entry.id !== fromId)
  return [...withoutItem.slice(0, clampedToIndex), item, ...withoutItem.slice(clampedToIndex)]
}

/**
 * Inserts `item` at `atIndex` in a new array, leaving every other item's
 * relative order unchanged. `atIndex` is clamped to `[0, list.length]`.
 */
export function insertField<T>(list: T[], item: T, atIndex: number): T[] {
  const clampedIndex = Math.min(Math.max(atIndex, 0), list.length)
  return [...list.slice(0, clampedIndex), item, ...list.slice(clampedIndex)]
}
