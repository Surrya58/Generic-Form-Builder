import { describe, expect, it } from 'vitest'
import type { Field, FormInstance } from '../domain'
import {
  fileUploadField,
  makeFileMeta,
  numberField,
  singleLineTextField,
} from '../domain/testFixtures'
import { buildInstancePdfBytes } from './buildPdf'

function instanceFrom(
  fields: Field[],
  values: Record<string, unknown>,
  overrides: Partial<FormInstance> = {},
): FormInstance {
  return {
    id: 'i1',
    templateId: 't1',
    templateSnapshot: { title: 'My Form', fields, schemaVersion: 1 },
    values,
    submittedAt: '2024-05-01T10:00:00.000Z',
    ...overrides,
  }
}

function render(instance: FormInstance): string {
  return new TextDecoder().decode(buildInstancePdfBytes(instance))
}

describe('buildInstancePdf', () => {
  it('produces a structurally valid PDF document', () => {
    const text = render(instanceFrom([singleLineTextField('a', { label: 'Name' })], { a: 'Ada' }))
    expect(text.startsWith('%PDF-1.7')).toBe(true)
    expect(text).toContain('/Type /Catalog')
    expect(text).toContain('/BaseFont /Helvetica')
    expect(text).toContain('startxref')
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('escapes parentheses and backslashes in values', () => {
    const text = render(instanceFrom([singleLineTextField('a', { label: 'Note' })], { a: 'a (b) \\ c' }))
    expect(text).toContain('a \\(b\\) \\\\ c')
  })

  it('excludes hidden fields entirely', () => {
    const fields = [
      singleLineTextField('a', { label: 'VisibleField' }),
      singleLineTextField('b', { label: 'HiddenSecret', defaultVisibility: 'hidden' }),
    ]
    const text = render(instanceFrom(fields, { a: 'shown', b: 'hidden value' }))
    expect(text).toContain('VisibleField')
    expect(text).not.toContain('HiddenSecret')
  })

  it('paginates long content across multiple pages', () => {
    const fields = Array.from({ length: 60 }, (_, i) =>
      singleLineTextField(`f${String(i)}`, { label: `Field ${String(i)}` }),
    )
    const values = Object.fromEntries(fields.map((field, i) => [field.id, `value ${String(i)}`]))
    const text = render(instanceFrom(fields, values))
    const count = Number(/\/Count (\d+)/.exec(text)?.[1])
    expect(count).toBeGreaterThan(1)
  })

  it('notes that file contents are not included', () => {
    const text = render(
      instanceFrom([fileUploadField('u', { label: 'Resume' })], {
        u: [makeFileMeta({ name: 'cv.pdf' })],
      }),
    )
    expect(text).toContain('cv.pdf')
    expect(text).toContain('File contents are not included')
  })

  it('renders a calculation snapshot value', () => {
    const fields = [
      numberField('n1', { label: 'A' }),
      numberField('n2', { label: 'B' }),
    ]
    const text = render(instanceFrom(fields, { n1: 2, n2: 4 }))
    expect(text).toContain('A')
    expect(text).toContain('B')
  })
})
