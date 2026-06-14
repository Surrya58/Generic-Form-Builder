import { describe, expect, it } from 'vitest'
import { isRequirableField, type FieldType } from './field'

describe('isRequirableField', () => {
  const requirable: FieldType[] = [
    'singleLineText',
    'multiLineText',
    'number',
    'date',
    'singleSelect',
    'multiSelect',
    'fileUpload',
  ]
  const notRequirable: FieldType[] = ['sectionHeader', 'calculation']

  it.each(requirable)('returns true for %s', (type) => {
    expect(isRequirableField(type)).toBe(true)
  })

  it.each(notRequirable)('returns false for %s', (type) => {
    expect(isRequirableField(type)).toBe(false)
  })

  it('throws for an unrecognized field type', () => {
    expect(() => isRequirableField('bogus' as FieldType)).toThrow()
  })
})
