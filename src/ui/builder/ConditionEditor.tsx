import { useId } from 'react'
import {
  OPERATORS_BY_FIELD_TYPE,
  isRequirableField,
  type Condition,
  type ConditionValue,
  type Field,
  type Operator,
} from '../../domain'
import { ConfigField } from '../../registry/fields/shared/ConfigField'
import { textInputClassName } from '../../registry/fields/shared/inputStyles'
import { Dropdown, type DropdownOption } from '../primitives/Dropdown'

const OPERATOR_LABELS: Record<Operator, string> = {
  equals: 'is',
  notEquals: 'is not',
  contains: 'contains',
  gt: 'is greater than',
  lt: 'is less than',
  withinRange: 'is between',
  isBefore: 'is before',
  isAfter: 'is after',
  containsAny: 'includes any of',
  containsAll: 'includes all of',
  containsNone: 'includes none of',
}

const ALL_OPERATORS: Operator[] = Object.keys(OPERATOR_LABELS) as Operator[]

const EFFECTS: Condition['effect'][] = ['show', 'hide', 'require', 'unrequire']

const EFFECT_LABELS: Record<Condition['effect'], string> = {
  show: 'Show this field',
  hide: 'Hide this field',
  require: 'Require this field',
  unrequire: "Don't require this field",
}

function isOperator(value: string): value is Operator {
  return (ALL_OPERATORS as string[]).includes(value)
}

function isEffect(value: string): value is Condition['effect'] {
  return (EFFECTS as string[]).includes(value)
}

function isRange(value: ConditionValue): value is { min: number; max: number } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: ConditionValue): value is string[] {
  return Array.isArray(value)
}

/** A sensible starting value when a condition's target field or operator changes. */
function defaultValueForTarget(target: Field, operator: Operator): ConditionValue {
  switch (target.type) {
    case 'singleLineText':
    case 'multiLineText':
    case 'date':
      return ''
    case 'number':
      return operator === 'withinRange' ? { min: 0, max: 0 } : 0
    case 'singleSelect':
      return target.config.options[0]?.id ?? ''
    case 'multiSelect':
    case 'fileUpload':
    case 'sectionHeader':
    case 'calculation':
      return []
    default:
      return ''
  }
}

interface ConditionValueInputProps {
  id: string
  targetField: Field
  operator: Operator
  value: ConditionValue
  onChange: (value: ConditionValue) => void
}

function ConditionValueInput({
  id,
  targetField,
  operator,
  value,
  onChange,
}: ConditionValueInputProps) {
  switch (targetField.type) {
    case 'singleLineText':
    case 'multiLineText':
      return (
        <input
          id={id}
          type="text"
          className={textInputClassName}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )
    case 'date':
      return (
        <input
          id={id}
          type="date"
          className={textInputClassName}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )
    case 'number':
      if (operator === 'withinRange') {
        const range = isRange(value) ? value : { min: 0, max: 0 }
        return (
          <div className="flex items-center gap-2">
            <input
              id={id}
              type="number"
              aria-label="Minimum value"
              className={textInputClassName}
              value={range.min}
              onChange={(event) => onChange({ ...range, min: Number(event.target.value) })}
            />
            <span className="text-xs text-gray-500">and</span>
            <input
              type="number"
              aria-label="Maximum value"
              className={textInputClassName}
              value={range.max}
              onChange={(event) => onChange({ ...range, max: Number(event.target.value) })}
            />
          </div>
        )
      }
      return (
        <input
          id={id}
          type="number"
          className={textInputClassName}
          value={typeof value === 'number' ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      )
    case 'singleSelect':
      return (
        <Dropdown
          id={id}
          options={targetField.config.options}
          value={typeof value === 'string' ? value : null}
          onChange={onChange}
          placeholder="Select a value"
        />
      )
    case 'multiSelect':
      return (
        <div className="flex flex-col gap-1">
          {targetField.config.options.map((option) => {
            const selected = isStringArray(value) ? value : []
            const checked = selected.includes(option.id)
            return (
              <label key={option.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked
                        ? selected.filter((optionId) => optionId !== option.id)
                        : [...selected, option.id],
                    )
                  }
                />
                {option.label}
              </label>
            )
          })}
          {targetField.config.options.length === 0 && (
            <p className="text-xs text-gray-500">This field has no options yet.</p>
          )}
        </div>
      )
    default:
      return null
  }
}

interface ConditionRowProps {
  condition: Condition
  index: number
  field: Field
  allFields: Field[]
  targetCandidates: Field[]
  onChange: (next: Condition) => void
  onRemove: () => void
}

function ConditionRow({
  condition,
  index,
  field,
  allFields,
  targetCandidates,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const id = useId()
  const targetField = allFields.find((candidate) => candidate.id === condition.targetFieldId)
  const operators = targetField ? OPERATORS_BY_FIELD_TYPE[targetField.type] : []
  const effects = isRequirableField(field.type) ? EFFECTS : (['show', 'hide'] as const)

  const targetOptions: DropdownOption[] = targetCandidates.map((candidate) => ({
    id: candidate.id,
    label: candidate.label || 'Untitled field',
  }))
  const operatorOptions: DropdownOption[] = operators.map((operator) => ({
    id: operator,
    label: OPERATOR_LABELS[operator],
  }))
  const effectOptions: DropdownOption[] = effects.map((effect) => ({
    id: effect,
    label: EFFECT_LABELS[effect],
  }))

  function handleTargetChange(targetFieldId: string) {
    const next = allFields.find((candidate) => candidate.id === targetFieldId)
    if (!next) return
    const operator = OPERATORS_BY_FIELD_TYPE[next.type][0] ?? condition.operator
    onChange({
      ...condition,
      targetFieldId,
      operator,
      value: defaultValueForTarget(next, operator),
    })
  }

  function handleOperatorChange(operatorId: string) {
    if (!isOperator(operatorId) || !targetField) return
    onChange({
      ...condition,
      operator: operatorId,
      value: defaultValueForTarget(targetField, operatorId),
    })
  }

  function handleEffectChange(effectId: string) {
    if (!isEffect(effectId)) return
    onChange({ ...condition, effect: effectId })
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-500">Condition {index + 1}</span>
        <button
          type="button"
          aria-label={`Remove condition ${index + 1}`}
          onClick={onRemove}
          className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          ✕
        </button>
      </div>

      <ConfigField label="When" htmlFor={`${id}-target`}>
        <Dropdown
          id={`${id}-target`}
          options={targetOptions}
          value={targetField ? condition.targetFieldId : null}
          onChange={handleTargetChange}
          placeholder="Select a field"
        />
      </ConfigField>

      {!targetField && (
        <p className="text-xs text-amber-600">
          The field this condition referred to was deleted. Choose a new field above or remove this
          condition.
        </p>
      )}

      {targetField && operators.length === 0 && (
        <p className="text-xs text-amber-600">
          &quot;{targetField.label || 'Untitled field'}&quot; doesn&apos;t support conditions.
          Choose a different field above.
        </p>
      )}

      {targetField && operators.length > 0 && (
        <>
          <ConfigField label="Operator" htmlFor={`${id}-operator`}>
            <Dropdown
              id={`${id}-operator`}
              options={operatorOptions}
              value={condition.operator}
              onChange={handleOperatorChange}
            />
          </ConfigField>

          <ConfigField label="Value" htmlFor={`${id}-value`}>
            <ConditionValueInput
              id={`${id}-value`}
              targetField={targetField}
              operator={condition.operator}
              value={condition.value}
              onChange={(value) => onChange({ ...condition, value })}
            />
          </ConfigField>
        </>
      )}

      <ConfigField label="Then" htmlFor={`${id}-effect`}>
        <Dropdown
          id={`${id}-effect`}
          options={effectOptions}
          value={condition.effect}
          onChange={handleEffectChange}
        />
      </ConfigField>
    </div>
  )
}

export interface ConditionEditorProps {
  field: Field
  allFields: Field[]
  onChange: (conditions: Condition[]) => void
}

/**
 * Add/remove/edit the `Condition`s attached to a field: each one picks a
 * target field elsewhere on the form, an operator constrained by that
 * field's type, a comparison value shaped to match, and an effect (show,
 * hide, require, or unrequire this field).
 */
export function ConditionEditor({ field, allFields, onChange }: ConditionEditorProps) {
  const targetCandidates = allFields.filter(
    (candidate) => candidate.id !== field.id && OPERATORS_BY_FIELD_TYPE[candidate.type].length > 0,
  )

  function addCondition() {
    const target = targetCandidates[0]
    if (!target) return
    const operator = OPERATORS_BY_FIELD_TYPE[target.type][0]
    if (!operator) return
    onChange([
      ...field.conditions,
      {
        id: crypto.randomUUID(),
        targetFieldId: target.id,
        operator,
        value: defaultValueForTarget(target, operator),
        effect: 'show',
      },
    ])
  }

  function updateCondition(index: number, next: Condition) {
    onChange(field.conditions.map((condition, i) => (i === index ? next : condition)))
  }

  function removeCondition(index: number) {
    onChange(field.conditions.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-gray-700">Conditions</span>
      {field.conditions.length === 0 && (
        <p className="text-xs text-gray-500">
          No conditions yet — this field always uses its default visibility and required setting.
        </p>
      )}
      {field.conditions.map((condition, index) => (
        <ConditionRow
          key={condition.id}
          condition={condition}
          index={index}
          field={field}
          allFields={allFields}
          targetCandidates={targetCandidates}
          onChange={(next) => updateCondition(index, next)}
          onRemove={() => removeCondition(index)}
        />
      ))}
      <button
        type="button"
        onClick={addCondition}
        disabled={targetCandidates.length === 0}
        className="self-start rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Add condition
      </button>
      {targetCandidates.length === 0 && (
        <p className="text-xs text-gray-500">
          Add a text, number, date, or select field to create a condition.
        </p>
      )}
    </div>
  )
}
