import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { makeTestTemplate, singleLineTextField } from '../../domain/testFixtures'
import { BuilderProvider, useBuilder } from '../../state'
import { BuilderShell } from './BuilderShell'

function TitleProbe() {
  const { state } = useBuilder()
  return <div data-testid="title">{state.template.title}</div>
}

function renderShell(fields = [singleLineTextField('a', { label: 'Full name' })]) {
  return render(
    <MemoryRouter>
      <BuilderProvider template={makeTestTemplate(fields)}>
        <BuilderShell />
        <TitleProbe />
      </BuilderProvider>
    </MemoryRouter>,
  )
}

describe('BuilderShell', () => {
  it('renders a link back to the templates list', () => {
    renderShell()
    expect(screen.getByRole('link', { name: /Templates/ })).toHaveAttribute('href', '/')
  })

  it('shows the template title and updates it on edit', async () => {
    renderShell()
    const titleInput = screen.getByRole('textbox', { name: 'Template title' })
    expect(titleInput).toHaveValue('Test template')

    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Renamed form')

    expect(screen.getByTestId('title')).toHaveTextContent('Renamed form')
  })

  it('renders the palette, canvas, and config panel', () => {
    renderShell()
    expect(screen.getByRole('navigation', { name: 'Add a field' })).toBeInTheDocument()
    expect(screen.getByText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Field settings')).toBeInTheDocument()
  })
})
