import { assertNever, type Draft, type FormInstance, type Template } from '../domain'
import { generateId } from './id'
import { STORAGE_KEYS } from './keys'
import {
  CURRENT_SCHEMA_VERSION,
  migrateEnvelope,
  type RecordKind,
  type StoredEnvelope,
} from './migrations'
import { classifyStorageError } from './storageError'
import type { StorageAdapter, StorageResult, TemplateSummary, TrashEntry } from './types'

export interface Repository {
  listTemplateSummaries(): StorageResult<TemplateSummary[]>
  getTemplate(id: string): StorageResult<Template | null>
  saveTemplate(template: Template): StorageResult<void>
  deleteTemplate(id: string): StorageResult<void>

  listInstances(templateId: string): StorageResult<FormInstance[]>
  getInstance(templateId: string, instanceId: string): StorageResult<FormInstance | null>
  saveInstance(instance: FormInstance): StorageResult<void>
  deleteInstance(templateId: string, instanceId: string): StorageResult<void>

  getTemplateDraft(templateId: string): StorageResult<Draft | null>
  saveTemplateDraft(draft: Draft): StorageResult<void>
  clearTemplateDraft(templateId: string): StorageResult<void>

  getInstanceDraft(instanceId: string): StorageResult<Draft | null>
  saveInstanceDraft(draft: Draft): StorageResult<void>
  clearInstanceDraft(instanceId: string): StorageResult<void>

  listTrash(): StorageResult<TrashEntry[]>
  restoreFromTrash(entryId: string): StorageResult<TrashEntry | null>
  purgeTrash(entryId: string): StorageResult<void>
}

function ok<T>(value: T): StorageResult<T> {
  return { ok: true, value }
}

function readEnvelope<T>(
  adapter: StorageAdapter,
  key: string,
  kind: RecordKind,
): StorageResult<T | null> {
  let raw: string | null
  try {
    raw = adapter.getItem(key)
  } catch (error) {
    return classifyStorageError(error)
  }

  if (raw === null) return ok(null)

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return {
      ok: false,
      error: 'unknown',
      message: `Failed to parse ${key}: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'unknown', message: `Malformed record at ${key}` }
  }

  const migrated = migrateEnvelope<T>(kind, parsed as StoredEnvelope<unknown>)
  return ok(migrated.data)
}

function writeEnvelope<T>(adapter: StorageAdapter, key: string, data: T): StorageResult<void> {
  const envelope: StoredEnvelope<T> = { schemaVersion: CURRENT_SCHEMA_VERSION, data }
  try {
    adapter.setItem(key, JSON.stringify(envelope))
    return ok(undefined)
  } catch (error) {
    return classifyStorageError(error)
  }
}

function removeRaw(adapter: StorageAdapter, key: string): StorageResult<void> {
  try {
    adapter.removeItem(key)
    return ok(undefined)
  } catch (error) {
    return classifyStorageError(error)
  }
}

export function createRepository(adapter: StorageAdapter): Repository {
  function listTemplateSummaries(): StorageResult<TemplateSummary[]> {
    const result = readEnvelope<TemplateSummary[]>(
      adapter,
      STORAGE_KEYS.templatesIndex,
      'templatesIndex',
    )
    if (!result.ok) return result
    return ok(result.value ?? [])
  }

  function getTemplate(id: string): StorageResult<Template | null> {
    return readEnvelope<Template>(adapter, STORAGE_KEYS.template(id), 'template')
  }

  function saveTemplate(template: Template): StorageResult<void> {
    const writeResult = writeEnvelope(adapter, STORAGE_KEYS.template(template.id), template)
    if (!writeResult.ok) return writeResult

    const indexResult = listTemplateSummaries()
    if (!indexResult.ok) return indexResult

    const summary: TemplateSummary = {
      id: template.id,
      title: template.title,
      updatedAt: template.updatedAt,
    }
    const nextIndex = [...indexResult.value.filter((entry) => entry.id !== template.id), summary]
    return writeEnvelope(adapter, STORAGE_KEYS.templatesIndex, nextIndex)
  }

  function deleteTemplate(id: string): StorageResult<void> {
    const templateResult = getTemplate(id)
    if (!templateResult.ok) return templateResult
    if (templateResult.value === null) return ok(undefined)

    const trashResult = pushTrash({
      id: generateId(),
      kind: 'template',
      deletedAt: new Date().toISOString(),
      data: templateResult.value,
    })
    if (!trashResult.ok) return trashResult

    const removeResult = removeRaw(adapter, STORAGE_KEYS.template(id))
    if (!removeResult.ok) return removeResult

    const indexResult = listTemplateSummaries()
    if (!indexResult.ok) return indexResult
    return writeEnvelope(
      adapter,
      STORAGE_KEYS.templatesIndex,
      indexResult.value.filter((entry) => entry.id !== id),
    )
  }

  function listInstances(templateId: string): StorageResult<FormInstance[]> {
    const result = readEnvelope<FormInstance[]>(
      adapter,
      STORAGE_KEYS.instances(templateId),
      'instances',
    )
    if (!result.ok) return result
    return ok(result.value ?? [])
  }

  function getInstance(templateId: string, instanceId: string): StorageResult<FormInstance | null> {
    const result = listInstances(templateId)
    if (!result.ok) return result
    return ok(result.value.find((instance) => instance.id === instanceId) ?? null)
  }

  function saveInstance(instance: FormInstance): StorageResult<void> {
    const result = listInstances(instance.templateId)
    if (!result.ok) return result
    const next = [...result.value.filter((existing) => existing.id !== instance.id), instance]
    return writeEnvelope(adapter, STORAGE_KEYS.instances(instance.templateId), next)
  }

  function deleteInstance(templateId: string, instanceId: string): StorageResult<void> {
    const result = listInstances(templateId)
    if (!result.ok) return result

    const instance = result.value.find((existing) => existing.id === instanceId)
    if (!instance) return ok(undefined)

    const trashResult = pushTrash({
      id: generateId(),
      kind: 'instance',
      deletedAt: new Date().toISOString(),
      templateId,
      data: instance,
    })
    if (!trashResult.ok) return trashResult

    return writeEnvelope(
      adapter,
      STORAGE_KEYS.instances(templateId),
      result.value.filter((existing) => existing.id !== instanceId),
    )
  }

  function getTemplateDraft(templateId: string): StorageResult<Draft | null> {
    return readEnvelope<Draft>(adapter, STORAGE_KEYS.draftTemplate(templateId), 'draft')
  }

  function saveTemplateDraft(draft: Draft): StorageResult<void> {
    return writeEnvelope(adapter, STORAGE_KEYS.draftTemplate(draft.refId), draft)
  }

  function clearTemplateDraft(templateId: string): StorageResult<void> {
    return removeRaw(adapter, STORAGE_KEYS.draftTemplate(templateId))
  }

  function getInstanceDraft(instanceId: string): StorageResult<Draft | null> {
    return readEnvelope<Draft>(adapter, STORAGE_KEYS.draftInstance(instanceId), 'draft')
  }

  function saveInstanceDraft(draft: Draft): StorageResult<void> {
    return writeEnvelope(adapter, STORAGE_KEYS.draftInstance(draft.refId), draft)
  }

  function clearInstanceDraft(instanceId: string): StorageResult<void> {
    return removeRaw(adapter, STORAGE_KEYS.draftInstance(instanceId))
  }

  function listTrash(): StorageResult<TrashEntry[]> {
    const result = readEnvelope<TrashEntry[]>(adapter, STORAGE_KEYS.trash, 'trash')
    if (!result.ok) return result
    return ok(result.value ?? [])
  }

  function pushTrash(entry: TrashEntry): StorageResult<void> {
    const result = listTrash()
    if (!result.ok) return result
    return writeEnvelope(adapter, STORAGE_KEYS.trash, [...result.value, entry])
  }

  function restoreFromTrash(entryId: string): StorageResult<TrashEntry | null> {
    const result = listTrash()
    if (!result.ok) return result

    const entry = result.value.find((candidate) => candidate.id === entryId)
    if (!entry) return ok(null)

    const remaining = result.value.filter((candidate) => candidate.id !== entryId)
    const trashWriteResult = writeEnvelope(adapter, STORAGE_KEYS.trash, remaining)
    if (!trashWriteResult.ok) return trashWriteResult

    let restoreResult: StorageResult<void>
    switch (entry.kind) {
      case 'template':
        restoreResult = saveTemplate(entry.data)
        break
      case 'instance':
        restoreResult = saveInstance(entry.data)
        break
      default:
        return assertNever(entry)
    }

    if (!restoreResult.ok) return restoreResult
    return ok(entry)
  }

  function purgeTrash(entryId: string): StorageResult<void> {
    const result = listTrash()
    if (!result.ok) return result
    return writeEnvelope(
      adapter,
      STORAGE_KEYS.trash,
      result.value.filter((entry) => entry.id !== entryId),
    )
  }

  return {
    listTemplateSummaries,
    getTemplate,
    saveTemplate,
    deleteTemplate,
    listInstances,
    getInstance,
    saveInstance,
    deleteInstance,
    getTemplateDraft,
    saveTemplateDraft,
    clearTemplateDraft,
    getInstanceDraft,
    saveInstanceDraft,
    clearInstanceDraft,
    listTrash,
    restoreFromTrash,
    purgeTrash,
  }
}
