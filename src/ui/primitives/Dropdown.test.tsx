import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dropdown } from './Dropdown'
import type { DropdownOption } from './Dropdown'

const OPTIONS: DropdownOption[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
]

function ControlledDropdown({
  initialValue = null,
  onChange,
}: {
  initialValue?: string | null
  onChange?: (value: string) => void
}) {
  const [value, setValue] = useState<string | null>(initialValue)
  return (
    <>
      <Dropdown
        options={OPTIONS}
        value={value}
        aria-labelledby="dropdown-label"
        onChange={(next) => {
          setValue(next)
          onChange?.(next)
        }}
      />
      <span id="dropdown-label">Pick one</span>
      <button type="button">Outside</button>
    </>
  )
}

describe('Dropdown', () => {
  it('shows the placeholder when no value is selected', () => {
    render(<Dropdown options={OPTIONS} value={null} onChange={() => {}} placeholder="Choose…" />)

    expect(screen.getByRole('combobox')).toHaveTextContent('Choose…')
  })

  it('shows the selected option label', () => {
    render(<Dropdown options={OPTIONS} value="b" onChange={() => {}} />)

    expect(screen.getByRole('combobox')).toHaveTextContent('Beta')
  })

  it('starts closed, with the listbox not rendered', () => {
    render(<Dropdown options={OPTIONS} value={null} onChange={() => {}} />)

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens the listbox on click, listing every option', async () => {
    render(<Dropdown options={OPTIONS} value={null} onChange={() => {}} />)

    await userEvent.click(screen.getByRole('combobox'))

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ])
  })

  it('selects an option on click and closes the listbox', async () => {
    const onChange = vi.fn()
    render(<ControlledDropdown onChange={onChange} />)

    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(screen.getByRole('option', { name: 'Beta' }))

    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.getByRole('combobox')).toHaveTextContent('Beta')
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false')
  })

  it('ArrowDown opens the list with the current value active', async () => {
    render(<ControlledDropdown initialValue="b" />)

    const combobox = screen.getByRole('combobox')
    combobox.focus()
    await userEvent.keyboard('{ArrowDown}')

    expect(combobox).toHaveAttribute('aria-expanded', 'true')
    const active = screen.getByRole('option', { name: 'Beta' })
    expect(combobox.getAttribute('aria-activedescendant')).toBe(active.id)
  })

  it('ArrowDown then Enter moves the active option and commits it', async () => {
    const onChange = vi.fn()
    render(<ControlledDropdown initialValue="a" onChange={onChange} />)

    const combobox = screen.getByRole('combobox')
    combobox.focus()
    await userEvent.keyboard('{ArrowDown}') // open, active = Alpha
    await userEvent.keyboard('{ArrowDown}') // active = Beta
    await userEvent.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith('b')
    expect(combobox).toHaveTextContent('Beta')
    expect(combobox).toHaveAttribute('aria-expanded', 'false')
  })

  it('Escape closes the list without changing the value', async () => {
    const onChange = vi.fn()
    render(<ControlledDropdown initialValue="a" onChange={onChange} />)

    const combobox = screen.getByRole('combobox')
    combobox.focus()
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{ArrowDown}') // active = Beta, value still Alpha
    await userEvent.keyboard('{Escape}')

    expect(combobox).toHaveAttribute('aria-expanded', 'false')
    expect(onChange).not.toHaveBeenCalled()
    expect(combobox).toHaveTextContent('Alpha')
  })

  it('Home and End jump the active option to the first and last when open', async () => {
    render(<ControlledDropdown initialValue="b" />)

    const combobox = screen.getByRole('combobox')
    combobox.focus()
    await userEvent.keyboard('{ArrowDown}') // open, active = Beta
    await userEvent.keyboard('{End}')
    expect(combobox.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Gamma' }).id,
    )

    await userEvent.keyboard('{Home}')
    expect(combobox.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Alpha' }).id,
    )
  })

  it('typeahead selects immediately when closed, like a native select', async () => {
    const onChange = vi.fn()
    render(<ControlledDropdown onChange={onChange} />)

    const combobox = screen.getByRole('combobox')
    combobox.focus()
    await userEvent.keyboard('g')

    expect(onChange).toHaveBeenCalledWith('c')
    expect(combobox).toHaveAttribute('aria-expanded', 'false')
    expect(combobox).toHaveTextContent('Gamma')
  })

  it('typeahead moves the active option without committing when open', async () => {
    const onChange = vi.fn()
    render(<ControlledDropdown initialValue="a" onChange={onChange} />)

    const combobox = screen.getByRole('combobox')
    combobox.focus()
    await userEvent.keyboard('{ArrowDown}') // open
    await userEvent.keyboard('g')

    expect(onChange).not.toHaveBeenCalled()
    expect(combobox.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Gamma' }).id,
    )
  })

  it('closes when clicking outside without changing the value', async () => {
    const onChange = vi.fn()
    render(<ControlledDropdown onChange={onChange} />)

    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Outside' }))

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not respond when disabled', () => {
    render(<Dropdown options={OPTIONS} value={null} onChange={() => {}} disabled />)

    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
