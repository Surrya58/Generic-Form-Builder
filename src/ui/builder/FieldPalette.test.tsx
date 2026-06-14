import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeTestTemplate } from '../../domain/testFixtures'
import { paletteEntries } from '../../registry'
import { BuilderProvider, useBuilder } from '../../state'
import { FieldPalette } from './FieldPalette'

function FieldTypesProbe() {
  const { state } = useBuilder()
  return <div data-testid="types">{state.template.fields.map((field) => field.type).join(',')}</div>
}

describe('FieldPalette', () => {
  it('lists every registered field type', () => {
    render(
      <BuilderProvider template={makeTestTemplate([])}>
        <FieldPalette />
      </BuilderProvider>,
    )

    for (const entry of paletteEntries) {
      expect(
        screen.getByRole('button', { name: new RegExp(entry.displayName) }),
      ).toBeInTheDocument()
    }
  })

  it('appends a field of the clicked type to the end of the template', async () => {
    render(
      <BuilderProvider template={makeTestTemplate([])}>
        <FieldPalette />
        <FieldTypesProbe />
      </BuilderProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: /Single line text/ }))
    expect(screen.getByTestId('types')).toHaveTextContent('singleLineText')

    await userEvent.click(screen.getByRole('button', { name: /^Number/ }))
    expect(screen.getByTestId('types')).toHaveTextContent('singleLineText,number')
  })
})
