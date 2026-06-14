import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calculationField, numberField, singleLineTextField } from '../../domain/testFixtures'
import type { FieldConfigMap } from '../../domain'
import { calculationDefinition } from './calculation'

function Harness() {
  const income = numberField('income', { label: 'Income' })
  const bonus = numberField('bonus', { label: 'Bonus' })
  const name = singleLineTextField('name', { label: 'Name' })
  const otherTotal = calculationField('other-total', { label: 'Other total' })
  const field = calculationField('total', { label: 'Total' })
  const allFields = [income, bonus, name, otherTotal, field]

  const [config, setConfig] = useState<FieldConfigMap['calculation']>(field.config)

  return (
    <div>
      <calculationDefinition.ConfigEditor
        field={{ ...field, config }}
        allFields={allFields}
        config={config}
        onChange={setConfig}
      />
      <calculationDefinition.FillRenderer
        config={config}
        value={1234.5}
        onChange={() => undefined}
        label={field.label}
      />
      <output data-testid="config">{JSON.stringify(config)}</output>
    </div>
  )
}

describe('calculation field definition', () => {
  it('renders its value read-only, formatted to the configured decimals', async () => {
    render(<Harness />)

    expect(screen.getByText('1235')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Decimal places'))
    await userEvent.type(screen.getByLabelText('Decimal places'), '2')
    await userEvent.tab()

    expect(screen.getByText('1234.50')).toBeInTheDocument()
  })

  it('shows an em dash when the calculation has no value yet', () => {
    const field = calculationField('total', { label: 'Total' })
    render(
      <calculationDefinition.FillRenderer
        config={field.config}
        value={null}
        onChange={() => undefined}
        label="Total"
      />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('only offers number fields as selectable sources', () => {
    render(<Harness />)

    expect(screen.getByRole('checkbox', { name: 'Income' })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: 'Bonus' })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: 'Name' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Other total' })).toBeDisabled()
    expect(
      screen.getByText('Only number fields can be used as calculation sources.'),
    ).toBeInTheDocument()
    expect(screen.getByText("Calculations can't use other calculations.")).toBeInTheDocument()
  })

  it('adds and removes sources as removable chips', async () => {
    render(<Harness />)

    function sourceFieldIds(): unknown {
      const config = JSON.parse(
        screen.getByTestId('config').textContent ?? '{}',
      ) as FieldConfigMap['calculation']
      return config.sourceFieldIds
    }

    await userEvent.click(screen.getByRole('checkbox', { name: 'Income' }))
    expect(sourceFieldIds()).toEqual(['income'])

    await userEvent.click(screen.getByRole('button', { name: 'Remove source Income' }))
    expect(sourceFieldIds()).toEqual([])
  })

  it('flags an orphaned source whose field no longer exists or is no longer a number field', () => {
    const field = calculationField('total', {
      label: 'Total',
      config: { sourceFieldIds: ['gone'] },
    })
    render(
      <calculationDefinition.ConfigEditor
        field={field}
        allFields={[field]}
        config={field.config}
        onChange={() => undefined}
      />,
    )
    expect(screen.getByText(/no longer exist as number fields/)).toBeInTheDocument()
    expect(screen.getByText(/Deleted field/)).toBeInTheDocument()
  })

  it('has no condition operators and never matches a condition', () => {
    expect(calculationDefinition.conditionOperators).toEqual([])
    expect(calculationDefinition.evaluateCondition('equals', 5, 5)).toBe(false)
  })

  it('produces a PDF row with the formatted value', () => {
    const field = calculationField('total', { label: 'Total', config: { decimals: 2 } })
    expect(calculationDefinition.toPdfRows(field, 12.5)).toEqual([
      { label: 'Total', value: '12.50' },
    ])
    expect(calculationDefinition.toPdfRows(field, null)).toEqual([{ label: 'Total', value: '' }])
  })
})
