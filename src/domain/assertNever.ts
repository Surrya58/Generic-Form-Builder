/**
 * Exhaustiveness helper for switches over closed unions (e.g. FieldType).
 * If a new case is added without updating the switch, this call site
 * becomes a type error rather than a silent runtime fallthrough.
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`)
}
