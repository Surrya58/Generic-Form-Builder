export type Operator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'gt'
  | 'lt'
  | 'withinRange'
  | 'isBefore'
  | 'isAfter'
  | 'containsAny'
  | 'containsAll'
  | 'containsNone'

export type ConditionValue = string | number | string[] | { min: number; max: number }

/**
 * A rule attached to a field that reacts to another field's value.
 * `operator` is constrained by the target field's type (enforced by the
 * conditional-logic engine, added in a later stage).
 */
export interface Condition {
  id: string
  /** Must reference a different field's id. */
  targetFieldId: string
  operator: Operator
  value: ConditionValue
  effect: 'show' | 'hide' | 'require' | 'unrequire'
}
