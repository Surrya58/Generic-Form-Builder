import { useId } from 'react'
import { OPERATORS_BY_FIELD_TYPE, evaluateOperator, validateField } from '../../domain'
import { DateIcon } from '../icons'
import type { ConfigEditorProps, FieldDefinition, FillRendererProps } from '../types'
import { ConfigField } from './shared/ConfigField'
import { FieldShell, describedBy } from './shared/FieldShell'
import { textInputClassName } from './shared/inputStyles'

function DateConfigEditor({ config, onChange }: ConfigEditorProps<'date'>) {
  const id = useId()
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`${id}-prefill`} className="flex items-center gap-2 text-sm text-gray-700">
        <input
          id={`${id}-prefill`}
          type="checkbox"
          checked={config.prefillToday}
          onChange={(event) => onChange({ ...config, prefillToday: event.target.checked })}
        />
        Prefill with today&apos;s date
      </label>
      <div className="grid grid-cols-2 gap-3">
        <ConfigField label="Earliest date" htmlFor={`${id}-min`}>
          <input
            id={`${id}-min`}
            type="date"
            className={textInputClassName}
            value={config.minDate ?? ''}
            max={config.maxDate}
            onChange={(event) =>
              onChange({
                ...config,
                minDate: event.target.value === '' ? undefined : event.target.value,
              })
            }
          />
        </ConfigField>
        <ConfigField label="Latest date" htmlFor={`${id}-max`}>
          <input
            id={`${id}-max`}
            type="date"
            className={textInputClassName}
            value={config.maxDate ?? ''}
            min={config.minDate}
            onChange={(event) =>
              onChange({
                ...config,
                maxDate: event.target.value === '' ? undefined : event.target.value,
              })
            }
          />
        </ConfigField>
      </div>
    </div>
  )
}

function DateFillRenderer({
  config,
  value,
  onChange,
  label,
  required,
  error,
  readOnly,
}: FillRendererProps<'date'>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={required} error={error}>
      <input
        id={id}
        type="date"
        className={textInputClassName}
        value={value ?? ''}
        min={config.minDate}
        max={config.maxDate}
        disabled={readOnly}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { hasError: Boolean(error) })}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      />
    </FieldShell>
  )
}

export const dateDefinition: FieldDefinition<'date'> = {
  type: 'date',
  displayName: 'Date',
  icon: <DateIcon />,
  isInput: true,

  defaultConfig: () => ({ prefillToday: false }),
  emptyValue: () => null,

  ConfigEditor: DateConfigEditor,
  FillRenderer: DateFillRenderer,

  validate: (field, value, ctx) => validateField(field, value, ctx),
  toPdfRows: (field, value) => [
    { label: field.label, value: typeof value === 'string' ? value : '' },
  ],

  conditionOperators: OPERATORS_BY_FIELD_TYPE.date,
  evaluateCondition: (operator, fieldValue, compareValue) =>
    evaluateOperator('date', operator, fieldValue, compareValue),
}
