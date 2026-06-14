import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { dateField } from '../../domain/testFixtures'
import type { FieldConfigMap } from '../../domain'
import { dateDefinition } from './date'

function Harness() {
  const field = dateField('f1', { label: 'Start date' })
  const [config, setConfig] = useState<FieldConfigMap['date']>(field.config)
  const [value, setValue] = useState<string | null>(null)

  return (
    <div>
      <dateDefinition.ConfigEditor
        field={{ ...field, config }}
        allFields={[field]}
        config={config}
        onChange={setConfig}
      />
      <dateDefinition.FillRenderer
        config={config}
        value={value}
        onChange={setValue}
        label={field.label}
      />
      <output data-testid="value">{value ?? ''}</output>
    </div>
  )
}

describe('date field definition', () => {
  it('round-trips min/max date bounds from the config editor to the fill renderer', async () => {
    render(<Harness />)

    await userEvent.type(screen.getByLabelText('Earliest date'), '2024-01-01')
    await userEvent.type(screen.getByLabelText('Latest date'), '2024-12-31')

    const input = screen.getByLabelText('Start date')
    expect(input).toHaveAttribute('min', '2024-01-01')
    expect(input).toHaveAttribute('max', '2024-12-31')
  })

  it('shows a real label and lets the user pick a date', async () => {
    render(<Harness />)

    const input = screen.getByLabelText('Start date')
    await userEvent.type(input, '2024-06-15')

    expect(screen.getByTestId('value')).toHaveTextContent('2024-06-15')
  })

  it('enforces required via the validation engine', () => {
    const field = dateField('f1', { label: 'Start date', defaultRequired: true })
    const error = dateDefinition.validate(field, null, {
      effectiveRequired: true,
      effectiveVisible: true,
    })
    expect(error?.code).toBe('required')
  })

  it('exposes its condition operators and delegates evaluation to the condition engine', () => {
    expect(dateDefinition.conditionOperators).toEqual(['equals', 'isBefore', 'isAfter'])
    expect(dateDefinition.evaluateCondition('isBefore', '2024-01-01', '2024-06-01')).toBe(true)
  })

  it('produces a PDF row with its label and value', () => {
    const field = dateField('f1', { label: 'Start date' })
    expect(dateDefinition.toPdfRows(field, '2024-06-15')).toEqual([
      { label: 'Start date', value: '2024-06-15' },
    ])
    expect(dateDefinition.toPdfRows(field, null)).toEqual([{ label: 'Start date', value: '' }])
  })
})
