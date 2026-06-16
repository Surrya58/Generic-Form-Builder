import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { createRepository } from '../../persistence'
import { createMockStorageAdapter } from '../../persistence/testFixtures'
import { makeTestTemplate, singleLineTextField } from '../../domain/testFixtures'
import { BuilderProvider, useBuilder } from '../../state'
import { RepositoryProvider } from '../persistence'
import { BuilderShell } from './BuilderShell'

function TitleProbe() {
  const { state } = useBuilder()
  return <div data-testid="title">{state.template.title}</div>
}

function renderShell(fields = [singleLineTextField('a', { label: 'Full name' })]) {
  const repository = createRepository(createMockStorageAdapter())
  return render(
    <MemoryRouter>
      <RepositoryProvider repository={repository}>
        <BuilderProvider template={makeTestTemplate(fields)}>
          <BuilderShell />
          <TitleProbe />
        </BuilderProvider>
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

describe('BuilderShell', () => {
  it('renders a control to go back to the templates list', () => {
    renderShell()
    expect(screen.getByRole('button', { name: /Templates/ })).toBeInTheDocument()
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
