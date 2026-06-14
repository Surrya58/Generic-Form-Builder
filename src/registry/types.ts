import type { FC, ReactNode } from 'react'
import type {
  ConditionValue,
  Field,
  FieldConfigMap,
  FieldType,
  FieldValueMap,
  Operator,
  ValidationError,
} from '../domain'

/** One row of a field's contribution to the exported PDF. */
export interface PdfRow {
  label: string
  value: string
}

export interface ValidationContext {
  effectiveRequired: boolean
  effectiveVisible: boolean
}

export interface ConfigEditorProps<T extends FieldType> {
  /** The full field, for cases the editor needs other fields (e.g. calculation sources). */
  field: Field & { type: T }
  /** All fields on the template, in order — used by editors that reference other fields. */
  allFields: Field[]
  config: FieldConfigMap[T]
  onChange: (next: FieldConfigMap[T]) => void
}

export interface FillRendererProps<T extends FieldType> {
  config: FieldConfigMap[T]
  value: FieldValueMap[T]
  onChange: (next: FieldValueMap[T]) => void
  label: string
  required?: boolean
  error?: ValidationError | null
  readOnly?: boolean
}

/**
 * Everything the rest of the app needs to know about one field type. Adding
 * a new type is a single new file implementing this interface plus one
 * registration line in src/registry/index.ts — nothing else changes.
 */
export interface FieldDefinition<T extends FieldType> {
  type: T
  /** Shown in the palette. */
  displayName: string
  icon: ReactNode
  /** False only for sectionHeader, which captures no value. */
  isInput: boolean

  /** Sensible defaults when this type is dropped on the canvas. */
  defaultConfig(): FieldConfigMap[T]
  emptyValue(config: FieldConfigMap[T]): FieldValueMap[T]

  /** The right-panel editor for this field's config. */
  ConfigEditor: FC<ConfigEditorProps<T>>
  /** Used in both Fill mode and Preview. */
  FillRenderer: FC<FillRendererProps<T>>

  /** Delegates to the validation engine. */
  validate(
    field: Field & { type: T },
    value: unknown,
    ctx: ValidationContext,
  ): ValidationError | null
  /** How this field appears in the exported PDF. */
  toPdfRows(field: Field & { type: T }, value: unknown): PdfRow[]

  /** Which operators this type offers as a condition target. */
  conditionOperators: Operator[]
  /** Delegates to the condition engine's evaluator. */
  evaluateCondition(operator: Operator, fieldValue: unknown, compareValue: ConditionValue): boolean
}

/**
 * The full registry: one definition per field type, each correlated to its
 * own type parameter. Look up entries with `getFieldDefinition` rather than
 * indexing this directly so the generic parameter follows the lookup key.
 *
 * Mapped over `keyof FieldConfigMap` (rather than `FieldType` directly) so
 * the mapped type is homomorphic, which lets object literals be checked
 * key-by-key against `FieldDefinition<K>` for each key's own `K`.
 */
export type FieldRegistry = { [K in keyof FieldConfigMap]: FieldDefinition<K> }

/**
 * A `FieldDefinition` for some field type, without saying which. Used for
 * registry entries (e.g. palette listings) that are presentational and
 * don't need to know which concrete type they're holding.
 */
export type AnyFieldDefinition = { [K in FieldType]: FieldDefinition<K> }[FieldType]
