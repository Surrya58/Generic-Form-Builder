import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuotaRecoveryDialog } from './QuotaRecoveryDialog'

describe('QuotaRecoveryDialog', () => {
  let createObjectURL: ReturnType<typeof vi.spyOn>
  let revokeObjectURL: ReturnType<typeof vi.spyOn>
  let click: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when closed', () => {
    render(
      <QuotaRecoveryDialog
        open={false}
        onClose={() => {}}
        onRetry={() => {}}
        exportData={{}}
        exportFilename="backup.json"
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('explains the quota error and offers recovery actions', () => {
    render(
      <QuotaRecoveryDialog
        open
        onClose={() => {}}
        onRetry={() => {}}
        exportData={{}}
        exportFilename="backup.json"
      />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/storage quota has been reached/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download backup' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('downloads the export data as JSON', async () => {
    const exportData = { title: 'My template' }
    render(
      <QuotaRecoveryDialog
        open
        onClose={() => {}}
        onRetry={() => {}}
        exportData={exportData}
        exportFilename="my-template.json"
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Download backup' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('calls onRetry when retrying', async () => {
    const onRetry = vi.fn()
    render(
      <QuotaRecoveryDialog
        open
        onClose={() => {}}
        onRetry={onRetry}
        exportData={{}}
        exportFilename="backup.json"
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Retry save' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when dismissed', async () => {
    const onClose = vi.fn()
    render(
      <QuotaRecoveryDialog
        open
        onClose={onClose}
        onRetry={() => {}}
        exportData={{}}
        exportFilename="backup.json"
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
