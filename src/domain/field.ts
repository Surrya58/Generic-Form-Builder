import { assertNever } from './assertNever'
import type { Condition } from './condition'
import type { ISODate } from './primitives'

export type FieldType =
  | 'singleLineText'
  | 'multiLineText'
  | 'number'
  | 'date'
  | 'singleSelect'
  | 'multiSelect'
  | 'fileUpload'
  | 'sectionHeader'
  | 'calculation'

export interface Option {
  id: string
  label: string
}

/** File metadata only — never the file bytes (nothing is persisted to localStorage but this). */
export interface FileMeta {
  name: string
  size: number
  type: string
}

/**
 * Per-type configuration. Adding an 11th field type later is a one-key
 * change to this map (and to FieldValueMap below).
 */
export interface FieldConfigMap {
  singleLineText: {
    placeholder?: string
    minLength?: number
    maxLength?: number
    prefix?: string
    suffix?: string
  }
  multiLineText: {
    placeholder?: string
    minLength?: number
    maxLength?: number
    rows: number
  }
  number: {
    min?: number
    max?: number
    decimals: 0 | 1 | 2 | 3 | 4
    prefix?: string
    suffix?: string
  }
  date: {
    prefillToday: boolean
    minDate?: ISODate
    maxDate?: ISODate
  }
  singleSelect: {
    options: Option[]
    display: 'radio' | 'dropdown' | 'tiles'
  }
  multiSelect: {
    options: Option[]
    minSelections?: number
    maxSelections?: number
  }
  fileUpload: {
    acceptedTypes: string[]
    maxFiles: number
  }
  sectionHeader: {
    size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  }
  calculation: {
    sourceFieldIds: string[]
    aggregation: 'sum' | 'avg' | 'min' | 'max'
    decimals: number
  }
}

/** The shape of a value captured for each field type. */
export interface FieldValueMap {
  singleLineText: string
  multiLineText: string
  number: number | null
  date: ISODate | null
  /** optionId */
  singleSelect: string | null
  /** optionIds */
  multiSelect: string[]
  fileUpload: FileMeta[]
  /** sectionHeader captures no value. */
  sectionHeader: never
  /** computed */
  calculation: number | null
}

export interface FieldBase {
  /** Stable UUID via crypto.randomUUID(); survives reorder/rename. */
  id: string
  /** For sectionHeader this IS the displayed content. */
  label: string
  /** Base state before conditions are evaluated. */
  defaultVisibility: 'visible' | 'hidden'
  /** The "Required toggle"; ignored for sectionHeader/calculation. */
  defaultRequired: boolean
  conditions: Condition[]
}

/**
 * The full field union. Narrowing on `.type` gives you the matching
 * config (and, via FieldValueMap, the matching value type).
 */
export type Field = {
  [K in FieldType]: FieldBase & { type: K; config: FieldConfigMap[K] }
}[FieldType]

/**
 * Whether `defaultRequired` has any effect for this field type.
 * sectionHeader and calculation never collect a user-provided value,
 * so "required" is meaningless for them.
 */
export function isRequirableField(type: FieldType): boolean {
  switch (type) {
    case 'singleLineText':
    case 'multiLineText':
    case 'number':
    case 'date':
    case 'singleSelect':
    case 'multiSelect':
    case 'fileUpload':
      return true
    case 'sectionHeader':
    case 'calculation':
      return false
    default:
      return assertNever(type)
  }
}
