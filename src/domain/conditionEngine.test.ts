import { describe, expect, it } from 'vitest'
import type { Condition } from './condition'
import type { FieldType } from './field'
import {
  OPERATORS_BY_FIELD_TYPE,
  evaluateOperator,
  getEffectiveValues,
  resolve,
} from './conditionEngine'
import { makeCondition, numberField, singleLineTextField, singleSelectField } from './testFixtures'

describe('evaluateOperator', () => {
  describe('text targets (singleLineText / multiLineText)', () => {
    it('equals is case-insensitive and trimmed', () => {
      expect(evaluateOperator('singleLineText', 'equals', '  Hello  ', 'hello')).toBe(true)
      expect(evaluateOperator('singleLineText', 'equals', 'Hello', 'World')).toBe(false)
    })

    it('notEquals is the inverse of equals', () => {
      expect(evaluateOperator('multiLineText', 'notEquals', 'Hello', 'World')).toBe(true)
      expect(evaluateOperator('multiLineText', 'notEquals', '  Hello  ', 'hello')).toBe(false)
    })

    it('contains is a case-insensitive substring match', () => {
      expect(evaluateOperator('singleLineText', 'contains', 'Hello World', 'world')).toBe(true)
      expect(evaluateOperator('singleLineText', 'contains', 'Hello World', 'xyz')).toBe(false)
    })

    it('is inert when the target value is not a string', () => {
      expect(evaluateOperator('singleLineText', 'equals', 42, 'hello')).toBe(false)
    })

    it('is inert when the compare value is not a string', () => {
      expect(evaluateOperator('singleLineText', 'equals', 'hello', 42)).toBe(false)
    })

    it('is inert for an operator not offered to text fields', () => {
      expect(evaluateOperator('singleLineText', 'gt', 'hello', 'world')).toBe(false)
    })
  })

  describe('number targets', () => {
    it('equals matches exact numeric equality', () => {
      expect(evaluateOperator('number', 'equals', 5, 5)).toBe(true)
      expect(evaluateOperator('number', 'equals', 5, 6)).toBe(false)
    })

    it('gt and lt compare numerically', () => {
      expect(evaluateOperator('number', 'gt', 10, 5)).toBe(true)
      expect(evaluateOperator('number', 'gt', 5, 10)).toBe(false)
      expect(evaluateOperator('number', 'lt', 5, 10)).toBe(true)
      expect(evaluateOperator('number', 'lt', 10, 5)).toBe(false)
    })

    it('withinRange is inclusive on both ends', () => {
      expect(evaluateOperator('number', 'withinRange', 5, { min: 1, max: 10 })).toBe(true)
      expect(evaluateOperator('number', 'withinRange', 1, { min: 1, max: 10 })).toBe(true)
      expect(evaluateOperator('number', 'withinRange', 10, { min: 1, max: 10 })).toBe(true)
      expect(evaluateOperator('number', 'withinRange', 15, { min: 1, max: 10 })).toBe(false)
    })

    it('withinRange is inert when the range is incomplete or malformed', () => {
      type Range = { min: number; max: number }
      expect(evaluateOperator('number', 'withinRange', 5, { min: 1 } as unknown as Range)).toBe(
        false,
      )
      expect(evaluateOperator('number', 'withinRange', 5, 5)).toBe(false)
      expect(evaluateOperator('number', 'withinRange', 5, null as unknown as Range)).toBe(false)
      expect(evaluateOperator('number', 'withinRange', 5, ['a'])).toBe(false)
    })

    it('is inert when the target value is absent', () => {
      expect(evaluateOperator('number', 'equals', undefined, 5)).toBe(false)
      expect(evaluateOperator('number', 'equals', null, 5)).toBe(false)
    })

    it('is inert when the target value is present but not a number', () => {
      expect(evaluateOperator('number', 'equals', 'five', 5)).toBe(false)
    })

    it('is inert when the compare value is not a number', () => {
      expect(evaluateOperator('number', 'equals', 5, 'five')).toBe(false)
      expect(evaluateOperator('number', 'gt', 5, 'five')).toBe(false)
      expect(evaluateOperator('number', 'lt', 5, 'five')).toBe(false)
    })

    it('is inert for an operator not offered to number fields', () => {
      expect(evaluateOperator('number', 'contains', 5, 5)).toBe(false)
    })
  })

  describe('date targets', () => {
    it('compares YYYY-MM-DD strings lexicographically', () => {
      expect(evaluateOperator('date', 'equals', '2024-01-01', '2024-01-01')).toBe(true)
      expect(evaluateOperator('date', 'isBefore', '2024-01-01', '2024-02-01')).toBe(true)
      expect(evaluateOperator('date', 'isBefore', '2024-02-01', '2024-01-01')).toBe(false)
      expect(evaluateOperator('date', 'isAfter', '2024-02-01', '2024-01-01')).toBe(true)
      expect(evaluateOperator('date', 'isAfter', '2024-01-01', '2024-02-01')).toBe(false)
    })

    it('is inert when the target or compare value is empty', () => {
      expect(evaluateOperator('date', 'equals', '', '2024-01-01')).toBe(false)
      expect(evaluateOperator('date', 'equals', '2024-01-01', '')).toBe(false)
    })

    it('is inert for an operator not offered to date fields', () => {
      expect(evaluateOperator('date', 'gt', '2024-01-01', '2024-01-01')).toBe(false)
    })
  })

  describe('singleSelect targets', () => {
    it('equals and notEquals compare the selected option id', () => {
      expect(evaluateOperator('singleSelect', 'equals', 'opt-a', 'opt-a')).toBe(true)
      expect(evaluateOperator('singleSelect', 'equals', 'opt-a', 'opt-b')).toBe(false)
      expect(evaluateOperator('singleSelect', 'notEquals', 'opt-a', 'opt-b')).toBe(true)
      expect(evaluateOperator('singleSelect', 'notEquals', 'opt-a', 'opt-a')).toBe(false)
    })

    it('is inert when the compare value is an empty string', () => {
      expect(evaluateOperator('singleSelect', 'equals', 'opt-a', '')).toBe(false)
    })

    it('is inert when no option is selected', () => {
      expect(evaluateOperator('singleSelect', 'equals', null, 'opt-a')).toBe(false)
    })

    it('is inert when the target value is present but not a string', () => {
      expect(evaluateOperator('singleSelect', 'equals', 42, 'opt-a')).toBe(false)
    })

    it('is inert for an operator not offered to singleSelect fields', () => {
      expect(evaluateOperator('singleSelect', 'contains', 'opt-a', 'opt-a')).toBe(false)
    })
  })

  describe('multiSelect targets', () => {
    it('containsAny matches if any compare id is selected', () => {
      expect(evaluateOperator('multiSelect', 'containsAny', ['a', 'b'], ['b', 'c'])).toBe(true)
      expect(evaluateOperator('multiSelect', 'containsAny', ['a'], ['x', 'y'])).toBe(false)
    })

    it('containsAll matches only if every compare id is selected', () => {
      expect(evaluateOperator('multiSelect', 'containsAll', ['a', 'b', 'c'], ['a', 'b'])).toBe(true)
      expect(evaluateOperator('multiSelect', 'containsAll', ['a'], ['a', 'b'])).toBe(false)
    })

    it('containsNone matches only if no compare id is selected', () => {
      expect(evaluateOperator('multiSelect', 'containsNone', ['a'], ['x', 'y'])).toBe(true)
      expect(evaluateOperator('multiSelect', 'containsNone', ['a', 'x'], ['x', 'y'])).toBe(false)
    })

    it('is inert when the compare list is empty', () => {
      expect(evaluateOperator('multiSelect', 'containsAny', ['a'], [])).toBe(false)
    })

    it('is inert when the target value is absent', () => {
      expect(evaluateOperator('multiSelect', 'containsAny', undefined, ['a'])).toBe(false)
    })

    it('is inert when the target value is present but not an array', () => {
      expect(evaluateOperator('multiSelect', 'containsAny', 'not-an-array', ['a'])).toBe(false)
    })

    it('is inert for an operator not offered to multiSelect fields', () => {
      expect(evaluateOperator('multiSelect', 'equals', ['a'], ['a'])).toBe(false)
    })
  })

  describe('fileUpload / sectionHeader / calculation targets', () => {
    it('is always inert, since no operators apply to these types', () => {
      expect(evaluateOperator('fileUpload', 'equals', 'x', 'x')).toBe(false)
      expect(evaluateOperator('sectionHeader', 'equals', 'x', 'x')).toBe(false)
      expect(evaluateOperator('calculation', 'equals', 5, 5)).toBe(false)
    })
  })

  it('throws for an unrecognized target field type (defensive exhaustiveness guard)', () => {
    expect(() => evaluateOperator('bogus' as FieldType, 'equals', 'x', 'x')).toThrow()
  })
})

describe('resolve', () => {
  it('returns each field default state when there are no conditions', () => {
    const fields = [
      singleLineTextField('a', { defaultVisibility: 'visible', defaultRequired: true }),
      singleLineTextField('b', { defaultVisibility: 'hidden', defaultRequired: false }),
    ]

    const { states, cycleDetected } = resolve(fields, {})

    expect(cycleDetected).toBe(false)
    expect(states.get('a')).toEqual({ visible: true, required: true })
    expect(states.get('b')).toEqual({ visible: false, required: false })
  })

  it('show/hide effects toggle visibility based on the target value', () => {
    const fields = [
      singleSelectField('a', {
        config: {
          options: [
            { id: 'yes', label: 'Yes' },
            { id: 'no', label: 'No' },
          ],
        },
      }),
      singleLineTextField('b', {
        defaultVisibility: 'hidden',
        conditions: [
          makeCondition({ targetFieldId: 'a', operator: 'equals', value: 'yes', effect: 'show' }),
        ],
      }),
    ]

    expect(resolve(fields, { a: 'yes' }).states.get('b')).toEqual({
      visible: true,
      required: false,
    })
    expect(resolve(fields, { a: 'no' }).states.get('b')).toEqual({
      visible: false,
      required: false,
    })
  })

  it('require/unrequire is an independent axis from visibility', () => {
    const fields = [
      singleSelectField('a', { config: { options: [{ id: 'yes', label: 'Yes' }] } }),
      singleLineTextField('b', {
        defaultVisibility: 'visible',
        defaultRequired: false,
        conditions: [
          makeCondition({
            targetFieldId: 'a',
            operator: 'equals',
            value: 'yes',
            effect: 'require',
          }),
        ],
      }),
    ]

    expect(resolve(fields, { a: 'yes' }).states.get('b')).toEqual({ visible: true, required: true })
    expect(resolve(fields, {}).states.get('b')).toEqual({ visible: true, required: false })
  })

  it('evaluates multiple conditions in order, last match wins per axis independently', () => {
    const fields = [
      singleLineTextField('a'),
      singleLineTextField('b', {
        defaultVisibility: 'visible',
        defaultRequired: false,
        conditions: [
          makeCondition({ targetFieldId: 'a', operator: 'contains', value: 'a', effect: 'hide' }),
          makeCondition({ targetFieldId: 'a', operator: 'equals', value: 'cat', effect: 'show' }),
          makeCondition({
            targetFieldId: 'a',
            operator: 'contains',
            value: 'c',
            effect: 'require',
          }),
          makeCondition({
            targetFieldId: 'a',
            operator: 'contains',
            value: 'a',
            effect: 'unrequire',
          }),
        ],
      }),
    ]

    // All four conditions match for value "cat":
    //  - visibility axis: 'hide' then 'show' -> last (show) wins -> visible: true
    //  - required axis: 'require' then 'unrequire' -> last (unrequire) wins -> required: false
    expect(resolve(fields, { a: 'cat' }).states.get('b')).toEqual({
      visible: true,
      required: false,
    })
  })

  it('ignores a self-referencing condition', () => {
    const fields = [
      singleLineTextField('a', {
        defaultVisibility: 'visible',
        conditions: [
          makeCondition({ targetFieldId: 'a', operator: 'equals', value: 'x', effect: 'hide' }),
        ],
      }),
    ]

    expect(resolve(fields, { a: 'x' }).states.get('a')).toEqual({ visible: true, required: false })
  })

  it('treats a condition targeting a deleted field as inert', () => {
    const fields = [
      singleLineTextField('a', {
        defaultVisibility: 'visible',
        conditions: [
          makeCondition({
            targetFieldId: 'missing',
            operator: 'equals',
            value: 'x',
            effect: 'hide',
          }),
        ],
      }),
    ]

    expect(resolve(fields, {}).states.get('a')).toEqual({ visible: true, required: false })
  })

  it('a condition with an empty/incomplete value is inert', () => {
    const fields = [
      numberField('a'),
      singleLineTextField('b', {
        defaultVisibility: 'visible',
        conditions: [
          makeCondition({
            targetFieldId: 'a',
            operator: 'withinRange',
            value: { min: 1 } as unknown as { min: number; max: number },
            effect: 'hide',
          }),
        ],
      }),
    ]

    expect(resolve(fields, { a: 5 }).states.get('b')).toEqual({ visible: true, required: false })
  })

  it('chains A -> B -> C: hiding B drops B from the effective values C reacts to', () => {
    const fields = [
      singleSelectField('a', {
        config: {
          options: [
            { id: 'opt-show', label: 'Show B' },
            { id: 'opt-hide', label: 'Hide B' },
          ],
        },
      }),
      singleLineTextField('b', {
        defaultVisibility: 'visible',
        conditions: [
          makeCondition({
            targetFieldId: 'a',
            operator: 'equals',
            value: 'opt-hide',
            effect: 'hide',
          }),
        ],
      }),
      singleLineTextField('c', {
        defaultVisibility: 'visible',
        conditions: [
          makeCondition({
            targetFieldId: 'b',
            operator: 'equals',
            value: 'trigger',
            effect: 'hide',
          }),
        ],
      }),
    ]

    const { states, cycleDetected } = resolve(fields, { a: 'opt-hide', b: 'trigger' })

    expect(cycleDetected).toBe(false)
    // B is hidden by A's condition.
    expect(states.get('b')).toEqual({ visible: false, required: false })
    // C's condition watches B, but B is hidden so its value is absent ->
    // C's hide condition never matches -> C stays at its default (visible).
    expect(states.get('c')).toEqual({ visible: true, required: false })
  })

  it('falls back to defaults and reports a cycle when conditions never stabilize', () => {
    const fields = [
      singleSelectField('a', {
        defaultVisibility: 'visible',
        config: { options: [{ id: 'opt-a1', label: 'A1' }] },
        conditions: [
          makeCondition({
            targetFieldId: 'b',
            operator: 'equals',
            value: 'opt-b1',
            effect: 'hide',
          }),
        ],
      }),
      singleSelectField('b', {
        defaultVisibility: 'visible',
        config: { options: [{ id: 'opt-b1', label: 'B1' }] },
        conditions: [
          makeCondition({
            targetFieldId: 'a',
            operator: 'equals',
            value: 'opt-a1',
            effect: 'hide',
          }),
        ],
      }),
    ]

    const { states, cycleDetected } = resolve(fields, { a: 'opt-a1', b: 'opt-b1' })

    expect(cycleDetected).toBe(true)
    expect(states.get('a')).toEqual({ visible: true, required: false })
    expect(states.get('b')).toEqual({ visible: true, required: false })
  })

  it('throws for a condition with an unrecognized effect (defensive exhaustiveness guard)', () => {
    const fields = [
      singleLineTextField('a'),
      singleLineTextField('b', {
        conditions: [
          makeCondition({
            targetFieldId: 'a',
            operator: 'equals',
            value: 'x',
            effect: 'bogus' as Condition['effect'],
          }),
        ],
      }),
    ]

    expect(() => resolve(fields, { a: 'x' })).toThrow()
  })
})

describe('getEffectiveValues', () => {
  it('includes values for visible fields and omits hidden fields entirely', () => {
    const fields = [
      singleLineTextField('a', { defaultVisibility: 'visible' }),
      singleLineTextField('b', { defaultVisibility: 'hidden' }),
    ]
    const { states } = resolve(fields, { a: 'hello', b: 'world' })

    const effective = getEffectiveValues(fields, { a: 'hello', b: 'world' }, states)

    expect(effective.get('a')).toBe('hello')
    expect(effective.has('b')).toBe(false)
  })
})

describe('OPERATORS_BY_FIELD_TYPE', () => {
  it('lists the exact operator set for each field type, used by the field registry', () => {
    expect(OPERATORS_BY_FIELD_TYPE).toEqual({
      singleLineText: ['equals', 'notEquals', 'contains'],
      multiLineText: ['equals', 'notEquals', 'contains'],
      number: ['equals', 'gt', 'lt', 'withinRange'],
      date: ['equals', 'isBefore', 'isAfter'],
      singleSelect: ['equals', 'notEquals'],
      multiSelect: ['containsAny', 'containsAll', 'containsNone'],
      fileUpload: [],
      sectionHeader: [],
      calculation: [],
    })
  })
})
