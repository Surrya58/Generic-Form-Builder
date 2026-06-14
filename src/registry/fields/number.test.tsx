import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { numberField } from '../../domain/testFixtures'
import type { FieldConfigMap } from '../../domain'
import { numberDefinition } from './number'

function Harness() {
  const field = numberField('f1', { label: 'Annual income' })
  const [config, setConfig] = useState<FieldConfigMap['number']>(field.config)
  const [value, setValue] = useState<number | null>(null)

  return (
    <div>
      <numberDefinition.ConfigEditor
        field={{ ...field, config }}
        allFields={[field]}
        config={config}
        onChange={setConfig}
      />
      <numberDefinition.FillRenderer
        config={config}
        value={value}
        onChange={setValue}
        label={field.label}
      />
      <output data-testid="value">{value ?? ''}</output>
    </div>
  )
}

describe('number field definition', () => {
  it('round-trips prefix, suffix and decimals from the config editor to the fill renderer', async () => {
    render(<Harness />)

    await userEvent.type(screen.getByLabelText('Prefix'), '$')
    await userEvent.type(screen.getByLabelText('Suffix'), 'USD')
    await userEvent.selectOptions(screen.getByLabelText('Decimal places'), '2')

    expect(screen.getByText('$')).toBeInTheDocument()
    expect(screen.getByText('USD')).toBeInTheDocument()
    expect(screen.getByLabelText('Annual income')).toHaveAttribute('step', '0.01')
  })

  it('shows a real label and parses typed numbers cleanly', async () => {
    render(<Harness />)

    const input = screen.getByLabelText('Annual income')
    await userEvent.type(input, '1234')

    expect(screen.getByTestId('value')).toHaveTextContent('1234')
  })

  it('enforces a configured minimum via the validation engine', () => {
    const field = numberField('f1', { label: 'Age', config: { decimals: 0, min: 18 } })
    const error = numberDefinition.validate(field, 5, {
      effectiveRequired: false,
      effectiveVisible: true,
    })
    expect(error?.code).toBe('min')
  })

  it('exposes its condition operators and delegates evaluation to the condition engine', () => {
    expect(numberDefinition.conditionOperators).toEqual(['equals', 'gt', 'lt', 'withinRange'])
    expect(numberDefinition.evaluateCondition('gt', 50, 10)).toBe(true)
  })

  it('produces a PDF row with its label and value', () => {
    const field = numberField('f1', { label: 'Annual income' })
    expect(numberDefinition.toPdfRows(field, 1234)).toEqual([
      { label: 'Annual income', value: '1234' },
    ])
    expect(numberDefinition.toPdfRows(field, null)).toEqual([{ label: 'Annual income', value: '' }])
  })
})
