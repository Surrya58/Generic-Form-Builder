import { useId } from 'react'
import {
  OPERATORS_BY_FIELD_TYPE,
  evaluateOperator,
  parseNumberInput,
  validateField,
} from '../../domain'
import { NumberIcon } from '../icons'
import type { ConfigEditorProps, FieldDefinition, FillRendererProps } from '../types'
import { ConfigField } from './shared/ConfigField'
import { FieldShell, describedBy } from './shared/FieldShell'
import {
  affixClassName,
  bareInputClassName,
  inputGroupClassName,
  textInputClassName,
} from './shared/inputStyles'
import { parseOptionalFloat, parseOptionalText } from './shared/parsing'

const DECIMAL_OPTIONS = [0, 1, 2, 3, 4] as const

function isDecimalCount(value: number): value is 0 | 1 | 2 | 3 | 4 {
  return DECIMAL_OPTIONS.includes(value as (typeof DECIMAL_OPTIONS)[number])
}

function NumberConfigEditor({ config, onChange }: ConfigEditorProps<'number'>) {
  const id = useId()
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <ConfigField label="Minimum" htmlFor={`${id}-min`}>
          <input
            id={`${id}-min`}
            type="number"
            className={textInputClassName}
            value={config.min ?? ''}
            onChange={(event) =>
              onChange({ ...config, min: parseOptionalFloat(event.target.value) })
            }
          />
        </ConfigField>
        <ConfigField label="Maximum" htmlFor={`${id}-max`}>
          <input
            id={`${id}-max`}
            type="number"
            className={textInputClassName}
            value={config.max ?? ''}
            onChange={(event) =>
              onChange({ ...config, max: parseOptionalFloat(event.target.value) })
            }
          />
        </ConfigField>
      </div>
      <ConfigField label="Decimal places" htmlFor={`${id}-decimals`}>
        <select
          id={`${id}-decimals`}
          className={textInputClassName}
          value={config.decimals}
          onChange={(event) => {
            const decimals = Number(event.target.value)
            if (isDecimalCount(decimals)) onChange({ ...config, decimals })
          }}
        >
          {DECIMAL_OPTIONS.map((decimals) => (
            <option key={decimals} value={decimals}>
              {decimals}
            </option>
          ))}
        </select>
      </ConfigField>
      <div className="grid grid-cols-2 gap-3">
        <ConfigField label="Prefix" htmlFor={`${id}-prefix`}>
          <input
            id={`${id}-prefix`}
            type="text"
            className={textInputClassName}
            value={config.prefix ?? ''}
            onChange={(event) =>
              onChange({ ...config, prefix: parseOptionalText(event.target.value) })
            }
          />
        </ConfigField>
        <ConfigField label="Suffix" htmlFor={`${id}-suffix`}>
          <input
            id={`${id}-suffix`}
            type="text"
            className={textInputClassName}
            value={config.suffix ?? ''}
            onChange={(event) =>
              onChange({ ...config, suffix: parseOptionalText(event.target.value) })
            }
          />
        </ConfigField>
      </div>
    </div>
  )
}

function NumberFillRenderer({
  config,
  value,
  onChange,
  label,
  required,
  error,
  readOnly,
}: FillRendererProps<'number'>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={required} error={error}>
      <div className={inputGroupClassName}>
        {config.prefix && <span className={affixClassName}>{config.prefix}</span>}
        <input
          id={id}
          type="number"
          className={bareInputClassName}
          value={value ?? ''}
          min={config.min}
          max={config.max}
          step={10 ** -config.decimals}
          disabled={readOnly}
          aria-required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, { hasError: Boolean(error) })}
          onChange={(event) => onChange(parseNumberInput(event.target.value))}
        />
        {config.suffix && <span className={affixClassName}>{config.suffix}</span>}
      </div>
    </FieldShell>
  )
}

export const numberDefinition: FieldDefinition<'number'> = {
  type: 'number',
  displayName: 'Number',
  icon: <NumberIcon />,
  isInput: true,

  defaultConfig: () => ({ decimals: 0 }),
  emptyValue: () => null,

  ConfigEditor: NumberConfigEditor,
  FillRenderer: NumberFillRenderer,

  validate: (field, value, ctx) => validateField(field, value, ctx),
  toPdfRows: (field, value) => [
    {
      label: field.label,
      value: typeof value === 'number' && Number.isFinite(value) ? String(value) : '',
    },
  ],

  conditionOperators: OPERATORS_BY_FIELD_TYPE.number,
  evaluateCondition: (operator, fieldValue, compareValue) =>
    evaluateOperator('number', operator, fieldValue, compareValue),
}
