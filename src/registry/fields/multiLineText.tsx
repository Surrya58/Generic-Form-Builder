import { useId } from 'react'
import { OPERATORS_BY_FIELD_TYPE, evaluateOperator, validateField } from '../../domain'
import { MultiLineTextIcon } from '../icons'
import type { ConfigEditorProps, FieldDefinition, FillRendererProps } from '../types'
import { ClampedIntInput } from './shared/ClampedIntInput'
import { ConfigField } from './shared/ConfigField'
import { FieldShell, describedBy } from './shared/FieldShell'
import { textInputClassName } from './shared/inputStyles'
import { parseOptionalInt, parseOptionalText } from './shared/parsing'

const MIN_ROWS = 2
const MAX_ROWS = 12

function MultiLineTextConfigEditor({ config, onChange }: ConfigEditorProps<'multiLineText'>) {
  const id = useId()
  return (
    <div className="flex flex-col gap-3">
      <ConfigField label="Placeholder" htmlFor={`${id}-placeholder`}>
        <input
          id={`${id}-placeholder`}
          type="text"
          className={textInputClassName}
          value={config.placeholder ?? ''}
          onChange={(event) =>
            onChange({ ...config, placeholder: parseOptionalText(event.target.value) })
          }
        />
      </ConfigField>
      <ConfigField label="Visible rows" htmlFor={`${id}-rows`}>
        <ClampedIntInput
          id={`${id}-rows`}
          min={MIN_ROWS}
          max={MAX_ROWS}
          className={textInputClassName}
          value={config.rows}
          onChange={(rows) => onChange({ ...config, rows })}
        />
      </ConfigField>
      <div className="grid grid-cols-2 gap-3">
        <ConfigField label="Min length" htmlFor={`${id}-min-length`}>
          <input
            id={`${id}-min-length`}
            type="number"
            min={0}
            className={textInputClassName}
            value={config.minLength ?? ''}
            onChange={(event) =>
              onChange({ ...config, minLength: parseOptionalInt(event.target.value) })
            }
          />
        </ConfigField>
        <ConfigField label="Max length" htmlFor={`${id}-max-length`}>
          <input
            id={`${id}-max-length`}
            type="number"
            min={0}
            className={textInputClassName}
            value={config.maxLength ?? ''}
            onChange={(event) =>
              onChange({ ...config, maxLength: parseOptionalInt(event.target.value) })
            }
          />
        </ConfigField>
      </div>
    </div>
  )
}

function MultiLineTextFillRenderer({
  config,
  value,
  onChange,
  label,
  required,
  error,
  readOnly,
}: FillRendererProps<'multiLineText'>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={required} hint={config.placeholder} error={error}>
      <textarea
        id={id}
        className={textInputClassName}
        rows={config.rows}
        placeholder={config.placeholder}
        value={value}
        disabled={readOnly}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, {
          hasHint: Boolean(config.placeholder),
          hasError: Boolean(error),
        })}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  )
}

export const multiLineTextDefinition: FieldDefinition<'multiLineText'> = {
  type: 'multiLineText',
  displayName: 'Multi-line text',
  icon: <MultiLineTextIcon />,
  isInput: true,

  defaultConfig: () => ({ rows: 3 }),
  emptyValue: () => '',

  ConfigEditor: MultiLineTextConfigEditor,
  FillRenderer: MultiLineTextFillRenderer,

  validate: (field, value, ctx) => validateField(field, value, ctx),
  toPdfRows: (field, value) => [
    { label: field.label, value: typeof value === 'string' ? value : '' },
  ],

  conditionOperators: OPERATORS_BY_FIELD_TYPE.multiLineText,
  evaluateCondition: (operator, fieldValue, compareValue) =>
    evaluateOperator('multiLineText', operator, fieldValue, compareValue),
}
