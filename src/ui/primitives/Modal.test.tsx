import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
          onClose?.()
        }}
        title="Example dialog"
      >
        <p>Dialog body</p>
        <button type="button">First</button>
        <button type="button">Second</button>
      </Modal>
    </div>
  )
}

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        <p>Body</p>
      </Modal>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the dialog with its title when open', () => {
    render(
      <Modal open onClose={() => {}} title="Example dialog">
        <p>Body</p>
      </Modal>,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Example dialog' })).toBeInTheDocument()
  })

  it('focuses the first focusable element on open and restores focus on close', async () => {
    render(<Harness />)

    const openButton = screen.getByRole('button', { name: 'Open' })
    openButton.focus()
    await userEvent.click(openButton)

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(openButton).toHaveFocus()
  })

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the backdrop (the dialog element itself) is clicked', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(dialog)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when clicking content inside the dialog', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await userEvent.click(screen.getByText('Dialog body'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('traps Tab focus within the dialog, wrapping from last to first', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    const closeButton = screen.getByRole('button', { name: 'Close' })
    const first = screen.getByRole('button', { name: 'First' })
    const second = screen.getByRole('button', { name: 'Second' })

    expect(closeButton).toHaveFocus()
    await userEvent.tab()
    expect(first).toHaveFocus()
    await userEvent.tab()
    expect(second).toHaveFocus()
    await userEvent.tab()
    expect(closeButton).toHaveFocus()
  })

  it('traps Shift+Tab focus, wrapping from first to last', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    const closeButton = screen.getByRole('button', { name: 'Close' })
    const second = screen.getByRole('button', { name: 'Second' })

    expect(closeButton).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(second).toHaveFocus()
  })
})
