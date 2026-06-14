import type { TemplateSnapshot } from './template'
import type { ISODateTime } from './primitives'

/** A submitted instance. Snapshots its template — see TemplateSnapshot. */
export interface FormInstance {
  id: string
  templateId: string
  templateSnapshot: TemplateSnapshot
  /** Keyed by field id. */
  values: Record<string, unknown>
  submittedAt: ISODateTime
}

/**
 * In-progress, mutable, autosaved state for either a template being
 * edited in the Builder or an instance being filled out. NOT a
 * FormInstance — cleared on submit/commit.
 */
export interface Draft {
  kind: 'template' | 'instance'
  refId: string
  payload: unknown
  updatedAt: ISODateTime
}
