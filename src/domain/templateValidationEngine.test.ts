import { describe, expect, it } from 'vitest'
import {
  calculationField,
  dateField,
  fileUploadField,
  makeCondition,
  makeTestTemplate,
  multiLineTextField,
  multiSelectField,
  numberField,
  resetConditionCounter,
  sectionHeaderField,
  singleLineTextField,
  singleSelectField,
} from './testFixtures'
import { validateTemplate } from './templateValidationEngine'

function codes(issues: ReturnType<typeof validateTemplate>): string[] {
  return issues.map((issue) => issue.code)
}

describe('validateTemplate', () => {
  it('returns no issues for a clean template', () => {
    const text = singleLineTextField('text', { config: { minLength: 1, maxLength: 10 } })
    const select = singleSelectField('select', {
      config: {
        options: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
      },
    })
    const template = makeTestTemplate([text, select])

    expect(validateTemplate(template)).toEqual([])
  })

  describe('missing label', () => {
    it('flags an input field with a blank label', () => {
      const field = singleLineTextField('f1', { label: '   ' })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).toContain('missingLabel')
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.fieldId).toBe('f1')
    })

    it('does not flag a sectionHeader for a blank label', () => {
      const field = sectionHeaderField('f1', { label: '' })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).not.toContain('missingLabel')
    })

    it('does not flag a calculation field for a blank label', () => {
      const field = calculationField('f1', { label: '' })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).not.toContain('missingLabel')
    })
  })

  describe('select options', () => {
    it('flags a singleSelect with zero options', () => {
      const field = singleSelectField('f1')
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).toContain('noOptions')
      expect(issues.find((i) => i.code === 'noOptions')?.severity).toBe('error')
    })

    it('flags a multiSelect with zero options', () => {
      const field = multiSelectField('f1')
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).toContain('noOptions')
    })

    it('warns on duplicate option labels (case-insensitive, trimmed)', () => {
      const field = singleSelectField('f1', {
        config: {
          options: [
            { id: 'a', label: 'Yes' },
            { id: 'b', label: ' yes ' },
          ],
        },
      })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).toContain('duplicateOptionLabels')
      expect(issues.find((i) => i.code === 'duplicateOptionLabels')?.severity).toBe('warning')
    })

    it('does not warn when option labels are unique', () => {
      const field = singleSelectField('f1', {
        config: {
          options: [
            { id: 'a', label: 'Yes' },
            { id: 'b', label: 'No' },
          ],
        },
      })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).not.toContain('duplicateOptionLabels')
    })
  })

  describe('min/max ranges', () => {
    it('flags singleLineText with minLength > maxLength', () => {
      const field = singleLineTextField('f1', { config: { minLength: 10, maxLength: 5 } })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).toContain('invalidRange')
    })

    it('flags multiLineText with minLength > maxLength', () => {
      const field = multiLineTextField('f1', { config: { minLength: 10, maxLength: 5 } })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).toContain('invalidRange')
    })

    it('flags a number field with min > max', () => {
      const field = numberField('f1', { config: { min: 10, max: 5 } })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).toContain('invalidRange')
    })

    it('flags a multiSelect with minSelections > maxSelections', () => {
      const field = multiSelectField('f1', {
        config: { options: [{ id: 'a', label: 'A' }], minSelections: 3, maxSelections: 1 },
      })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).toContain('invalidRange')
    })

    it('flags a date field with minDate after maxDate', () => {
      const field = dateField('f1', { config: { minDate: '2024-12-31', maxDate: '2024-01-01' } })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).toContain('invalidRange')
    })

    it('does not flag a field where only one bound is configured', () => {
      const field = numberField('f1', { config: { min: 5 } })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).not.toContain('invalidRange')
    })

    it('does not flag a date field where only minDate is configured', () => {
      const field = dateField('f1', { config: { minDate: '2024-01-01' } })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).not.toContain('invalidRange')
    })
  })

  describe('fileUpload maxFiles', () => {
    it('flags maxFiles < 1', () => {
      const field = fileUploadField('f1', { config: { maxFiles: 0 } })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).toContain('invalidMaxFiles')
    })

    it('does not flag a valid maxFiles', () => {
      const field = fileUploadField('f1', { config: { maxFiles: 1 } })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).not.toContain('invalidMaxFiles')
    })
  })

  describe('calculation sources', () => {
    it('flags a calculation with no sources', () => {
      const calc = calculationField('calc', { config: { sourceFieldIds: [] } })
      const issues = validateTemplate(makeTestTemplate([calc]))

      expect(codes(issues)).toContain('calculationNoSources')
    })

    it('flags a calculation referencing a missing source', () => {
      const calc = calculationField('calc', { config: { sourceFieldIds: ['deleted'] } })
      const issues = validateTemplate(makeTestTemplate([calc]))

      expect(codes(issues)).toContain('calculationMissingSource')
    })

    it('flags a calculation sourcing another calculation', () => {
      const other = calculationField('other')
      const calc = calculationField('calc', { config: { sourceFieldIds: ['other'] } })
      const issues = validateTemplate(makeTestTemplate([other, calc]))

      expect(codes(issues)).toContain('calculationInvalidSource')
    })

    it('flags a calculation sourcing a non-number field', () => {
      const text = singleLineTextField('text')
      const calc = calculationField('calc', { config: { sourceFieldIds: ['text'] } })
      const issues = validateTemplate(makeTestTemplate([text, calc]))

      expect(codes(issues)).toContain('calculationInvalidSource')
    })

    it('does not flag a calculation sourcing valid number fields', () => {
      const n1 = numberField('n1')
      const calc = calculationField('calc', { config: { sourceFieldIds: ['n1'] } })
      const issues = validateTemplate(makeTestTemplate([n1, calc]))

      expect(codes(issues)).not.toContain('calculationNoSources')
      expect(codes(issues)).not.toContain('calculationMissingSource')
      expect(codes(issues)).not.toContain('calculationInvalidSource')
    })
  })

  describe('conditions', () => {
    it('flags a condition with no target field id', () => {
      resetConditionCounter()
      const other = singleLineTextField('other')
      const field = singleLineTextField('f1', {
        conditions: [
          makeCondition({ targetFieldId: '', operator: 'equals', value: 'x', effect: 'show' }),
        ],
      })
      const issues = validateTemplate(makeTestTemplate([field, other]))

      expect(codes(issues)).toContain('conditionNoTarget')
      expect(issues[0]?.conditionId).toBe('cond-1')
    })

    it('flags a self-referencing condition', () => {
      resetConditionCounter()
      const field = singleLineTextField('f1', {
        conditions: [
          makeCondition({ targetFieldId: 'f1', operator: 'equals', value: 'x', effect: 'show' }),
        ],
      })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).toContain('conditionSelfReference')
    })

    it('flags a condition targeting a deleted field', () => {
      resetConditionCounter()
      const field = singleLineTextField('f1', {
        conditions: [
          makeCondition({
            targetFieldId: 'deleted',
            operator: 'equals',
            value: 'x',
            effect: 'show',
          }),
        ],
      })
      const issues = validateTemplate(makeTestTemplate([field]))

      expect(codes(issues)).toContain('conditionDanglingTarget')
    })

    it('flags a condition with an incomplete scalar value', () => {
      resetConditionCounter()
      const other = singleLineTextField('other')
      const field = singleLineTextField('f1', {
        conditions: [
          makeCondition({
            targetFieldId: 'other',
            operator: 'equals',
            value: '   ',
            effect: 'show',
          }),
        ],
      })
      const issues = validateTemplate(makeTestTemplate([field, other]))

      expect(codes(issues)).toContain('conditionIncompleteValue')
    })

    it('flags a condition with a non-finite numeric value', () => {
      resetConditionCounter()
      const other = numberField('other')
      const field = singleLineTextField('f1', {
        conditions: [
          makeCondition({ targetFieldId: 'other', operator: 'gt', value: NaN, effect: 'show' }),
        ],
      })
      const issues = validateTemplate(makeTestTemplate([field, other]))

      expect(codes(issues)).toContain('conditionIncompleteValue')
    })

    it('flags a condition with an empty array value', () => {
      resetConditionCounter()
      const other = multiSelectField('other')
      const field = singleLineTextField('f1', {
        conditions: [
          makeCondition({
            targetFieldId: 'other',
            operator: 'containsAny',
            value: [],
            effect: 'show',
          }),
        ],
      })
      const issues = validateTemplate(makeTestTemplate([field, other]))

      expect(codes(issues)).toContain('conditionIncompleteValue')
    })

    it('flags a condition with an incomplete range value', () => {
      resetConditionCounter()
      const other = numberField('other')
      const field = singleLineTextField('f1', {
        conditions: [
          makeCondition({
            targetFieldId: 'other',
            operator: 'withinRange',
            value: { min: 1, max: NaN },
            effect: 'show',
          }),
        ],
      })
      const issues = validateTemplate(makeTestTemplate([field, other]))

      expect(codes(issues)).toContain('conditionIncompleteValue')
    })

    it('does not flag a well-formed condition', () => {
      resetConditionCounter()
      const other = singleLineTextField('other')
      const field = singleLineTextField('f1', {
        conditions: [
          makeCondition({
            targetFieldId: 'other',
            operator: 'equals',
            value: 'hello',
            effect: 'show',
          }),
        ],
      })
      const issues = validateTemplate(makeTestTemplate([field, other]))

      expect(codes(issues)).toEqual([])
    })

    it('does not flag a complete range value', () => {
      resetConditionCounter()
      const other = numberField('other')
      const field = singleLineTextField('f1', {
        conditions: [
          makeCondition({
            targetFieldId: 'other',
            operator: 'withinRange',
            value: { min: 1, max: 10 },
            effect: 'show',
          }),
        ],
      })
      const issues = validateTemplate(makeTestTemplate([field, other]))

      expect(codes(issues)).not.toContain('conditionIncompleteValue')
    })

    it('does not flag a non-empty array value', () => {
      resetConditionCounter()
      const other = multiSelectField('other')
      const field = singleLineTextField('f1', {
        conditions: [
          makeCondition({
            targetFieldId: 'other',
            operator: 'containsAny',
            value: ['opt-a'],
            effect: 'show',
          }),
        ],
      })
      const issues = validateTemplate(makeTestTemplate([field, other]))

      expect(codes(issues)).not.toContain('conditionIncompleteValue')
    })
  })
})
