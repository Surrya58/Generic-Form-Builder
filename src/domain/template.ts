import type { Field } from './field'
import type { ISODateTime } from './primitives'

export interface Template {
  id: string
  schemaVersion: number
  title: string
  /** Array order = render order. */
  fields: Field[]
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

/**
 * A snapshot of a template's shape at submission time, embedded in a
 * FormInstance so PDFs re-export faithfully even if the template later
 * changes or is deleted.
 */
export interface TemplateSnapshot {
  title: string
  fields: Field[]
  schemaVersion: number
}
