/** Parses an optional non-negative integer config field; blank clears it to undefined. */
export function parseOptionalInt(raw: string): number | undefined {
  if (raw.trim() === '') return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined
}

/** Parses an optional decimal config field; blank clears it to undefined. */
export function parseOptionalFloat(raw: string): number | undefined {
  if (raw.trim() === '') return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Trims a free-text config field to undefined when blank. */
export function parseOptionalText(raw: string): string | undefined {
  return raw === '' ? undefined : raw
}
