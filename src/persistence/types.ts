import type { FormInstance, ISODateTime, Template } from '../domain'

/** Result of any storage write. Writes never throw to the UI. */
export type StorageResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: 'quota' | 'unavailable' | 'unknown'; message: string }

/**
 * Thin wrapper over raw key/value storage so the repository can be
 * unit-tested against a mock instead of the real localStorage.
 */
export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Lightweight entry in the templates index, so the list screen doesn't load every template. */
export interface TemplateSummary {
  id: string
  title: string
  updatedAt: ISODateTime
}

/** A reversibly-deleted record, held in fb:trash until restored or purged. */
export type TrashEntry =
  | { id: string; kind: 'template'; deletedAt: ISODateTime; data: Template }
  | {
      id: string
      kind: 'instance'
      deletedAt: ISODateTime
      templateId: string
      data: FormInstance
    }
