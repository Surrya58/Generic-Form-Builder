import type { Draft, Field, FormInstance, Template } from '../domain'
import type { StorageAdapter } from './types'

/** In-memory StorageAdapter for unit tests. */
export function createMockStorageAdapter(initial: Record<string, string> = {}): StorageAdapter {
  const store = new Map<string, string>(Object.entries(initial))
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
}

/** StorageAdapter whose methods always throw, for error-mapping tests. */
export function createThrowingStorageAdapter(error: unknown): StorageAdapter {
  return {
    getItem: () => {
      throw error
    },
    setItem: () => {
      throw error
    },
    removeItem: () => {
      throw error
    },
  }
}

const NAME_FIELD: Field = {
  id: 'field-name',
  type: 'singleLineText',
  label: 'Name',
  defaultVisibility: 'visible',
  defaultRequired: true,
  conditions: [],
  config: { placeholder: 'Your name' },
}

export function makeTemplate(overrides: Partial<Pick<Template, 'id' | 'title'>> = {}): Template {
  const now = '2024-01-01T00:00:00.000Z'
  return {
    id: overrides.id ?? 'template-1',
    schemaVersion: 1,
    title: overrides.title ?? 'Sample template',
    fields: [NAME_FIELD],
    createdAt: now,
    updatedAt: now,
  }
}

export function makeInstance(
  templateId: string,
  overrides: Partial<Pick<FormInstance, 'id'>> = {},
): FormInstance {
  const template = makeTemplate({ id: templateId })
  return {
    id: overrides.id ?? 'instance-1',
    templateId,
    templateSnapshot: {
      title: template.title,
      fields: template.fields,
      schemaVersion: template.schemaVersion,
    },
    values: { [NAME_FIELD.id]: 'Ada Lovelace' },
    submittedAt: '2024-01-01T00:00:00.000Z',
  }
}

export function makeDraft(kind: Draft['kind'], refId: string): Draft {
  return {
    kind,
    refId,
    payload: { note: 'draft payload' },
    updatedAt: '2024-01-01T00:00:00.000Z',
  }
}
