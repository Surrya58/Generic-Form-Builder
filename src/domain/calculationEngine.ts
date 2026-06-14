import { assertNever } from './assertNever'
import type { Field } from './field'

type CalculationField = Field & { type: 'calculation' }

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Computes a calculation field's value from its Number-field sources.
 *
 * A source contributes to the aggregation only if it still exists, is a
 * Number field (a calculation may never source another calculation),
 * is currently visible (effectiveValues omits hidden fields), and has
 * a non-null numeric value. If no source qualifies, the result is
 * `null` (a blank result) — never 0 and never NaN. Rounding to
 * `config.decimals` is applied to the aggregated result only.
 */
export function compute(
  field: CalculationField,
  fields: Field[],
  effectiveValues: Map<string, unknown>,
): number | null {
  const fieldsById = new Map(fields.map((f) => [f.id, f]))
  const values: number[] = []

  for (const sourceId of field.config.sourceFieldIds) {
    const source = fieldsById.get(sourceId)
    if (!source || source.type !== 'number') continue

    const value = effectiveValues.get(sourceId)
    if (typeof value !== 'number' || !Number.isFinite(value)) continue

    values.push(value)
  }

  if (values.length === 0) return null

  let result: number
  switch (field.config.aggregation) {
    case 'sum':
      result = values.reduce((total, value) => total + value, 0)
      break
    case 'avg':
      result = values.reduce((total, value) => total + value, 0) / values.length
      break
    case 'min':
      result = Math.min(...values)
      break
    case 'max':
      result = Math.max(...values)
      break
    default:
      return assertNever(field.config.aggregation)
  }

  return roundTo(result, field.config.decimals)
}

/**
 * Computes every calculation field's value at once.
 */
export function computeAll(
  fields: Field[],
  effectiveValues: Map<string, unknown>,
): Map<string, number | null> {
  const results = new Map<string, number | null>()
  for (const field of fields) {
    if (field.type !== 'calculation') continue
    results.set(field.id, compute(field, fields, effectiveValues))
  }
  return results
}

/**
 * Reverse map from a source field id to the calculation field ids that
 * read it, so a value change can recompute only the affected
 * calculations instead of every calculation on the form.
 */
export function buildCalculationDependencyMap(fields: Field[]): Map<string, Set<string>> {
  const dependencyMap = new Map<string, Set<string>>()
  for (const field of fields) {
    if (field.type !== 'calculation') continue
    for (const sourceId of field.config.sourceFieldIds) {
      const dependents = dependencyMap.get(sourceId) ?? new Set<string>()
      dependents.add(field.id)
      dependencyMap.set(sourceId, dependents)
    }
  }
  return dependencyMap
}

/**
 * Given the fields whose values just changed, returns the set of
 * calculation field ids that depend on at least one of them.
 */
export function getDependentCalculationIds(
  dependencyMap: Map<string, Set<string>>,
  changedFieldIds: Iterable<string>,
): Set<string> {
  const dependents = new Set<string>()
  for (const fieldId of changedFieldIds) {
    for (const dependent of dependencyMap.get(fieldId) ?? []) {
      dependents.add(dependent)
    }
  }
  return dependents
}
