import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeTestTemplate, numberField, singleLineTextField } from '../../domain/testFixtures'
import { BuilderProvider } from '../../state'
import { Canvas } from './Canvas'

describe('Canvas', () => {
  it('shows an empty state when the template has no fields', () => {
    render(
      <BuilderProvider template={makeTestTemplate([])}>
        <Canvas />
      </BuilderProvider>,
    )

    expect(screen.getByText(/No fields yet/)).toBeInTheDocument()
  })

  it('renders one field card per field, in order', () => {
    const fields = [
      singleLineTextField('a', { label: 'First' }),
      numberField('b', { label: 'Second' }),
    ]
    render(
      <BuilderProvider template={makeTestTemplate(fields)}>
        <Canvas />
      </BuilderProvider>,
    )

    const labels = screen.getAllByText(/First|Second/).map((el) => el.textContent)
    expect(labels).toEqual(['First', 'Second'])
  })

  it('reorders fields when a card is moved down', async () => {
    const fields = [
      singleLineTextField('a', { label: 'First' }),
      numberField('b', { label: 'Second' }),
    ]
    render(
      <BuilderProvider template={makeTestTemplate(fields)}>
        <Canvas />
      </BuilderProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Move First down' }))

    const labels = screen.getAllByText(/First|Second/).map((el) => el.textContent)
    expect(labels).toEqual(['Second', 'First'])
  })
})
