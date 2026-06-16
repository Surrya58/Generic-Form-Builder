import { describe, expect, it } from 'vitest'
import {
  makeTestTemplate,
  numberField,
  sectionHeaderField,
  singleLineTextField,
} from '../domain/testFixtures'
import {
  builderReducer,
  copyField,
  createField,
  createInitialState,
  type BuilderState,
} from './builderReducer'

function setup(): BuilderState {
  const fields = [singleLineTextField('a', { label: 'A' }), numberField('b', { label: 'B' })]
  return createInitialState(makeTestTemplate(fields))
}

describe('createInitialState', () => {
  it('starts with no selection, no collapsed fields, and template === savedTemplate', () => {
    const template = makeTestTemplate([])
    const state = createInitialState(template)

    expect(state.template).toBe(template)
    expect(state.savedTemplate).toBe(template)
    expect(state.selectedFieldId).toBeNull()
    expect(state.collapsedFieldIds.size).toBe(0)
  })
})

describe('createField', () => {
  it('builds a field of the requested type with the registry default config', () => {
    const field = createField('number')

    expect(field.type).toBe('number')
    expect(field.label).toBe('')
    expect(field.defaultVisibility).toBe('visible')
    expect(field.defaultRequired).toBe(false)
    expect(field.conditions).toEqual([])
    expect(field.config).toEqual({ decimals: 0 })
  })

  it('gives each new field a unique id', () => {
    const a = createField('singleLineText')
    const b = createField('singleLineText')

    expect(a.id).not.toBe(b.id)
  })
})

describe('copyField', () => {
  it('copies a field with a new id and an appended label', () => {
    const original = singleLineTextField('a', { label: 'Name' })
    const copy = copyField(original)

    expect(copy.id).not.toBe(original.id)
    expect(copy.label).toBe('Name (copy)')
    expect(copy.config).toEqual(original.config)
  })

  it('leaves an empty label empty rather than producing " (copy)"', () => {
    const original = singleLineTextField('a', { label: '' })
    const copy = copyField(original)

    expect(copy.label).toBe('')
  })
})

describe('builderReducer', () => {
  it('setTitle updates the template title', () => {
    const state = setup()
    const next = builderReducer(state, { type: 'setTitle', title: 'New title' })

    expect(next.template.title).toBe('New title')
    expect(next.template).not.toBe(state.template)
  })

  it('addField inserts the field at the given index and selects it', () => {
    const state = setup()
    const field = createField('date')
    const next = builderReducer(state, { type: 'addField', field, atIndex: 1 })

    expect(next.template.fields.map((f) => f.id)).toEqual(['a', field.id, 'b'])
    expect(next.selectedFieldId).toBe(field.id)
  })

  it('updateField replaces the field with the given id', () => {
    const state = setup()
    const updated = { ...state.template.fields[0]!, label: 'Updated' }
    const next = builderReducer(state, { type: 'updateField', field: updated })

    expect(next.template.fields[0]!.label).toBe('Updated')
    expect(next.template.fields[1]).toBe(state.template.fields[1])
  })

  it('duplicateField inserts a copy immediately after the original and selects it', () => {
    const state = setup()
    const newField = copyField(state.template.fields[0]!)
    const next = builderReducer(state, {
      type: 'duplicateField',
      fieldId: 'a',
      newField,
    })

    expect(next.template.fields.map((f) => f.id)).toEqual(['a', newField.id, 'b'])
    expect(next.selectedFieldId).toBe(newField.id)
  })

  it('duplicateField is a no-op if the source field no longer exists', () => {
    const state = setup()
    const newField = copyField(state.template.fields[0]!)
    const next = builderReducer(state, {
      type: 'duplicateField',
      fieldId: 'missing',
      newField,
    })

    expect(next).toBe(state)
  })

  it('deleteField removes the field and clears selection if it was selected', () => {
    const state = {
      ...setup(),
      selectedFieldId: 'a',
      collapsedFieldIds: new Set(['a', 'b']),
    }
    const next = builderReducer(state, { type: 'deleteField', fieldId: 'a' })

    expect(next.template.fields.map((f) => f.id)).toEqual(['b'])
    expect(next.selectedFieldId).toBeNull()
    expect(next.collapsedFieldIds.has('a')).toBe(false)
    expect(next.collapsedFieldIds.has('b')).toBe(true)
  })

  it('deleteField leaves selection alone if a different field was selected', () => {
    const state = { ...setup(), selectedFieldId: 'b' }
    const next = builderReducer(state, { type: 'deleteField', fieldId: 'a' })

    expect(next.selectedFieldId).toBe('b')
  })

  it('deleteField is a no-op if the field does not exist', () => {
    const state = setup()
    const next = builderReducer(state, { type: 'deleteField', fieldId: 'missing' })

    expect(next).toBe(state)
  })

  it('moveField reorders fields via moveItem', () => {
    const state = setup()
    const next = builderReducer(state, { type: 'moveField', fieldId: 'b', toIndex: 0 })

    expect(next.template.fields.map((f) => f.id)).toEqual(['b', 'a'])
  })

  it('moveField is a no-op (same state) when the move has no effect', () => {
    const state = setup()
    const next = builderReducer(state, { type: 'moveField', fieldId: 'a', toIndex: 0 })

    expect(next).toBe(state)
  })

  it('selectField sets the selected field id', () => {
    const state = setup()
    const next = builderReducer(state, { type: 'selectField', fieldId: 'b' })

    expect(next.selectedFieldId).toBe('b')
  })

  it('selectField to the same id is a no-op (same state)', () => {
    const state = { ...setup(), selectedFieldId: 'a' }
    const next = builderReducer(state, { type: 'selectField', fieldId: 'a' })

    expect(next).toBe(state)
  })

  it('selectField(null) clears the selection', () => {
    const state = { ...setup(), selectedFieldId: 'a' }
    const next = builderReducer(state, { type: 'selectField', fieldId: null })

    expect(next.selectedFieldId).toBeNull()
  })

  it('toggleCollapsed adds then removes a field from the collapsed set', () => {
    const state = setup()
    const collapsed = builderReducer(state, { type: 'toggleCollapsed', fieldId: 'a' })
    expect(collapsed.collapsedFieldIds.has('a')).toBe(true)

    const expanded = builderReducer(collapsed, { type: 'toggleCollapsed', fieldId: 'a' })
    expect(expanded.collapsedFieldIds.has('a')).toBe(false)
  })

  it('discard resets the template to the last saved version and clears selection', () => {
    const state = setup()
    const edited = builderReducer(state, { type: 'setTitle', title: 'Edited' })
    const withSelection = { ...edited, selectedFieldId: 'a' }

    const next = builderReducer(withSelection, { type: 'discard' })

    expect(next.template).toBe(state.savedTemplate)
    expect(next.template.title).toBe('Test template')
    expect(next.selectedFieldId).toBeNull()
  })

  it('markSaved updates both template and savedTemplate, clearing the dirty flag', () => {
    const state = setup()
    const edited = builderReducer(state, { type: 'setTitle', title: 'Edited' })

    const next = builderReducer(edited, { type: 'markSaved', template: edited.template })

    expect(next.template).toBe(edited.template)
    expect(next.savedTemplate).toBe(edited.template)
  })

  it('showValidation turns the marker flag on; markSaved and discard turn it off', () => {
    const state = setup()
    expect(state.showValidation).toBe(false)

    const shown = builderReducer(state, { type: 'showValidation' })
    expect(shown.showValidation).toBe(true)

    const saved = builderReducer(shown, { type: 'markSaved', template: shown.template })
    expect(saved.showValidation).toBe(false)

    const discarded = builderReducer(
      builderReducer(saved, { type: 'showValidation' }),
      { type: 'discard' },
    )
    expect(discarded.showValidation).toBe(false)
  })

  it('loadTemplate replaces the template, resets savedTemplate, selection and collapsed state', () => {
    const state = {
      ...setup(),
      selectedFieldId: 'a',
      collapsedFieldIds: new Set(['a']),
    }
    const incoming = makeTestTemplate([sectionHeaderField('c', { label: 'Section' })], {
      id: 'template-2',
    })

    const next = builderReducer(state, { type: 'loadTemplate', template: incoming })

    expect(next.template).toBe(incoming)
    expect(next.savedTemplate).toBe(incoming)
    expect(next.selectedFieldId).toBeNull()
    expect(next.collapsedFieldIds.size).toBe(0)
  })
})
