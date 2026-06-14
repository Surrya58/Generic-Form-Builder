import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AutosaveStatusPill } from './AutosaveStatusPill'

describe('AutosaveStatusPill', () => {
  it('shows a neutral message before anything has been saved', () => {
    render(<AutosaveStatusPill status="idle" lastSavedAt={null} />)
    expect(screen.getByRole('status')).toHaveTextContent('No changes yet')
  })

  it('shows unsaved changes while editing', () => {
    render(<AutosaveStatusPill status="editing" lastSavedAt={null} />)
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes')
  })

  it('shows a saving indicator', () => {
    render(<AutosaveStatusPill status="saving" lastSavedAt={null} />)
    expect(screen.getByRole('status')).toHaveTextContent('Saving…')
  })

  it('shows the saved time once a save has completed', () => {
    const savedAt = new Date('2024-06-15T14:30:00')
    render(<AutosaveStatusPill status="saved" lastSavedAt={savedAt} />)
    expect(screen.getByRole('status')).toHaveTextContent(/Saved/)
  })

  it('shows a failure message with a retry action', async () => {
    const onRetry = vi.fn()
    render(<AutosaveStatusPill status="failed" lastSavedAt={null} onRetry={onRetry} />)

    expect(screen.getByRole('status')).toHaveTextContent('Save failed')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('omits the retry button when no onRetry handler is provided', () => {
    render(<AutosaveStatusPill status="failed" lastSavedAt={null} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
