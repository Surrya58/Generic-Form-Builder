import { useMemo } from 'react'
import {
  computeAll,
  getEffectiveValues,
  resolve,
  type Field,
  type FieldConfigMap,
  type FieldValueMap,
  type ValidationError,
} from '../../domain'
import { withField } from '../../registry'

export interface FormRendererProps {
  /** Fields to render, in order. */
  fields: Field[]
  /**
   * Current values keyed by field id. Hidden-field values and calculation
   * results are derived here, not read from this map, so a hidden field's
   * stale value never reaches its renderer.
   */
  values: Record<string, unknown>
  /** Called when a visible input changes. */
  onChange: (fieldId: string, value: unknown) => void
  /** Validation errors to surface, keyed by field id. */
  errors?: Map<string, ValidationError>
  /** Render every input disabled (e.g. a read-only view of a submitted response). */
  readOnly?: boolean
}

/**
 * Renders a template's fields exactly as a filler sees them: conditional
 * visibility/required is resolved live by the condition engine, calculation
 * fields show their computed value, and hidden fields are omitted entirely.
 *
 * Shared by the Builder Preview and Fill mode so the two behave identically —
 * the engines are the single source of truth for what shows and what's needed.
 */
export function FormRenderer({ fields, values, onChange, errors, readOnly }: FormRendererProps) {
  const states = useMemo(() => resolve(fields, values).states, [fields, values])
  const calcValues = useMemo(
    () => computeAll(fields, getEffectiveValues(fields, values, states)),
    [fields, values, states],
  )

  const visibleFields = fields.filter((field) => states.get(field.id)?.visible)

  if (visibleFields.length === 0) {
    return <p className="text-sm text-gray-500">This form has no visible fields.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {visibleFields.map((field) => {
        const required = states.get(field.id)?.required ?? false
        return (
          <div key={field.id} data-field-id={field.id}>
            {withField(field, (typedField, definition) => {
              const config = typedField.config as FieldConfigMap[typeof typedField.type]
              let value: unknown
              if (typedField.type === 'calculation') {
                value = calcValues.get(typedField.id) ?? null
              } else if (typedField.type === 'sectionHeader') {
                // sectionHeader captures no value (its emptyValue throws by design).
                value = null
              } else {
                const current = values[typedField.id]
                value = current === undefined ? definition.emptyValue(config) : current
              }
              return (
                <definition.FillRenderer
                  config={config}
                  value={value as FieldValueMap[typeof typedField.type]}
                  onChange={(next) => onChange(typedField.id, next)}
                  label={typedField.label}
                  required={required}
                  error={errors?.get(typedField.id) ?? null}
                  readOnly={readOnly}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
