import type { Condition } from './condition'
import type { Field, FieldConfigMap, FieldType, FileMeta } from './field'
import type { Template } from './template'

interface FieldOverrides<K extends FieldType> {
  label?: string
  defaultVisibility?: 'visible' | 'hidden'
  defaultRequired?: boolean
  conditions?: Condition[]
  config?: Partial<FieldConfigMap[K]>
}

function buildField<K extends FieldType>(
  type: K,
  id: string,
  defaultConfig: FieldConfigMap[K],
  overrides: FieldOverrides<K> = {},
): Field & { type: K } {
  return {
    id,
    type,
    label: overrides.label ?? `${type}-${id}`,
    defaultVisibility: overrides.defaultVisibility ?? 'visible',
    defaultRequired: overrides.defaultRequired ?? false,
    conditions: overrides.conditions ?? [],
    config: { ...defaultConfig, ...overrides.config },
  } as Field & { type: K }
}

export function singleLineTextField(
  id: string,
  overrides: FieldOverrides<'singleLineText'> = {},
): Field & { type: 'singleLineText' } {
  return buildField('singleLineText', id, {}, overrides)
}

export function multiLineTextField(
  id: string,
  overrides: FieldOverrides<'multiLineText'> = {},
): Field & { type: 'multiLineText' } {
  return buildField('multiLineText', id, { rows: 3 }, overrides)
}

export function numberField(
  id: string,
  overrides: FieldOverrides<'number'> = {},
): Field & { type: 'number' } {
  return buildField('number', id, { decimals: 0 }, overrides)
}

export function dateField(
  id: string,
  overrides: FieldOverrides<'date'> = {},
): Field & { type: 'date' } {
  return buildField('date', id, { prefillToday: false }, overrides)
}

export function singleSelectField(
  id: string,
  overrides: FieldOverrides<'singleSelect'> = {},
): Field & { type: 'singleSelect' } {
  return buildField('singleSelect', id, { options: [], display: 'dropdown' }, overrides)
}

export function multiSelectField(
  id: string,
  overrides: FieldOverrides<'multiSelect'> = {},
): Field & { type: 'multiSelect' } {
  return buildField('multiSelect', id, { options: [] }, overrides)
}

export function fileUploadField(
  id: string,
  overrides: FieldOverrides<'fileUpload'> = {},
): Field & { type: 'fileUpload' } {
  return buildField('fileUpload', id, { acceptedTypes: [], maxFiles: 1 }, overrides)
}

export function sectionHeaderField(
  id: string,
  overrides: FieldOverrides<'sectionHeader'> = {},
): Field & { type: 'sectionHeader' } {
  return buildField('sectionHeader', id, { size: 'md' }, overrides)
}

export function calculationField(
  id: string,
  overrides: FieldOverrides<'calculation'> = {},
): Field & { type: 'calculation' } {
  return buildField(
    'calculation',
    id,
    { sourceFieldIds: [], aggregation: 'sum', decimals: 0 },
    overrides,
  )
}

let conditionCounter = 0

/** Resets the auto-incrementing id used by `makeCondition` when no id is given. */
export function resetConditionCounter(): void {
  conditionCounter = 0
}

export function makeCondition(overrides: Omit<Condition, 'id'> & { id?: string }): Condition {
  conditionCounter += 1
  return { id: `cond-${conditionCounter}`, ...overrides }
}

export function makeFileMeta(overrides: Partial<FileMeta> = {}): FileMeta {
  return { name: 'file.pdf', size: 1024, type: 'application/pdf', ...overrides }
}

export function makeTestTemplate(fields: Field[], overrides: Partial<Template> = {}): Template {
  return {
    id: 'template-1',
    schemaVersion: 1,
    title: 'Test template',
    fields,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}
