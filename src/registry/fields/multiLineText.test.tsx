import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { multiLineTextField } from '../../domain/testFixtures'
import type { FieldConfigMap } from '../../domain'
import { multiLineTextDefinition } from './multiLineText'

function Harness() {
  const field = multiLineTextField('f1', { label: 'Comments' })
  const [config, setConfig] = useState<FieldConfigMap['multiLineText']>(field.config)
  const [value, setValue] = useState('')

  return (
    <div>
      <multiLineTextDefinition.ConfigEditor
        field={{ ...field, config }}
        allFields={[field]}
        config={config}
        onChange={setConfig}
      />
      <multiLineTextDefinition.FillRenderer
        config={config}
        value={value}
        onChange={setValue}
        label={field.label}
      />
      <output data-testid="value">{value}</output>
    </div>
  )
}

describe('multiLineText field definition', () => {
  it('round-trips placeholder and visible rows from the config editor to the fill renderer', async () => {
    render(<Harness />)

    await userEvent.type(screen.getByLabelText('Placeholder'), 'Tell us more')
    const rowsInput = screen.getByLabelText('Visible rows')
    await userEvent.clear(rowsInput)
    await userEvent.type(rowsInput, '5')
    await userEvent.tab()

    const textarea = screen.getByLabelText('Comments')
    expect(textarea).toHaveAttribute('placeholder', 'Tell us more')
    expect(textarea).toHaveAttribute('rows', '5')
  })

  it('shows a real label and lets the user type a value', async () => {
    render(<Harness />)

    const textarea = screen.getByLabelText('Comments')
    await userEvent.type(textarea, 'hello world')

    expect(screen.getByTestId('value')).toHaveTextContent('hello world')
  })

  it('enforces maxLength via the validation engine', () => {
    const field = multiLineTextField('f1', { label: 'Bio', config: { rows: 3, maxLength: 5 } })
    const error = multiLineTextDefinition.validate(field, 'this is too long', {
      effectiveRequired: false,
      effectiveVisible: true,
    })
    expect(error?.code).toBe('maxLength')
  })

  it('exposes its condition operators and delegates evaluation to the condition engine', () => {
    expect(multiLineTextDefinition.conditionOperators).toEqual(['equals', 'notEquals', 'contains'])
    expect(multiLineTextDefinition.evaluateCondition('contains', 'hello world', 'world')).toBe(true)
  })

  it('produces a PDF row with its label and value', () => {
    const field = multiLineTextField('f1', { label: 'Comments' })
    expect(multiLineTextDefinition.toPdfRows(field, 'hello world')).toEqual([
      { label: 'Comments', value: 'hello world' },
    ])
  })
})
