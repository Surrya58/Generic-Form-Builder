import { useId, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { singleLineTextField } from '../domain/testFixtures'
import type { FieldConfigMap } from '../domain'
import { OPERATORS_BY_FIELD_TYPE, evaluateOperator, validateField } from '../domain'
import { SingleLineTextIcon } from './icons'
import { paletteEntries } from './index'
import type {
  AnyFieldDefinition,
  ConfigEditorProps,
  FieldDefinition,
  FillRendererProps,
} from './types'
import { FieldShell, describedBy } from './fields/shared/FieldShell'
import { textInputClassName } from './fields/shared/inputStyles'
import { ConfigField } from './fields/shared/ConfigField'

/**
 * A throwaway "Phone number" definition, built the same way a real plugin
 * would be: a `FieldDefinition` object assembled entirely from already-exported
 * registry/domain pieces (icons, shared input primitives, `validateField`,
 * `OPERATORS_BY_FIELD_TYPE`, `evaluateOperator`). It reuses the
 * `singleLineText` field type's config/value shapes — so it slots into the
 * existing engines without any change to `src/domain` — but ships its own
 * displayName, icon, defaultConfig and FillRenderer.
 *
 * Nothing in `src/registry/index.ts` or `src/domain` is edited to define
 * this; it is appended to `paletteEntries` locally, in this test file only.
 */
function PhoneConfigEditor({ config, onChange }: ConfigEditorProps<'singleLineText'>) {
  const id = useId()
  return (
    <ConfigField label="Placeholder" htmlFor={`${id}-placeholder`}>
      <input
        id={`${id}-placeholder`}
        type="text"
        className={textInputClassName}
        value={config.placeholder ?? ''}
        onChange={(event) => onChange({ ...config, placeholder: event.target.value })}
      />
    </ConfigField>
  )
}

function PhoneFillRenderer({
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
      <input
        id={id}
        type="tel"
        className={textInputClassName}
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

const phoneDefinition: FieldDefinition<'singleLineText'> = {
  type: 'singleLineText',
  displayName: 'Phone number',
  icon: <SingleLineTextIcon />,
  isInput: true,

  defaultConfig: () => ({ placeholder: '(555) 123-4567' }),
  emptyValue: () => '',

  ConfigEditor: PhoneConfigEditor,
  FillRenderer: PhoneFillRenderer,

  validate: (field, value, ctx) => validateField(field, value, ctx),
  toPdfRows: (field, value) => [
    { label: field.label, value: typeof value === 'string' ? value : '' },
  ],

  conditionOperators: OPERATORS_BY_FIELD_TYPE.singleLineText,
  evaluateCondition: (operator, fieldValue, compareValue) =>
    evaluateOperator('singleLineText', operator, fieldValue, compareValue),
}

/**
 * Stands in for the real Builder palette: a presentational list that knows
 * nothing about specific field types, only the `FieldDefinition` shape.
 */
function PaletteList({ entries }: { entries: AnyFieldDefinition[] }) {
  return (
    <ul>
      {entries.map((entry) => (
        <li key={entry.displayName}>
          <span aria-hidden="true">{entry.icon}</span>
          {entry.displayName}
        </li>
      ))}
    </ul>
  )
}

function PhoneHarness() {
  const field = singleLineTextField('f1', { label: 'Mobile number' })
  const [config, setConfig] = useState<FieldConfigMap['singleLineText']>(field.config)
  const [value, setValue] = useState('')

  return (
    <div>
      <phoneDefinition.ConfigEditor
        field={{ ...field, config }}
        allFields={[field]}
        config={config}
        onChange={setConfig}
      />
      <phoneDefinition.FillRenderer
        config={config}
        value={value}
        onChange={setValue}
        label={field.label}
      />
      <output data-testid="value">{value}</output>
    </div>
  )
}

describe('registry extensibility', () => {
  it('a new definition appears in the palette alongside the built-in 9, with zero edits to existing files', () => {
    render(<PaletteList entries={[...paletteEntries, phoneDefinition]} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(paletteEntries.length + 1)
    expect(screen.getByText('Phone number')).toBeInTheDocument()
  })

  it('gets a working config editor and fill renderer', async () => {
    render(<PhoneHarness />)

    await userEvent.type(screen.getByLabelText('Placeholder'), '(02) 1234 5678')
    expect(screen.getByLabelText('Mobile number')).toHaveAttribute('placeholder', '(02) 1234 5678')
    expect(screen.getByLabelText('Mobile number')).toHaveAttribute('type', 'tel')

    await userEvent.type(screen.getByLabelText('Mobile number'), '0211234567')
    expect(screen.getByTestId('value')).toHaveTextContent('0211234567')
  })

  it('exposes condition operators delegating to the condition engine', () => {
    expect(phoneDefinition.conditionOperators).toEqual(['equals', 'notEquals', 'contains'])
    expect(phoneDefinition.evaluateCondition('contains', '0211234567', '1234')).toBe(true)
  })
})
