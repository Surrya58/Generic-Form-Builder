import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { multiSelectField } from '../../domain/testFixtures'
import type { FieldConfigMap } from '../../domain'
import { multiSelectDefinition } from './multiSelect'

const OPTIONS = [
  { id: 'a', label: 'Email' },
  { id: 'b', label: 'Phone' },
  { id: 'c', label: 'Mail' },
]

function Harness() {
  const field = multiSelectField('f1', { label: 'Contact methods', config: { options: OPTIONS } })
  const [config, setConfig] = useState<FieldConfigMap['multiSelect']>(field.config)
  const [value, setValue] = useState<string[]>([])

  return (
    <div>
      <multiSelectDefinition.ConfigEditor
        field={{ ...field, config }}
        allFields={[field]}
        config={config}
        onChange={setConfig}
      />
      <multiSelectDefinition.FillRenderer
        config={config}
        value={value}
        onChange={setValue}
        label={field.label}
      />
      <output data-testid="value">{value.join(',')}</output>
    </div>
  )
}

describe('multiSelect field definition', () => {
  it('renders a labelled group with a checkbox per option', () => {
    render(<Harness />)
    expect(screen.getByRole('group', { name: 'Contact methods' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  })

  it('lets the user select multiple options independently', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByRole('checkbox', { name: 'Email' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mail' }))

    expect(screen.getByTestId('value')).toHaveTextContent('a,c')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Email' }))
    expect(screen.getByTestId('value')).toHaveTextContent('c')
  })

  it('lets the user configure min/max selections and edit options', async () => {
    render(<Harness />)

    await userEvent.type(screen.getByLabelText('Minimum selections'), '1')
    await userEvent.type(screen.getByLabelText('Maximum selections'), '2')

    await userEvent.click(screen.getByRole('button', { name: '+ Add option' }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
  })

  it('enforces minSelections via the validation engine', () => {
    const field = multiSelectField('f1', {
      label: 'Contact methods',
      config: { options: OPTIONS, minSelections: 2 },
    })
    const error = multiSelectDefinition.validate(field, ['a'], {
      effectiveRequired: false,
      effectiveVisible: true,
    })
    expect(error?.code).toBe('minSelections')
  })

  it('exposes its condition operators and delegates evaluation to the condition engine', () => {
    expect(multiSelectDefinition.conditionOperators).toEqual([
      'containsAny',
      'containsAll',
      'containsNone',
    ])
    expect(multiSelectDefinition.evaluateCondition('containsAny', ['a', 'b'], ['b'])).toBe(true)
  })

  it('produces a PDF row joining the selected option labels', () => {
    const field = multiSelectField('f1', { label: 'Contact methods', config: { options: OPTIONS } })
    expect(multiSelectDefinition.toPdfRows(field, ['a', 'c'])).toEqual([
      { label: 'Contact methods', value: 'Email, Mail' },
    ])
    expect(multiSelectDefinition.toPdfRows(field, [])).toEqual([
      { label: 'Contact methods', value: '' },
    ])
  })
})
