import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { singleSelectField } from '../../domain/testFixtures'
import type { FieldConfigMap } from '../../domain'
import { singleSelectDefinition } from './singleSelect'

const OPTIONS = [
  { id: 'a', label: 'Red' },
  { id: 'b', label: 'Green' },
  { id: 'c', label: 'Blue' },
]

function Harness({ display }: { display: 'radio' | 'dropdown' | 'tiles' }) {
  const field = singleSelectField('f1', {
    label: 'Favorite color',
    config: { options: OPTIONS, display },
  })
  const [config, setConfig] = useState<FieldConfigMap['singleSelect']>(field.config)
  const [value, setValue] = useState<string | null>(null)

  return (
    <div>
      <singleSelectDefinition.ConfigEditor
        field={{ ...field, config }}
        allFields={[field]}
        config={config}
        onChange={setConfig}
      />
      <singleSelectDefinition.FillRenderer
        config={config}
        value={value}
        onChange={setValue}
        label={field.label}
      />
      <output data-testid="value">{value ?? ''}</output>
    </div>
  )
}

describe('singleSelect field definition', () => {
  it('renders a labelled radiogroup with the configured options', () => {
    render(<Harness display="radio" />)
    const group = screen.getByRole('radiogroup', { name: 'Favorite color' })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('selects via radio buttons with arrow-key navigation', async () => {
    render(<Harness display="radio" />)

    const first = screen.getByRole('radio', { name: 'Red' })
    first.focus()
    await userEvent.keyboard('{ArrowDown}')

    expect(screen.getByTestId('value')).toHaveTextContent('b')
    expect(screen.getByRole('radio', { name: 'Green' })).toHaveAttribute('aria-checked', 'true')
  })

  it('renders tiles with the same selection semantics', async () => {
    render(<Harness display="tiles" />)

    await userEvent.click(screen.getByRole('radio', { name: 'Blue' }))

    expect(screen.getByTestId('value')).toHaveTextContent('c')
  })

  it('renders a combobox/listbox for dropdown display', async () => {
    render(<Harness display="dropdown" />)

    const combobox = screen.getByRole('combobox', { name: 'Favorite color' })
    await userEvent.click(combobox)
    await userEvent.click(screen.getByRole('option', { name: 'Green' }))

    expect(screen.getByTestId('value')).toHaveTextContent('b')
  })

  it('lets the user add, edit and remove options from the config editor', async () => {
    render(<Harness display="radio" />)

    await userEvent.click(screen.getByRole('button', { name: '+ Add option' }))
    expect(screen.getAllByRole('radio')).toHaveLength(4)

    await userEvent.click(screen.getByRole('button', { name: 'Remove option 1' }))
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.queryByRole('radio', { name: 'Red' })).not.toBeInTheDocument()
  })

  it('exposes its condition operators and delegates evaluation to the condition engine', () => {
    expect(singleSelectDefinition.conditionOperators).toEqual(['equals', 'notEquals'])
    expect(singleSelectDefinition.evaluateCondition('equals', 'a', 'a')).toBe(true)
  })

  it('produces a PDF row with the selected option label', () => {
    const field = singleSelectField('f1', {
      label: 'Favorite color',
      config: { options: OPTIONS, display: 'radio' },
    })
    expect(singleSelectDefinition.toPdfRows(field, 'b')).toEqual([
      { label: 'Favorite color', value: 'Green' },
    ])
    expect(singleSelectDefinition.toPdfRows(field, null)).toEqual([
      { label: 'Favorite color', value: '' },
    ])
  })
})
