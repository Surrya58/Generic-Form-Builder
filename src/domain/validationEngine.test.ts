import { describe, expect, it } from 'vitest'
import type { Field } from './field'
import {
  dateField,
  fileUploadField,
  makeFileMeta,
  multiLineTextField,
  multiSelectField,
  numberField,
  sectionHeaderField,
  singleLineTextField,
  singleSelectField,
} from './testFixtures'
import { fileMatchesAcceptedTypes, parseNumberInput, validateField } from './validationEngine'

const required = { effectiveVisible: true, effectiveRequired: true }
const optional = { effectiveVisible: true, effectiveRequired: false }
const visible = optional

describe('validateField', () => {
  it('returns null for any field that is not effectively visible, regardless of value', () => {
    const field = singleLineTextField('f1', { defaultRequired: true })

    expect(
      validateField(field, undefined, { effectiveVisible: false, effectiveRequired: true }),
    ).toBeNull()
  })

  it('throws for an unrecognized field type (defensive exhaustiveness guard)', () => {
    const field = { ...singleLineTextField('f1'), type: 'bogus' } as unknown as Field

    expect(() => validateField(field, 'value', required)).toThrow()
  })

  describe('singleLineText / multiLineText', () => {
    it('fails required when the value is undefined', () => {
      const field = singleLineTextField('f1')
      const result = validateField(field, undefined, required)

      expect(result?.fieldId).toBe('f1')
      expect(result?.code).toBe('required')
      expect(typeof result?.message).toBe('string')
    })

    it('fails required when the value is whitespace only', () => {
      const field = singleLineTextField('f1')

      expect(validateField(field, '   ', required)?.code).toBe('required')
    })

    it('passes a not-required empty field', () => {
      const field = singleLineTextField('f1')

      expect(validateField(field, undefined, optional)).toBeNull()
    })

    it('fails minLength', () => {
      const field = singleLineTextField('f1', { config: { minLength: 3 } })

      expect(validateField(field, 'ab', visible)?.code).toBe('minLength')
    })

    it('fails maxLength', () => {
      const field = singleLineTextField('f1', { config: { maxLength: 5 } })

      expect(validateField(field, 'abcdef', visible)?.code).toBe('maxLength')
    })

    it('passes within length bounds', () => {
      const field = singleLineTextField('f1', { config: { minLength: 2, maxLength: 5 } })

      expect(validateField(field, 'abc', required)).toBeNull()
    })

    it('applies the same rules to multiLineText', () => {
      const field = multiLineTextField('f1', { config: { maxLength: 3 } })

      expect(validateField(field, 'toolong', visible)?.code).toBe('maxLength')
    })
  })

  describe('number', () => {
    it('fails required when the value is null', () => {
      const field = numberField('f1')

      expect(validateField(field, null, required)?.code).toBe('required')
    })

    it('fails required when the value is not a finite number', () => {
      const field = numberField('f1')

      expect(validateField(field, 'not-a-number', required)?.code).toBe('required')
    })

    it('passes a not-required empty number', () => {
      const field = numberField('f1')

      expect(validateField(field, null, optional)).toBeNull()
    })

    it('fails min', () => {
      const field = numberField('f1', { config: { min: 5 } })

      expect(validateField(field, 3, visible)?.code).toBe('min')
    })

    it('fails max', () => {
      const field = numberField('f1', { config: { max: 10 } })

      expect(validateField(field, 15, visible)?.code).toBe('max')
    })

    it('fails decimals when the value has more precision than configured', () => {
      const field = numberField('f1', { config: { decimals: 2 } })

      expect(validateField(field, 1.234, visible)?.code).toBe('decimals')
    })

    it('uses singular wording when only 1 decimal place is allowed', () => {
      const field = numberField('f1', { config: { decimals: 1 } })
      const result = validateField(field, 1.23, visible)

      expect(result?.code).toBe('decimals')
      expect(result?.message).toContain('1 decimal place.')
    })

    it('passes a value with exactly the configured decimals', () => {
      const field = numberField('f1', { config: { decimals: 2, min: 0, max: 10 } })

      expect(validateField(field, 1.23, required)).toBeNull()
    })

    it('passes an integer regardless of configured decimals', () => {
      const field = numberField('f1', { config: { decimals: 0 } })

      expect(validateField(field, 5, required)).toBeNull()
    })

    it('treats a number in exponential notation as having 0 decimals', () => {
      const field = numberField('f1', { config: { decimals: 4 } })

      expect(validateField(field, 0.0000005, required)).toBeNull()
    })
  })

  describe('date', () => {
    it('fails required when the value is undefined', () => {
      const field = dateField('f1')

      expect(validateField(field, undefined, required)?.code).toBe('required')
    })

    it('fails required when the value is an empty string', () => {
      const field = dateField('f1')

      expect(validateField(field, '', required)?.code).toBe('required')
    })

    it('passes a not-required empty date', () => {
      const field = dateField('f1')

      expect(validateField(field, undefined, optional)).toBeNull()
    })

    it('fails minDate', () => {
      const field = dateField('f1', { config: { minDate: '2024-01-01' } })

      expect(validateField(field, '2023-12-31', visible)?.code).toBe('minDate')
    })

    it('fails maxDate', () => {
      const field = dateField('f1', { config: { maxDate: '2024-12-31' } })

      expect(validateField(field, '2025-01-01', visible)?.code).toBe('maxDate')
    })

    it('passes a date within bounds', () => {
      const field = dateField('f1', { config: { minDate: '2024-01-01', maxDate: '2024-12-31' } })

      expect(validateField(field, '2024-06-01', required)).toBeNull()
    })
  })

  describe('singleSelect', () => {
    it('fails required when the value is null', () => {
      const field = singleSelectField('f1')

      expect(validateField(field, null, required)?.code).toBe('required')
    })

    it('fails required when the value is an empty string', () => {
      const field = singleSelectField('f1')

      expect(validateField(field, '', required)?.code).toBe('required')
    })

    it('passes a not-required empty selection', () => {
      const field = singleSelectField('f1')

      expect(validateField(field, null, optional)).toBeNull()
    })

    it('passes a chosen option', () => {
      const field = singleSelectField('f1', {
        config: { options: [{ id: 'opt-a', label: 'A' }] },
      })

      expect(validateField(field, 'opt-a', required)).toBeNull()
    })
  })

  describe('multiSelect', () => {
    it('fails required when the value is empty', () => {
      const field = multiSelectField('f1')

      expect(validateField(field, [], required)?.code).toBe('required')
    })

    it('treats a non-array value as empty', () => {
      const field = multiSelectField('f1')

      expect(validateField(field, undefined, required)?.code).toBe('required')
    })

    it('passes a not-required empty selection', () => {
      const field = multiSelectField('f1')

      expect(validateField(field, [], optional)).toBeNull()
    })

    it('fails minSelections when required raises the floor above 1', () => {
      const field = multiSelectField('f1', { config: { minSelections: 2 } })

      expect(validateField(field, ['a'], required)?.code).toBe('minSelections')
    })

    it('fails minSelections when not required but a floor is configured', () => {
      const field = multiSelectField('f1', { config: { minSelections: 2 } })

      expect(validateField(field, [], optional)?.code).toBe('minSelections')
    })

    it('uses singular wording when the minimum is 1 selection', () => {
      const field = multiSelectField('f1', { config: { minSelections: 1 } })
      const result = validateField(field, [], optional)

      expect(result?.code).toBe('minSelections')
      expect(result?.message).toContain('1 selection.')
    })

    it('fails maxSelections', () => {
      const field = multiSelectField('f1', { config: { maxSelections: 2 } })

      expect(validateField(field, ['a', 'b', 'c'], visible)?.code).toBe('maxSelections')
    })

    it('uses singular wording when the maximum is 1 selection', () => {
      const field = multiSelectField('f1', { config: { maxSelections: 1 } })
      const result = validateField(field, ['a', 'b'], visible)

      expect(result?.code).toBe('maxSelections')
      expect(result?.message).toContain('1 selection.')
    })

    it('passes a selection within bounds', () => {
      const field = multiSelectField('f1', { config: { minSelections: 1, maxSelections: 3 } })

      expect(validateField(field, ['a', 'b'], required)).toBeNull()
    })
  })

  describe('fileUpload', () => {
    it('fails required when no files are present', () => {
      const field = fileUploadField('f1')

      expect(validateField(field, [], required)?.code).toBe('required')
    })

    it('treats a non-array value as empty', () => {
      const field = fileUploadField('f1')

      expect(validateField(field, undefined, required)?.code).toBe('required')
    })

    it('passes a not-required empty file list', () => {
      const field = fileUploadField('f1')

      expect(validateField(field, [], optional)).toBeNull()
    })

    it('fails maxFiles', () => {
      const field = fileUploadField('f1', { config: { maxFiles: 1 } })
      const files = [makeFileMeta({ name: 'a.pdf' }), makeFileMeta({ name: 'b.pdf' })]

      expect(validateField(field, files, visible)?.code).toBe('maxFiles')
    })

    it('uses plural wording when more than 1 file is allowed', () => {
      const field = fileUploadField('f1', { config: { maxFiles: 2 } })
      const files = [
        makeFileMeta({ name: 'a.pdf' }),
        makeFileMeta({ name: 'b.pdf' }),
        makeFileMeta({ name: 'c.pdf' }),
      ]
      const result = validateField(field, files, visible)

      expect(result?.code).toBe('maxFiles')
      expect(result?.message).toContain('2 files.')
    })

    it('fails fileType when a file does not match acceptedTypes', () => {
      const field = fileUploadField('f1', { config: { maxFiles: 2, acceptedTypes: ['.pdf'] } })
      const files = [makeFileMeta({ name: 'image.png', type: 'image/png' })]

      expect(validateField(field, files, visible)?.code).toBe('fileType')
    })

    it('passes files that match acceptedTypes', () => {
      const field = fileUploadField('f1', {
        config: { maxFiles: 2, acceptedTypes: ['.pdf', 'image/*'] },
      })
      const files = [
        makeFileMeta({ name: 'doc.pdf', type: 'application/pdf' }),
        makeFileMeta({ name: 'photo.png', type: 'image/png' }),
      ]

      expect(validateField(field, files, required)).toBeNull()
    })
  })

  describe('sectionHeader / calculation', () => {
    it('never validates a sectionHeader field', () => {
      const field = sectionHeaderField('f1', { defaultRequired: true })

      expect(validateField(field, undefined, required)).toBeNull()
    })
  })
})

describe('parseNumberInput', () => {
  it('returns a finite number unchanged', () => {
    expect(parseNumberInput(42)).toBe(42)
    expect(parseNumberInput(1.5)).toBe(1.5)
  })

  it('returns null for non-finite numbers', () => {
    expect(parseNumberInput(Infinity)).toBeNull()
    expect(parseNumberInput(NaN)).toBeNull()
  })

  it('parses a numeric string', () => {
    expect(parseNumberInput('42')).toBe(42)
    expect(parseNumberInput('  3.5  ')).toBe(3.5)
  })

  it('returns null for an empty or whitespace-only string', () => {
    expect(parseNumberInput('')).toBeNull()
    expect(parseNumberInput('   ')).toBeNull()
  })

  it('returns null for a non-numeric string', () => {
    expect(parseNumberInput('abc')).toBeNull()
  })

  it('returns null for non-string, non-number values, never 0', () => {
    expect(parseNumberInput(null)).toBeNull()
    expect(parseNumberInput(undefined)).toBeNull()
    expect(parseNumberInput(true)).toBeNull()
    expect(parseNumberInput({})).toBeNull()
  })
})

describe('fileMatchesAcceptedTypes', () => {
  it('accepts anything when acceptedTypes is empty', () => {
    expect(fileMatchesAcceptedTypes(makeFileMeta({ name: 'anything.xyz', type: 'x/y' }), [])).toBe(
      true,
    )
  })

  it('matches a file extension case-insensitively', () => {
    const file = makeFileMeta({ name: 'Report.PDF', type: 'application/pdf' })

    expect(fileMatchesAcceptedTypes(file, ['.pdf'])).toBe(true)
  })

  it('matches a MIME glob case-insensitively', () => {
    const file = makeFileMeta({ name: 'photo.png', type: 'IMAGE/PNG' })

    expect(fileMatchesAcceptedTypes(file, ['image/*'])).toBe(true)
  })

  it('matches an exact MIME type case-insensitively', () => {
    const file = makeFileMeta({ name: 'doc.pdf', type: 'Application/PDF' })

    expect(fileMatchesAcceptedTypes(file, ['application/pdf'])).toBe(true)
  })

  it('rejects a file matching none of the patterns', () => {
    const file = makeFileMeta({ name: 'report.pdf', type: 'application/pdf' })

    expect(fileMatchesAcceptedTypes(file, ['.docx', 'image/*'])).toBe(false)
  })

  it('a file with no extension can only match a MIME-based pattern', () => {
    const noExt = makeFileMeta({ name: 'README', type: 'text/plain' })

    expect(fileMatchesAcceptedTypes(noExt, ['.txt'])).toBe(false)
    expect(fileMatchesAcceptedTypes(noExt, ['text/*'])).toBe(true)
  })

  it('treats a leading dot (dotfile) as having no extension', () => {
    const dotfile = makeFileMeta({ name: '.bashrc', type: 'text/plain' })

    expect(fileMatchesAcceptedTypes(dotfile, ['.bashrc'])).toBe(false)
  })

  it('treats a trailing dot as having no extension', () => {
    const trailingDot = makeFileMeta({ name: 'archive.', type: 'text/plain' })

    expect(fileMatchesAcceptedTypes(trailingDot, ['.txt'])).toBe(false)
  })
})
