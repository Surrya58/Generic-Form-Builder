import {
  computeAll,
  getEffectiveValues,
  resolve,
  validateField,
  type Field,
  type ValidationError,
} from '../domain'

export interface FillValidationResult {
  /** Field-level errors, keyed by field id, for the currently visible fields. */
  errors: Map<string, ValidationError>
  /**
   * The values to persist on submit: visible fields only (hidden fields are
   * excluded entirely), with calculation fields captured as their computed
   * snapshot so the submitted response is self-contained.
   */
  submittedValues: Record<string, unknown>
  /** Visible field ids in render order — used to focus the first invalid field. */
  visibleFieldIds: string[]
}

/**
 * Resolves conditional visibility/required, runs fill-time validation over the
 * visible fields, and assembles the values to persist. Pure: the same fields +
 * values always yield the same result, which keeps submission deterministic and
 * unit-testable independent of React.
 */
export function validateFill(
  fields: Field[],
  values: Record<string, unknown>,
): FillValidationResult {
  const { states } = resolve(fields, values)
  const effective = getEffectiveValues(fields, values, states)
  const calcValues = computeAll(fields, effective)

  const errors = new Map<string, ValidationError>()
  const submittedValues: Record<string, unknown> = {}
  const visibleFieldIds: string[] = []

  for (const field of fields) {
    const state = states.get(field.id)
    if (!state?.visible) continue
    visibleFieldIds.push(field.id)

    const error = validateField(field, effective.get(field.id), {
      effectiveRequired: state.required,
      effectiveVisible: true,
    })
    if (error) errors.set(field.id, error)

    if (field.type === 'sectionHeader') continue
    submittedValues[field.id] =
      field.type === 'calculation'
        ? (calcValues.get(field.id) ?? null)
        : (effective.get(field.id) ?? null)
  }

  return { errors, submittedValues, visibleFieldIds }
}
