import type { Field, FieldType } from '../domain'
import type { AnyFieldDefinition, FieldDefinition, FieldRegistry } from './types'
import { calculationDefinition } from './fields/calculation'
import { dateDefinition } from './fields/date'
import { fileUploadDefinition } from './fields/fileUpload'
import { multiLineTextDefinition } from './fields/multiLineText'
import { multiSelectDefinition } from './fields/multiSelect'
import { numberDefinition } from './fields/number'
import { sectionHeaderDefinition } from './fields/sectionHeader'
import { singleLineTextDefinition } from './fields/singleLineText'
import { singleSelectDefinition } from './fields/singleSelect'

export const fieldRegistry: FieldRegistry = {
  singleLineText: singleLineTextDefinition,
  multiLineText: multiLineTextDefinition,
  number: numberDefinition,
  date: dateDefinition,
  singleSelect: singleSelectDefinition,
  multiSelect: multiSelectDefinition,
  fileUpload: fileUploadDefinition,
  sectionHeader: sectionHeaderDefinition,
  calculation: calculationDefinition,
}

export const fieldTypes: FieldType[] = Object.keys(fieldRegistry) as FieldType[]

/**
 * Every definition, in palette display order. UI that lists field types
 * (the palette, "add field" menus, etc.) should iterate this array rather
 * than switching on `FieldType`, so new definitions just need to be added
 * here.
 */
export const paletteEntries: AnyFieldDefinition[] = fieldTypes.map((type) => fieldRegistry[type])

/** Looks up a field's definition with `T` correlated to the field's own type. */
export function getFieldDefinition<T extends FieldType>(type: T): FieldDefinition<T> {
  return fieldRegistry[type]
}

/** Looks up the definition for a field. */
export function getDefinitionForField(field: Field): AnyFieldDefinition {
  return fieldRegistry[field.type]
}

/**
 * Calls `fn` with `field` and its registry definition, with both correlated
 * to the same field type `K`. This lets callers render `definition.ConfigEditor`
 * or `definition.FillRenderer` for a field pulled from a `Field` union without
 * a type error at each call site — `fieldRegistry[field.type]` is guaranteed
 * at runtime to match `field.type`, so the single cast here is sound.
 */
export function withField<R>(
  field: Field,
  fn: <K extends FieldType>(field: Field & { type: K }, definition: FieldDefinition<K>) => R,
): R {
  const definition = getDefinitionForField(field)
  const call = fn as (field: Field, definition: AnyFieldDefinition) => R
  return call(field, definition)
}

export type {
  AnyFieldDefinition,
  ConfigEditorProps,
  FieldDefinition,
  FieldRegistry,
  FillRendererProps,
  PdfRow,
  ValidationContext,
} from './types'
