import { useId } from 'react'
import { OPERATORS_BY_FIELD_TYPE, evaluateOperator, validateField } from '../../domain'
import { SingleLineTextIcon } from '../icons'
import type { ConfigEditorProps, FieldDefinition, FillRendererProps } from '../types'
import { ConfigField } from './shared/ConfigField'
import { FieldShell, describedBy } from './shared/FieldShell'
import {
  affixClassName,
  bareInputClassName,
  inputGroupClassName,
  textInputClassName,
} from './shared/inputStyles'
import { parseOptionalInt, parseOptionalText } from './shared/parsing'

function SingleLineTextConfigEditor({ config, onChange }: ConfigEditorProps<'singleLineText'>) {
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

function SingleLineTextFillRenderer({
  config,
  value,
  onChange,
  label,
  required,
  error,
  readOnly,
}: FillRendererProps<'singleLineText'>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={required} hint={config.placeholder} error={error}>
      <div className={inputGroupClassName}>
        {config.prefix && <span className={affixClassName}>{config.prefix}</span>}
        <input
          id={id}
          type="text"
          className={bareInputClassName}
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
        {config.suffix && <span className={affixClassName}>{config.suffix}</span>}
      </div>
    </FieldShell>
  )
}

export const singleLineTextDefinition: FieldDefinition<'singleLineText'> = {
  type: 'singleLineText',
  displayName: 'Single line text',
  icon: <SingleLineTextIcon />,
  isInput: true,

  defaultConfig: () => ({}),
  emptyValue: () => '',

  ConfigEditor: SingleLineTextConfigEditor,
  FillRenderer: SingleLineTextFillRenderer,

  validate: (field, value, ctx) => validateField(field, value, ctx),
  toPdfRows: (field, value) => [
    { label: field.label, value: typeof value === 'string' ? value : '' },
  ],

  conditionOperators: OPERATORS_BY_FIELD_TYPE.singleLineText,
  evaluateCondition: (operator, fieldValue, compareValue) =>
    evaluateOperator('singleLineText', operator, fieldValue, compareValue),
}
