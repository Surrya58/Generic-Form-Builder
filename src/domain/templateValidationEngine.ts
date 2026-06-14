import type { Condition, ConditionValue } from './condition'
import { isRequirableField } from './field'
import type { Field } from './field'
import type { Template } from './template'
import type { TemplateIssue } from './validation'

function fieldIssue(
  field: Field,
  severity: TemplateIssue['severity'],
  code: string,
  message: string,
): TemplateIssue {
  return { fieldId: field.id, severity, code, message }
}

function conditionIssue(
  field: Field,
  condition: Condition,
  code: string,
  message: string,
): TemplateIssue {
  return { fieldId: field.id, conditionId: condition.id, severity: 'error', code, message }
}

function checkLabel(field: Field, issues: TemplateIssue[]): void {
  if (!isRequirableField(field.type)) return
  if (field.label.trim() === '') {
    issues.push(fieldIssue(field, 'error', 'missingLabel', 'This field is missing a label.'))
  }
}

function checkSelectOptions(field: Field, issues: TemplateIssue[]): void {
  if (field.type !== 'singleSelect' && field.type !== 'multiSelect') return

  const { options } = field.config
  if (options.length === 0) {
    issues.push(fieldIssue(field, 'error', 'noOptions', `${field.label} has no options.`))
    return
  }

  const seen = new Set<string>()
  for (const option of options) {
    const key = option.label.trim().toLowerCase()
    if (seen.has(key)) {
      issues.push(
        fieldIssue(
          field,
          'warning',
          'duplicateOptionLabels',
          `${field.label} has duplicate option labels.`,
        ),
      )
      return
    }
    seen.add(key)
  }
}

function checkRangeConstraints(field: Field, issues: TemplateIssue[]): void {
  if (field.type === 'singleLineText' || field.type === 'multiLineText') {
    const { minLength, maxLength } = field.config
    if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
      issues.push(
        fieldIssue(
          field,
          'error',
          'invalidRange',
          `${field.label}: minimum length is greater than maximum length.`,
        ),
      )
    }
  }

  if (field.type === 'number') {
    const { min, max } = field.config
    if (min !== undefined && max !== undefined && min > max) {
      issues.push(
        fieldIssue(
          field,
          'error',
          'invalidRange',
          `${field.label}: minimum value is greater than maximum value.`,
        ),
      )
    }
  }

  if (field.type === 'multiSelect') {
    const { minSelections, maxSelections } = field.config
    if (
      minSelections !== undefined &&
      maxSelections !== undefined &&
      minSelections > maxSelections
    ) {
      issues.push(
        fieldIssue(
          field,
          'error',
          'invalidRange',
          `${field.label}: minimum selections is greater than maximum selections.`,
        ),
      )
    }
  }

  if (field.type === 'date') {
    const { minDate, maxDate } = field.config
    if (minDate !== undefined && maxDate !== undefined && minDate > maxDate) {
      issues.push(
        fieldIssue(
          field,
          'error',
          'invalidRange',
          `${field.label}: minimum date is after maximum date.`,
        ),
      )
    }
  }

  if (field.type === 'fileUpload' && field.config.maxFiles < 1) {
    issues.push(
      fieldIssue(field, 'error', 'invalidMaxFiles', `${field.label} must allow at least 1 file.`),
    )
  }
}

function checkCalculationSources(
  field: Field,
  fieldsById: Map<string, Field>,
  issues: TemplateIssue[],
): void {
  if (field.type !== 'calculation') return

  if (field.config.sourceFieldIds.length === 0) {
    issues.push(
      fieldIssue(
        field,
        'error',
        'calculationNoSources',
        `${field.label} has no source fields configured.`,
      ),
    )
    return
  }

  for (const sourceId of field.config.sourceFieldIds) {
    const source = fieldsById.get(sourceId)
    if (!source) {
      issues.push(
        fieldIssue(
          field,
          'error',
          'calculationMissingSource',
          `${field.label} references a source field that no longer exists.`,
        ),
      )
      continue
    }
    if (source.type !== 'number') {
      issues.push(
        fieldIssue(
          field,
          'error',
          'calculationInvalidSource',
          `${field.label} references "${source.label}", which is not a Number field.`,
        ),
      )
    }
  }
}

function isIncompleteConditionValue(value: ConditionValue): boolean {
  if (typeof value === 'string') return value.trim() === ''
  if (typeof value === 'number') return !Number.isFinite(value)
  if (Array.isArray(value)) return value.length === 0
  return !Number.isFinite(value.min) || !Number.isFinite(value.max)
}

function checkConditions(
  field: Field,
  fieldsById: Map<string, Field>,
  issues: TemplateIssue[],
): void {
  for (const condition of field.conditions) {
    if (!condition.targetFieldId) {
      issues.push(
        conditionIssue(
          field,
          condition,
          'conditionNoTarget',
          'This condition has no target field.',
        ),
      )
      continue
    }

    if (condition.targetFieldId === field.id) {
      issues.push(
        conditionIssue(
          field,
          condition,
          'conditionSelfReference',
          'This condition targets its own field.',
        ),
      )
      continue
    }

    if (!fieldsById.has(condition.targetFieldId)) {
      issues.push(
        conditionIssue(
          field,
          condition,
          'conditionDanglingTarget',
          'This condition targets a field that no longer exists.',
        ),
      )
      continue
    }

    if (isIncompleteConditionValue(condition.value)) {
      issues.push(
        conditionIssue(
          field,
          condition,
          'conditionIncompleteValue',
          'This condition is missing a comparison value.',
        ),
      )
    }
  }
}

/**
 * Lints a template for builder-time problems. `error` issues should
 * block saving the template; `warning` issues are non-blocking.
 */
export function validateTemplate(template: Template): TemplateIssue[] {
  const issues: TemplateIssue[] = []
  const fieldsById = new Map(template.fields.map((field) => [field.id, field]))

  for (const field of template.fields) {
    checkLabel(field, issues)
    checkSelectOptions(field, issues)
    checkRangeConstraints(field, issues)
    checkCalculationSources(field, fieldsById, issues)
    checkConditions(field, fieldsById, issues)
  }

  return issues
}
