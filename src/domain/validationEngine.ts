import { assertNever } from './assertNever'
import type { Field, FileMeta } from './field'
import type { ValidationError } from './validation'

function error(field: Field, code: string, message: string): ValidationError {
  return { fieldId: field.id, code, message }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isFileMetaArray(value: unknown): value is FileMeta[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { name?: unknown }).name === 'string' &&
        typeof (item as { size?: unknown }).size === 'number' &&
        typeof (item as { type?: unknown }).type === 'string',
    )
  )
}

function countDecimals(value: number): number {
  if (Number.isInteger(value)) return 0
  const text = value.toString()
  const dotIndex = text.indexOf('.')
  if (dotIndex === -1) return 0
  return text.length - dotIndex - 1
}

/**
 * Parses a raw (typically string) input into a number, per the rule
 * that numbers are `number | null` — anything invalid or empty becomes
 * `null`, never `0`.
 */
export function parseNumberInput(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (trimmed === '') return null

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function getFileExtension(fileName: string): string | null {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === fileName.length - 1) return null
  return fileName.slice(lastDot).toLowerCase()
}

/**
 * Matches a file against a fileUpload field's `acceptedTypes`. Patterns
 * may be file extensions (".pdf") or MIME types/globs ("image/*"),
 * matched case-insensitively. A file with no extension can only match
 * MIME-based patterns. An empty `acceptedTypes` list accepts anything.
 */
export function fileMatchesAcceptedTypes(file: FileMeta, acceptedTypes: string[]): boolean {
  if (acceptedTypes.length === 0) return true

  const extension = getFileExtension(file.name)
  const mimeType = file.type.toLowerCase()

  return acceptedTypes.some((rawPattern) => {
    const pattern = rawPattern.trim().toLowerCase()
    if (pattern.startsWith('.')) {
      return extension !== null && extension === pattern
    }
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, pattern.indexOf('/'))
      return mimeType.startsWith(`${prefix}/`)
    }
    return mimeType === pattern
  })
}

function validateTextField(
  field: Field & { type: 'singleLineText' | 'multiLineText' },
  effectiveValue: unknown,
  ctx: { effectiveRequired: boolean },
): ValidationError | null {
  const value = typeof effectiveValue === 'string' ? effectiveValue : ''

  if (value.trim() === '') {
    if (ctx.effectiveRequired) return error(field, 'required', `${field.label} is required.`)
    return null
  }

  const { minLength, maxLength } = field.config
  if (minLength !== undefined && value.length < minLength) {
    return error(field, 'minLength', `${field.label} must be at least ${minLength} characters.`)
  }
  if (maxLength !== undefined && value.length > maxLength) {
    return error(field, 'maxLength', `${field.label} must be at most ${maxLength} characters.`)
  }
  return null
}

function validateNumberField(
  field: Field & { type: 'number' },
  effectiveValue: unknown,
  ctx: { effectiveRequired: boolean },
): ValidationError | null {
  const value =
    typeof effectiveValue === 'number' && Number.isFinite(effectiveValue) ? effectiveValue : null

  if (value === null) {
    if (ctx.effectiveRequired) return error(field, 'required', `${field.label} is required.`)
    return null
  }

  const { min, max, decimals } = field.config
  if (min !== undefined && value < min) {
    return error(field, 'min', `${field.label} must be at least ${min}.`)
  }
  if (max !== undefined && value > max) {
    return error(field, 'max', `${field.label} must be at most ${max}.`)
  }
  if (countDecimals(value) > decimals) {
    return error(
      field,
      'decimals',
      `${field.label} allows at most ${decimals} decimal place${decimals === 1 ? '' : 's'}.`,
    )
  }
  return null
}

function validateDateField(
  field: Field & { type: 'date' },
  effectiveValue: unknown,
  ctx: { effectiveRequired: boolean },
): ValidationError | null {
  const value = typeof effectiveValue === 'string' && effectiveValue !== '' ? effectiveValue : null

  if (value === null) {
    if (ctx.effectiveRequired) return error(field, 'required', `${field.label} is required.`)
    return null
  }

  const { minDate, maxDate } = field.config
  if (minDate !== undefined && value < minDate) {
    return error(field, 'minDate', `${field.label} must be on or after ${minDate}.`)
  }
  if (maxDate !== undefined && value > maxDate) {
    return error(field, 'maxDate', `${field.label} must be on or before ${maxDate}.`)
  }
  return null
}

function validateSingleSelectField(
  field: Field & { type: 'singleSelect' },
  effectiveValue: unknown,
  ctx: { effectiveRequired: boolean },
): ValidationError | null {
  const value = typeof effectiveValue === 'string' && effectiveValue !== '' ? effectiveValue : null

  if (value === null && ctx.effectiveRequired) {
    return error(field, 'required', `${field.label} is required.`)
  }
  return null
}

function validateMultiSelectField(
  field: Field & { type: 'multiSelect' },
  effectiveValue: unknown,
  ctx: { effectiveRequired: boolean },
): ValidationError | null {
  const value = isStringArray(effectiveValue) ? effectiveValue : []
  const { minSelections, maxSelections } = field.config

  const effectiveMin = ctx.effectiveRequired
    ? Math.max(1, minSelections ?? 0)
    : (minSelections ?? 0)

  if (value.length < effectiveMin) {
    if (value.length === 0 && ctx.effectiveRequired) {
      return error(field, 'required', `${field.label} is required.`)
    }
    return error(
      field,
      'minSelections',
      `${field.label} requires at least ${effectiveMin} selection${effectiveMin === 1 ? '' : 's'}.`,
    )
  }

  if (maxSelections !== undefined && value.length > maxSelections) {
    return error(
      field,
      'maxSelections',
      `${field.label} allows at most ${maxSelections} selection${maxSelections === 1 ? '' : 's'}.`,
    )
  }

  return null
}

function validateFileUploadField(
  field: Field & { type: 'fileUpload' },
  effectiveValue: unknown,
  ctx: { effectiveRequired: boolean },
): ValidationError | null {
  const files = isFileMetaArray(effectiveValue) ? effectiveValue : []

  if (files.length === 0) {
    if (ctx.effectiveRequired) return error(field, 'required', `${field.label} is required.`)
    return null
  }

  const { maxFiles, acceptedTypes } = field.config
  if (files.length > maxFiles) {
    return error(
      field,
      'maxFiles',
      `${field.label} allows at most ${maxFiles} file${maxFiles === 1 ? '' : 's'}.`,
    )
  }

  for (const file of files) {
    if (!fileMatchesAcceptedTypes(file, acceptedTypes)) {
      return error(field, 'fileType', `${field.label} does not accept "${file.name}".`)
    }
  }

  return null
}

/**
 * Validates a single field's value for fill-mode submission.
 *
 * Hidden fields are never validated — pass `effectiveValue` and
 * `effectiveVisible` from `getEffectiveValues` / `resolve` so a hidden
 * field's stale value can never produce an error. "Required" only
 * fails when the field is effectively required AND visible AND the
 * value is empty.
 */
export function validateField(
  field: Field,
  effectiveValue: unknown,
  ctx: { effectiveRequired: boolean; effectiveVisible: boolean },
): ValidationError | null {
  if (!ctx.effectiveVisible) return null

  switch (field.type) {
    case 'singleLineText':
    case 'multiLineText':
      return validateTextField(field, effectiveValue, ctx)
    case 'number':
      return validateNumberField(field, effectiveValue, ctx)
    case 'date':
      return validateDateField(field, effectiveValue, ctx)
    case 'singleSelect':
      return validateSingleSelectField(field, effectiveValue, ctx)
    case 'multiSelect':
      return validateMultiSelectField(field, effectiveValue, ctx)
    case 'fileUpload':
      return validateFileUploadField(field, effectiveValue, ctx)
    case 'sectionHeader':
    case 'calculation':
      return null
    default:
      return assertNever(field)
  }
}
