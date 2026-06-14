import { useId } from 'react'
import { OPERATORS_BY_FIELD_TYPE, evaluateOperator, validateField } from '../../domain'
import { MultiSelectIcon } from '../icons'
import type { ConfigEditorProps, FieldDefinition, FillRendererProps } from '../types'
import { ConfigField } from './shared/ConfigField'
import { FieldShell, describedBy } from './shared/FieldShell'
import { textInputClassName } from './shared/inputStyles'
import { OptionListEditor } from './shared/OptionListEditor'
import { parseOptionalInt } from './shared/parsing'

function MultiSelectConfigEditor({ config, onChange }: ConfigEditorProps<'multiSelect'>) {
  const id = useId()
  return (
    <div className="flex flex-col gap-3">
      <ConfigField label="Options" htmlFor={`${id}-options`}>
        <OptionListEditor
          options={config.options}
          onChange={(options) => onChange({ ...config, options })}
        />
      </ConfigField>
      <div className="grid grid-cols-2 gap-3">
        <ConfigField label="Minimum selections" htmlFor={`${id}-min`}>
          <input
            id={`${id}-min`}
            type="number"
            min={0}
            className={textInputClassName}
            value={config.minSelections ?? ''}
            onChange={(event) =>
              onChange({ ...config, minSelections: parseOptionalInt(event.target.value) })
            }
          />
        </ConfigField>
        <ConfigField label="Maximum selections" htmlFor={`${id}-max`}>
          <input
            id={`${id}-max`}
            type="number"
            min={0}
            className={textInputClassName}
            value={config.maxSelections ?? ''}
            onChange={(event) =>
              onChange({ ...config, maxSelections: parseOptionalInt(event.target.value) })
            }
          />
        </ConfigField>
      </div>
    </div>
  )
}

function MultiSelectFillRenderer({
  config,
  value,
  onChange,
  label,
  required,
  error,
  readOnly,
}: FillRendererProps<'multiSelect'>) {
  const id = useId()

  function toggle(optionId: string, checked: boolean) {
    onChange(checked ? [...value, optionId] : value.filter((id) => id !== optionId))
  }

  return (
    <FieldShell id={id} label={label} required={required} error={error} labelAs="span">
      <div
        role="group"
        aria-labelledby={id}
        aria-describedby={describedBy(id, { hasError: Boolean(error) })}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        className="flex flex-col gap-2"
      >
        {config.options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={value.includes(option.id)}
              disabled={readOnly}
              onChange={(event) => toggle(option.id, event.target.checked)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </FieldShell>
  )
}

export const multiSelectDefinition: FieldDefinition<'multiSelect'> = {
  type: 'multiSelect',
  displayName: 'Multi select',
  icon: <MultiSelectIcon />,
  isInput: true,

  defaultConfig: () => ({
    options: [
      { id: crypto.randomUUID(), label: 'Option 1' },
      { id: crypto.randomUUID(), label: 'Option 2' },
    ],
  }),
  emptyValue: () => [],

  ConfigEditor: MultiSelectConfigEditor,
  FillRenderer: MultiSelectFillRenderer,

  validate: (field, value, ctx) => validateField(field, value, ctx),
  toPdfRows: (field, value) => {
    const ids = Array.isArray(value) ? value : []
    const labels = field.config.options
      .filter((option) => ids.includes(option.id))
      .map((option) => option.label)
    return [{ label: field.label, value: labels.join(', ') }]
  },

  conditionOperators: OPERATORS_BY_FIELD_TYPE.multiSelect,
  evaluateCondition: (operator, fieldValue, compareValue) =>
    evaluateOperator('multiSelect', operator, fieldValue, compareValue),
}
