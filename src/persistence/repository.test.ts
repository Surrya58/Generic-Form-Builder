import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from './migrations'
import { createRepository } from './repository'
import {
  createMockStorageAdapter,
  createThrowingStorageAdapter,
  makeDraft,
  makeInstance,
  makeTemplate,
} from './testFixtures'
import { STORAGE_KEYS } from './keys'

describe('repository: templates', () => {
  it('round-trips create, read, update and list', () => {
    const repo = createRepository(createMockStorageAdapter())
    const template = makeTemplate()

    expect(repo.saveTemplate(template)).toEqual({ ok: true, value: undefined })
    expect(repo.getTemplate(template.id)).toEqual({ ok: true, value: template })

    const summaries = repo.listTemplateSummaries()
    expect(summaries).toEqual({
      ok: true,
      value: [{ id: template.id, title: template.title, updatedAt: template.updatedAt }],
    })

    const updated = { ...template, title: 'Renamed', updatedAt: '2024-02-01T00:00:00.000Z' }
    repo.saveTemplate(updated)
    expect(repo.getTemplate(template.id)).toEqual({ ok: true, value: updated })
    expect(repo.listTemplateSummaries()).toEqual({
      ok: true,
      value: [{ id: updated.id, title: 'Renamed', updatedAt: updated.updatedAt }],
    })
  })

  it('returns null for a template that does not exist', () => {
    const repo = createRepository(createMockStorageAdapter())
    expect(repo.getTemplate('missing')).toEqual({ ok: true, value: null })
  })

  it('deleting moves a template to trash, removing it from the index, and it can be restored', () => {
    const repo = createRepository(createMockStorageAdapter())
    const template = makeTemplate()
    repo.saveTemplate(template)

    expect(repo.deleteTemplate(template.id)).toEqual({ ok: true, value: undefined })
    expect(repo.getTemplate(template.id)).toEqual({ ok: true, value: null })
    expect(repo.listTemplateSummaries()).toEqual({ ok: true, value: [] })

    const trash = repo.listTrash()
    expect(trash.ok).toBe(true)
    if (!trash.ok) throw new Error('unreachable')
    expect(trash.value).toHaveLength(1)
    expect(trash.value[0]).toMatchObject({ kind: 'template', data: template })

    const trashEntry = trash.value[0]!
    const restored = repo.restoreFromTrash(trashEntry.id)
    expect(restored).toEqual({ ok: true, value: trashEntry })

    expect(repo.getTemplate(template.id)).toEqual({ ok: true, value: template })
    expect(repo.listTrash()).toEqual({ ok: true, value: [] })
  })

  it('purging a trash entry removes it permanently', () => {
    const repo = createRepository(createMockStorageAdapter())
    const template = makeTemplate()
    repo.saveTemplate(template)
    repo.deleteTemplate(template.id)

    const trash = repo.listTrash()
    if (!trash.ok) throw new Error('unreachable')
    const trashId = trash.value[0]!.id

    expect(repo.purgeTrash(trashId)).toEqual({ ok: true, value: undefined })
    expect(repo.listTrash()).toEqual({ ok: true, value: [] })
    expect(repo.getTemplate(template.id)).toEqual({ ok: true, value: null })
  })
})

describe('repository: instances', () => {
  it('round-trips create, read and list, partitioned per template', () => {
    const repo = createRepository(createMockStorageAdapter())
    const instance = makeInstance('template-1')

    expect(repo.saveInstance(instance)).toEqual({ ok: true, value: undefined })
    expect(repo.getInstance('template-1', instance.id)).toEqual({ ok: true, value: instance })
    expect(repo.listInstances('template-1')).toEqual({ ok: true, value: [instance] })
    expect(repo.listInstances('other-template')).toEqual({ ok: true, value: [] })
  })

  it('deleting moves an instance to trash and it can be restored', () => {
    const repo = createRepository(createMockStorageAdapter())
    const instance = makeInstance('template-1')
    repo.saveInstance(instance)

    expect(repo.deleteInstance('template-1', instance.id)).toEqual({ ok: true, value: undefined })
    expect(repo.listInstances('template-1')).toEqual({ ok: true, value: [] })

    const trash = repo.listTrash()
    if (!trash.ok) throw new Error('unreachable')
    expect(trash.value).toMatchObject([
      { kind: 'instance', templateId: 'template-1', data: instance },
    ])

    repo.restoreFromTrash(trash.value[0]!.id)
    expect(repo.listInstances('template-1')).toEqual({ ok: true, value: [instance] })
  })
})

describe('repository: drafts', () => {
  it('round-trips template drafts and clears them', () => {
    const repo = createRepository(createMockStorageAdapter())
    const draft = makeDraft('template', 'template-1')

    expect(repo.saveTemplateDraft(draft)).toEqual({ ok: true, value: undefined })
    expect(repo.getTemplateDraft('template-1')).toEqual({ ok: true, value: draft })

    expect(repo.clearTemplateDraft('template-1')).toEqual({ ok: true, value: undefined })
    expect(repo.getTemplateDraft('template-1')).toEqual({ ok: true, value: null })
  })

  it('round-trips instance drafts and clears them', () => {
    const repo = createRepository(createMockStorageAdapter())
    const draft = makeDraft('instance', 'instance-1')

    expect(repo.saveInstanceDraft(draft)).toEqual({ ok: true, value: undefined })
    expect(repo.getInstanceDraft('instance-1')).toEqual({ ok: true, value: draft })

    expect(repo.clearInstanceDraft('instance-1')).toEqual({ ok: true, value: undefined })
    expect(repo.getInstanceDraft('instance-1')).toEqual({ ok: true, value: null })
  })
})

describe('repository: schema migration', () => {
  it('upgrades a v0 template (missing updatedAt) to the current schema on read', () => {
    const adapter = createMockStorageAdapter()
    const legacyTemplate = {
      id: 'template-1',
      schemaVersion: 1,
      title: 'Legacy template',
      fields: [],
      createdAt: '2023-01-01T00:00:00.000Z',
      // no updatedAt
    }
    adapter.setItem(
      STORAGE_KEYS.template('template-1'),
      JSON.stringify({ schemaVersion: 0, data: legacyTemplate }),
    )

    const repo = createRepository(adapter)
    const result = repo.getTemplate('template-1')

    expect(result).toEqual({
      ok: true,
      value: { ...legacyTemplate, updatedAt: legacyTemplate.createdAt },
    })

    // Re-saving should persist it at the current schema version.
    if (!result.ok || result.value === null) throw new Error('unreachable')
    repo.saveTemplate(result.value)
    const raw = adapter.getItem(STORAGE_KEYS.template('template-1'))
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw ?? '') as { schemaVersion: number }
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })
})

describe('repository: StorageResult error mapping', () => {
  it('maps QuotaExceededError to a quota result', () => {
    const adapter = createThrowingStorageAdapter(
      new DOMException('limit reached', 'QuotaExceededError'),
    )
    const repo = createRepository(adapter)

    const result = repo.saveTemplate(makeTemplate())
    expect(result).toEqual({ ok: false, error: 'quota', message: 'limit reached' })
  })

  it("maps Safari's legacy QUOTA_EXCEEDED_ERR (code 1014) to a quota result", () => {
    const error = new DOMException('legacy quota', 'QUOTA_EXCEEDED_ERR')
    const adapter = createThrowingStorageAdapter(error)
    const repo = createRepository(adapter)

    const result = repo.saveTemplate(makeTemplate())
    expect(result).toEqual({ ok: false, error: 'quota', message: 'legacy quota' })
  })

  it('maps SecurityError to an unavailable result', () => {
    const adapter = createThrowingStorageAdapter(new DOMException('blocked', 'SecurityError'))
    const repo = createRepository(adapter)

    const result = repo.saveTemplate(makeTemplate())
    expect(result).toEqual({ ok: false, error: 'unavailable', message: 'blocked' })
  })

  it('maps other errors to an unknown result', () => {
    const adapter = createThrowingStorageAdapter(new Error('boom'))
    const repo = createRepository(adapter)

    const result = repo.saveTemplate(makeTemplate())
    expect(result).toEqual({ ok: false, error: 'unknown', message: 'boom' })
  })

  it('reports malformed JSON as an unknown error rather than throwing', () => {
    const adapter = createMockStorageAdapter({ [STORAGE_KEYS.template('template-1')]: 'not json' })
    const repo = createRepository(adapter)

    const result = repo.getTemplate('template-1')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).toBe('unknown')
  })
})
