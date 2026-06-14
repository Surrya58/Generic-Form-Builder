/** A single field-level validation failure, produced by the fill-mode validation engine. */
export interface ValidationError {
  fieldId: string
  code: string
  message: string
}

/** A problem found while linting a template (e.g. a dangling condition reference). */
export interface TemplateIssue {
  fieldId?: string
  conditionId?: string
  severity: 'error' | 'warning'
  code: string
  message: string
}
