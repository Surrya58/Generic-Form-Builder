import { useId } from 'react'
import { OPERATORS_BY_FIELD_TYPE, evaluateOperator, validateField } from '../../domain'
import { SingleSelectIcon } from '../icons'
import type { ConfigEditorProps, FieldDefinition, FillRendererProps } from '../types'
import { Dropdown } from '../../ui/primitives/Dropdown'
import { RovingOptionGroup } from '../../ui/primitives/RovingOptionGroup'
import { ConfigField } from './shared/ConfigField'
import { FieldShell, describedBy } from './shared/FieldShell'
import { textInputClassName } from './shared/inputStyles'
import { OptionListEditor } from './shared/OptionListEditor'

const DISPLAY_MODES = ['radio', 'dropdown', 'tiles'] as const

function isDisplayMode(value: string): value is (typeof DISPLAY_MODES)[number] {
  return (DISPLAY_MODES as readonly string[]).includes(value)
}

const DISPLAY_LABELS: Record<(typeof DISPLAY_MODES)[number], string> = {
  radio: 'Radio buttons',
  dropdown: 'Dropdown',
  tiles: 'Tiles',
}

function SingleSelectConfigEditor({ config, onChange }: ConfigEditorProps<'singleSelect'>) {
  const id = useId()
  return (
    <div className="flex flex-col gap-3">
      <ConfigField label="Display as" htmlFor={`${id}-display`}>
        <select
          id={`${id}-display`}
          className={textInputClassName}
          value={config.display}
          onChange={(event) => {
            const display = event.target.value
            if (isDisplayMode(display)) onChange({ ...config, display })
          }}
        >
          {DISPLAY_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {DISPLAY_LABELS[mode]}
            </option>
          ))}
        </select>
      </ConfigField>
      <ConfigField label="Options" htmlFor={`${id}-options`}>
        <OptionListEditor
          options={config.options}
          onChange={(options) => onChange({ ...config, options })}
        />
      </ConfigField>
    </div>
  )
}

function SingleSelectFillRenderer({
  config,
  value,
  onChange,
  label,
  required,
  error,
  readOnly,
}: FillRendererProps<'singleSelect'>) {
  const id = useId()
  const groupProps = {
    'aria-labelledby': id,
    'aria-describedby': describedBy(id, { hasError: Boolean(error) }),
    'aria-required': required,
    'aria-invalid': error ? true : undefined,
  }

  return (
    <FieldShell id={id} label={label} required={required} error={error} labelAs="span">
      {config.display === 'dropdown' ? (
        <Dropdown
          options={config.options}
          value={value}
          onChange={onChange}
          disabled={readOnly}
          placeholder="Select an option"
          {...groupProps}
        />
      ) : (
        <RovingOptionGroup
          options={config.options}
          value={value}
          onChange={onChange}
          variant={config.display}
          disabled={readOnly}
          {...groupProps}
        />
      )}
    </FieldShell>
  )
}

export const singleSelectDefinition: FieldDefinition<'singleSelect'> = {
  type: 'singleSelect',
  displayName: 'Single select',
  icon: <SingleSelectIcon />,
  isInput: true,

  defaultConfig: () => ({
    options: [
      { id: crypto.randomUUID(), label: 'Option 1' },
      { id: crypto.randomUUID(), label: 'Option 2' },
    ],
    display: 'radio',
  }),
  emptyValue: () => null,

  ConfigEditor: SingleSelectConfigEditor,
  FillRenderer: SingleSelectFillRenderer,

  validate: (field, value, ctx) => validateField(field, value, ctx),
  toPdfRows: (field, value) => [
    {
      label: field.label,
      value: field.config.options.find((option) => option.id === value)?.label ?? '',
    },
  ],

  conditionOperators: OPERATORS_BY_FIELD_TYPE.singleSelect,
  evaluateCondition: (operator, fieldValue, compareValue) =>
    evaluateOperator('singleSelect', operator, fieldValue, compareValue),
}
