import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { singleLineTextField } from '../../domain/testFixtures'
import type { FieldConfigMap } from '../../domain'
import { singleLineTextDefinition } from './singleLineText'

function Harness() {
  const field = singleLineTextField('f1', { label: 'Full name' })
  const [config, setConfig] = useState<FieldConfigMap['singleLineText']>(field.config)
  const [value, setValue] = useState('')

  return (
    <div>
      <singleLineTextDefinition.ConfigEditor
        field={{ ...field, config }}
        allFields={[field]}
        config={config}
        onChange={setConfig}
      />
      <singleLineTextDefinition.FillRenderer
        config={config}
        value={value}
        onChange={setValue}
        label={field.label}
      />
      <output data-testid="value">{value}</output>
    </div>
  )
}

describe('singleLineText field definition', () => {
  it('round-trips placeholder, prefix and suffix from the config editor to the fill renderer', async () => {
    render(<Harness />)

    await userEvent.type(screen.getByLabelText('Placeholder'), 'Jane Doe')
    await userEvent.type(screen.getByLabelText('Prefix'), '$')
    await userEvent.type(screen.getByLabelText('Suffix'), 'USD')

    expect(screen.getByLabelText('Full name')).toHaveAttribute('placeholder', 'Jane Doe')
    expect(screen.getByText('$')).toBeInTheDocument()
    expect(screen.getByText('USD')).toBeInTheDocument()
  })

  it('shows a real label (not just a placeholder) and lets the user type a value', async () => {
    render(<Harness />)

    const input = screen.getByLabelText('Full name')
    await userEvent.type(input, 'hello')

    expect(screen.getByTestId('value')).toHaveTextContent('hello')
  })

  it('enforces minLength via the validation engine', () => {
    const field = singleLineTextField('f1', { label: 'Bio', config: { minLength: 5 } })
    const error = singleLineTextDefinition.validate(field, 'hi', {
      effectiveRequired: false,
      effectiveVisible: true,
    })
    expect(error?.code).toBe('minLength')
  })

  it('exposes its condition operators and delegates evaluation to the condition engine', () => {
    expect(singleLineTextDefinition.conditionOperators).toEqual(['equals', 'notEquals', 'contains'])
    expect(singleLineTextDefinition.evaluateCondition('contains', 'hello world', 'world')).toBe(
      true,
    )
  })

  it('produces a PDF row with its label and value', () => {
    const field = singleLineTextField('f1', { label: 'Full name' })
    expect(singleLineTextDefinition.toPdfRows(field, 'Jane Doe')).toEqual([
      { label: 'Full name', value: 'Jane Doe' },
    ])
  })
})
