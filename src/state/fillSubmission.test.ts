import { describe, expect, it } from 'vitest'
import {
  calculationField,
  makeCondition,
  numberField,
  singleLineTextField,
  singleSelectField,
} from '../domain/testFixtures'
import { validateFill } from './fillSubmission'

describe('validateFill', () => {
  it('flags a required visible field that is empty', () => {
    const fields = [singleLineTextField('a', { label: 'Name', defaultRequired: true })]
    const result = validateFill(fields, {})
    expect(result.errors.get('a')?.code).toBe('required')
    expect(result.visibleFieldIds).toEqual(['a'])
  })

  it('passes and collects values when required fields are filled', () => {
    const fields = [singleLineTextField('a', { label: 'Name', defaultRequired: true })]
    const result = validateFill(fields, { a: 'Ada' })
    expect(result.errors.size).toBe(0)
    expect(result.submittedValues).toEqual({ a: 'Ada' })
  })

  it('never validates or submits a hidden field, even when required', () => {
    const fields = [
      singleLineTextField('a', { label: 'Name', defaultRequired: true }),
      singleLineTextField('b', {
        label: 'Secret',
        defaultRequired: true,
        defaultVisibility: 'hidden',
      }),
    ]
    const result = validateFill(fields, { a: 'Ada', b: '' })
    expect(result.errors.size).toBe(0)
    expect(result.submittedValues).toEqual({ a: 'Ada' })
    expect(result.visibleFieldIds).toEqual(['a'])
  })

  it('excludes a field hidden by a condition and its stale value', () => {
    const fields = [
      singleSelectField('trigger', {
        label: 'Show extra?',
        config: {
          options: [
            { id: 'yes', label: 'Yes' },
            { id: 'no', label: 'No' },
          ],
          display: 'radio',
        },
      }),
      singleLineTextField('extra', {
        label: 'Extra',
        defaultRequired: true,
        conditions: [
          makeCondition({ targetFieldId: 'trigger', operator: 'equals', value: 'no', effect: 'hide' }),
        ],
      }),
    ]
    const result = validateFill(fields, { trigger: 'no', extra: 'stale' })
    expect(result.visibleFieldIds).toEqual(['trigger'])
    expect(result.submittedValues).toEqual({ trigger: 'no' })
  })

  it('captures a calculation as its computed snapshot', () => {
    const fields = [
      numberField('n1', { label: 'A' }),
      numberField('n2', { label: 'B' }),
      calculationField('c', {
        label: 'Total',
        config: { sourceFieldIds: ['n1', 'n2'], aggregation: 'sum', decimals: 0 },
      }),
    ]
    const result = validateFill(fields, { n1: 5, n2: 3 })
    expect(result.errors.size).toBe(0)
    expect(result.submittedValues.c).toBe(8)
  })
})
