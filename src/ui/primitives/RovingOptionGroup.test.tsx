import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RovingOptionGroup } from './RovingOptionGroup'
import type { RovingOptionGroupOption } from './RovingOptionGroup'

const OPTIONS: RovingOptionGroupOption[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
]

function ControlledGroup({
  initialValue = null,
  variant,
  onChange,
}: {
  initialValue?: string | null
  variant?: 'radio' | 'tiles'
  onChange?: (value: string) => void
}) {
  const [value, setValue] = useState<string | null>(initialValue)
  return (
    <RovingOptionGroup
      options={OPTIONS}
      value={value}
      variant={variant}
      aria-label="Pick one"
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

describe('RovingOptionGroup', () => {
  it('renders a radiogroup containing one radio per option', () => {
    render(<ControlledGroup />)

    const group = screen.getByRole('radiogroup', { name: 'Pick one' })
    const radios = screen.getAllByRole('radio')
    expect(group).toBeInTheDocument()
    expect(radios).toHaveLength(3)
    expect(radios.map((radio) => radio.textContent)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('marks the selected option as checked', () => {
    render(<ControlledGroup initialValue="b" />)

    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onChange and updates checked state when an option is clicked', async () => {
    const onChange = vi.fn()
    render(<ControlledGroup onChange={onChange} />)

    await userEvent.click(screen.getByRole('radio', { name: 'Gamma' }))

    expect(onChange).toHaveBeenCalledWith('c')
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveAttribute('aria-checked', 'true')
  })

  it('uses a roving tabindex: only the selected option is tabbable, defaulting to the first', () => {
    render(<ControlledGroup initialValue="b" />)

    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveAttribute('tabindex', '-1')
  })

  it('defaults the tab stop to the first option when nothing is selected', () => {
    render(<ControlledGroup />)

    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('tabindex', '0')
  })

  it('ArrowRight/ArrowDown move to the next option, wrapping at the end, and select it', async () => {
    render(<ControlledGroup initialValue="a" />)

    screen.getByRole('radio', { name: 'Alpha' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true')

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true')
  })

  it('ArrowLeft/ArrowUp move to the previous option, wrapping at the start', async () => {
    render(<ControlledGroup initialValue="a" />)

    screen.getByRole('radio', { name: 'Alpha' }).focus()
    await userEvent.keyboard('{ArrowLeft}')

    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveAttribute('aria-checked', 'true')
  })

  it('Home and End jump to the first and last options', async () => {
    render(<ControlledGroup initialValue="b" />)

    screen.getByRole('radio', { name: 'Beta' }).focus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveAttribute('aria-checked', 'true')

    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true')
  })

  it('disables every option and ignores activation when disabled', () => {
    render(
      <RovingOptionGroup
        options={OPTIONS}
        value="a"
        onChange={() => {}}
        disabled
        aria-label="Pick one"
      />,
    )

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled()
    }
  })

  it('the tiles variant has identical selection and keyboard semantics to radio', async () => {
    render(<ControlledGroup variant="tiles" initialValue="a" />)

    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)

    screen.getByRole('radio', { name: 'Alpha' }).focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true')
  })
})
