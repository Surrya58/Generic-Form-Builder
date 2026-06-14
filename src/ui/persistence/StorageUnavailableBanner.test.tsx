import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StorageUnavailableBanner } from './StorageUnavailableBanner'

describe('StorageUnavailableBanner', () => {
  it('renders nothing when storage is available', () => {
    render(<StorageUnavailableBanner visible={false} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('warns the user when storage is unavailable', () => {
    render(<StorageUnavailableBanner visible />)
    expect(screen.getByRole('alert')).toHaveTextContent(/storage is unavailable/i)
  })
})
