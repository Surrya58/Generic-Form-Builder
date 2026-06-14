import { assertNever, type Field, type FieldType, type Template } from '../domain'
import { getFieldDefinition } from '../registry'
import { insertField, moveItem } from './listOperations'

export interface BuilderState {
  template: Template
  /** The template as last saved (or loaded). Used for the dirty check and "Discard". */
  savedTemplate: Template
  selectedFieldId: string | null
  collapsedFieldIds: ReadonlySet<string>
}

export type BuilderAction =
  | { type: 'setTitle'; title: string }
  | { type: 'addField'; field: Field; atIndex: number }
  | { type: 'updateField'; field: Field }
  | { type: 'duplicateField'; fieldId: string; newField: Field }
  | { type: 'deleteField'; fieldId: string }
  | { type: 'moveField'; fieldId: string; toIndex: number }
  | { type: 'selectField'; fieldId: string | null }
  | { type: 'toggleCollapsed'; fieldId: string }
  | { type: 'discard' }
  | { type: 'markSaved'; template: Template }
  | { type: 'loadTemplate'; template: Template }

export function createInitialState(template: Template): BuilderState {
  return {
    template,
    savedTemplate: template,
    selectedFieldId: null,
    collapsedFieldIds: new Set(),
  }
}

/** Builds a new field of `type` with the registry's default config. */
export function createField(type: FieldType): Field {
  const definition = getFieldDefinition(type)
  return {
    id: crypto.randomUUID(),
    type: definition.type,
    label: '',
    defaultVisibility: 'visible',
    defaultRequired: false,
    conditions: [],
    config: definition.defaultConfig(),
  } as Field
}

/** Builds a copy of `field` with a fresh id, to be inserted alongside the original. */
export function copyField(field: Field): Field {
  return {
    ...field,
    id: crypto.randomUUID(),
    label: field.label === '' ? '' : `${field.label} (copy)`,
  }
}

function withoutId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!ids.has(id)) return ids
  const next = new Set(ids)
  next.delete(id)
  return next
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'setTitle':
      return { ...state, template: { ...state.template, title: action.title } }

    case 'addField': {
      const fields = insertField(state.template.fields, action.field, action.atIndex)
      return {
        ...state,
        template: { ...state.template, fields },
        selectedFieldId: action.field.id,
      }
    }

    case 'updateField':
      return {
        ...state,
        template: {
          ...state.template,
          fields: state.template.fields.map((field) =>
            field.id === action.field.id ? action.field : field,
          ),
        },
      }

    case 'duplicateField': {
      const index = state.template.fields.findIndex((field) => field.id === action.fieldId)
      if (index === -1) return state
      const fields = insertField(state.template.fields, action.newField, index + 1)
      return {
        ...state,
        template: { ...state.template, fields },
        selectedFieldId: action.newField.id,
      }
    }

    case 'deleteField': {
      const fields = state.template.fields.filter((field) => field.id !== action.fieldId)
      if (fields.length === state.template.fields.length) return state
      return {
        ...state,
        template: { ...state.template, fields },
        selectedFieldId: state.selectedFieldId === action.fieldId ? null : state.selectedFieldId,
        collapsedFieldIds: withoutId(state.collapsedFieldIds, action.fieldId),
      }
    }

    case 'moveField': {
      const fields = moveItem(state.template.fields, action.fieldId, action.toIndex)
      if (fields === state.template.fields) return state
      return { ...state, template: { ...state.template, fields } }
    }

    case 'selectField':
      return state.selectedFieldId === action.fieldId
        ? state
        : { ...state, selectedFieldId: action.fieldId }

    case 'toggleCollapsed': {
      const collapsedFieldIds = new Set(state.collapsedFieldIds)
      if (collapsedFieldIds.has(action.fieldId)) collapsedFieldIds.delete(action.fieldId)
      else collapsedFieldIds.add(action.fieldId)
      return { ...state, collapsedFieldIds }
    }

    case 'discard':
      return createInitialState(state.savedTemplate)

    case 'markSaved':
      return { ...state, template: action.template, savedTemplate: action.template }

    case 'loadTemplate':
      return createInitialState(action.template)

    default:
      return assertNever(action)
  }
}
