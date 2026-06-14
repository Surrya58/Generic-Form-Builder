import { assertNever } from './assertNever'
import type { ConditionValue, Operator } from './condition'
import type { Field, FieldType } from './field'

/**
 * The operators offered for conditions that target each field type. The
 * field registry (a later stage) reuses this table to populate the
 * "operator" dropdown once a target field is chosen.
 */
export const OPERATORS_BY_FIELD_TYPE: Record<FieldType, Operator[]> = {
  singleLineText: ['equals', 'notEquals', 'contains'],
  multiLineText: ['equals', 'notEquals', 'contains'],
  number: ['equals', 'gt', 'lt', 'withinRange'],
  date: ['equals', 'isBefore', 'isAfter'],
  singleSelect: ['equals', 'notEquals'],
  multiSelect: ['containsAny', 'containsAll', 'containsNone'],
  fileUpload: [],
  sectionHeader: [],
  calculation: [],
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isRange(value: ConditionValue): value is { min: number; max: number } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as { min?: unknown; max?: unknown }
  return isFiniteNumber(candidate.min) && isFiniteNumber(candidate.max)
}

function evaluateTextOperator(
  operator: Operator,
  targetValue: unknown,
  compareValue: ConditionValue,
): boolean {
  if (typeof targetValue !== 'string') return false
  if (typeof compareValue !== 'string') return false

  switch (operator) {
    case 'equals':
      return targetValue.trim().toLowerCase() === compareValue.trim().toLowerCase()
    case 'notEquals':
      return targetValue.trim().toLowerCase() !== compareValue.trim().toLowerCase()
    case 'contains':
      return targetValue.toLowerCase().includes(compareValue.toLowerCase())
    default:
      return false
  }
}

function evaluateNumberOperator(
  operator: Operator,
  targetValue: unknown,
  compareValue: ConditionValue,
): boolean {
  if (!isFiniteNumber(targetValue)) return false

  switch (operator) {
    case 'equals':
      return isFiniteNumber(compareValue) && targetValue === compareValue
    case 'gt':
      return isFiniteNumber(compareValue) && targetValue > compareValue
    case 'lt':
      return isFiniteNumber(compareValue) && targetValue < compareValue
    case 'withinRange':
      return (
        isRange(compareValue) && targetValue >= compareValue.min && targetValue <= compareValue.max
      )
    default:
      return false
  }
}

function evaluateDateOperator(
  operator: Operator,
  targetValue: unknown,
  compareValue: ConditionValue,
): boolean {
  if (typeof targetValue !== 'string' || targetValue === '') return false
  if (typeof compareValue !== 'string' || compareValue === '') return false

  switch (operator) {
    case 'equals':
      return targetValue === compareValue
    case 'isBefore':
      return targetValue < compareValue
    case 'isAfter':
      return targetValue > compareValue
    default:
      return false
  }
}

function evaluateSingleSelectOperator(
  operator: Operator,
  targetValue: unknown,
  compareValue: ConditionValue,
): boolean {
  if (typeof targetValue !== 'string' || targetValue === '') return false
  if (typeof compareValue !== 'string' || compareValue === '') return false

  switch (operator) {
    case 'equals':
      return targetValue === compareValue
    case 'notEquals':
      return targetValue !== compareValue
    default:
      return false
  }
}

function evaluateMultiSelectOperator(
  operator: Operator,
  targetValue: unknown,
  compareValue: ConditionValue,
): boolean {
  if (!isStringArray(targetValue)) return false
  if (!isStringArray(compareValue) || compareValue.length === 0) return false

  switch (operator) {
    case 'containsAny':
      return compareValue.some((id) => targetValue.includes(id))
    case 'containsAll':
      return compareValue.every((id) => targetValue.includes(id))
    case 'containsNone':
      return !compareValue.some((id) => targetValue.includes(id))
    default:
      return false
  }
}

/**
 * Evaluates a single condition's operator against the target field's
 * current effective value. An absent target value (the field is hidden,
 * or has never been filled in), an operator that doesn't apply to the
 * target field's type, or an empty/incomplete compare value all resolve
 * to `false` (the condition is inert) rather than throwing.
 */
export function evaluateOperator(
  targetType: FieldType,
  operator: Operator,
  targetValue: unknown,
  compareValue: ConditionValue,
): boolean {
  if (targetValue === undefined || targetValue === null) return false

  switch (targetType) {
    case 'singleLineText':
    case 'multiLineText':
      return evaluateTextOperator(operator, targetValue, compareValue)
    case 'number':
      return evaluateNumberOperator(operator, targetValue, compareValue)
    case 'date':
      return evaluateDateOperator(operator, targetValue, compareValue)
    case 'singleSelect':
      return evaluateSingleSelectOperator(operator, targetValue, compareValue)
    case 'multiSelect':
      return evaluateMultiSelectOperator(operator, targetValue, compareValue)
    case 'fileUpload':
    case 'sectionHeader':
    case 'calculation':
      return false
    default:
      return assertNever(targetType)
  }
}

export interface FieldState {
  visible: boolean
  required: boolean
}

export interface ConditionResolution {
  states: Map<string, FieldState>
  /**
   * True if the conditions on this form don't stabilize within
   * `fields.length` iterations. When this happens every field falls
   * back to its default { visible, required } state.
   */
  cycleDetected: boolean
}

function defaultStates(fields: Field[]): Map<string, FieldState> {
  const states = new Map<string, FieldState>()
  for (const field of fields) {
    states.set(field.id, {
      visible: field.defaultVisibility === 'visible',
      required: field.defaultRequired,
    })
  }
  return states
}

function statesEqual(a: Map<string, FieldState>, b: Map<string, FieldState>): boolean {
  for (const [id, stateA] of a) {
    const stateB = b.get(id)
    if (!stateB || stateA.visible !== stateB.visible || stateA.required !== stateB.required) {
      return false
    }
  }
  return true
}

/**
 * Builds the "effective values" map: a visible field's raw value, or
 * nothing at all for a hidden field. Validation, calculation,
 * submission and PDF export all read values through this map so a
 * hidden field's value never leaks into any of them.
 */
export function getEffectiveValues(
  fields: Field[],
  values: Record<string, unknown>,
  states: Map<string, FieldState>,
): Map<string, unknown> {
  const effective = new Map<string, unknown>()
  for (const field of fields) {
    if (states.get(field.id)?.visible) {
      effective.set(field.id, values[field.id])
    }
  }
  return effective
}

/**
 * Computes each field's effective { visible, required } state.
 *
 * Within one field, conditions are evaluated in array order against a
 * single base state (field.defaultVisibility / field.defaultRequired):
 * show/hide and require/unrequire are independent axes, each matching
 * condition applies its effect to its axis, and the LAST matching
 * condition on an axis wins — there is no AND/OR combinator.
 *
 * Because a hidden field's value is treated as absent (see
 * getEffectiveValues), one field's visibility can change which
 * conditions match elsewhere. This function re-resolves to a fixpoint:
 * recompute every field's state from the previous iteration's
 * effective values, and stop once nothing changes. If it doesn't
 * stabilize within fields.length iterations, every field falls back to
 * its default state and `cycleDetected` is set.
 */
export function resolve(fields: Field[], values: Record<string, unknown>): ConditionResolution {
  const fieldsById = new Map(fields.map((field) => [field.id, field]))
  let states = defaultStates(fields)

  const maxIterations = Math.max(fields.length, 1)
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const effectiveValues = getEffectiveValues(fields, values, states)
    const next = new Map<string, FieldState>()

    for (const field of fields) {
      let visible = field.defaultVisibility === 'visible'
      let required = field.defaultRequired

      for (const condition of field.conditions) {
        if (condition.targetFieldId === field.id) continue

        const targetField = fieldsById.get(condition.targetFieldId)
        if (!targetField) continue

        const targetValue = effectiveValues.get(condition.targetFieldId)
        const matches = evaluateOperator(
          targetField.type,
          condition.operator,
          targetValue,
          condition.value,
        )
        if (!matches) continue

        switch (condition.effect) {
          case 'show':
            visible = true
            break
          case 'hide':
            visible = false
            break
          case 'require':
            required = true
            break
          case 'unrequire':
            required = false
            break
          default:
            assertNever(condition.effect)
        }
      }

      next.set(field.id, { visible, required })
    }

    if (statesEqual(states, next)) {
      return { states: next, cycleDetected: false }
    }
    states = next
  }

  return { states: defaultStates(fields), cycleDetected: true }
}
