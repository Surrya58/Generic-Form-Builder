import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { createRepository, type Repository } from '../../persistence'
import { createMockStorageAdapter, makeInstance, makeTemplate } from '../../persistence/testFixtures'
import { RepositoryProvider } from '../persistence'
import { TemplatesListScreen } from './TemplatesListScreen'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function setup(seed?: (repository: Repository) => void) {
  const repository = createRepository(createMockStorageAdapter())
  seed?.(repository)
  render(
    <MemoryRouter initialEntries={['/']}>
      <RepositoryProvider repository={repository}>
        <Routes>
          <Route path="/" element={<TemplatesListScreen />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </RepositoryProvider>
    </MemoryRouter>,
  )
  return repository
}

function seedSurvey(repository: Repository) {
  repository.saveTemplate(makeTemplate({ id: 't1', title: 'Survey' }))
  repository.saveInstance(makeInstance('t1'))
}

describe('TemplatesListScreen', () => {
  it('shows an empty state and creates a new form', async () => {
    setup()
    expect(screen.getByText('No forms yet.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Create your first form' }))
    expect(screen.getByTestId('location').textContent).toMatch(/^\/builder\//)
  })

  it('renders a card with field and response counts', () => {
    setup(seedSurvey)
    expect(screen.getByText('Survey')).toBeInTheDocument()
    expect(screen.getByText('1 field · 1 response')).toBeInTheDocument()
  })

  it('opens the builder when a card is clicked', async () => {
    setup(seedSurvey)
    await userEvent.click(screen.getByRole('button', { name: /^Survey/ }))
    expect(screen.getByTestId('location').textContent).toBe('/builder/t1')
  })

  it('starts a new response for a template', async () => {
    setup(seedSurvey)
    await userEvent.click(screen.getByRole('button', { name: 'New response' }))
    expect(screen.getByTestId('location').textContent).toMatch(/^\/fill\/t1\//)
  })

  it('cascade-deletes a template and restores it via Undo', async () => {
    const repository = setup(seedSurvey)

    await userEvent.click(screen.getByRole('button', { name: 'Delete Survey' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.queryByText('Survey')).not.toBeInTheDocument()
    expect(repository.listTemplateSummaries()).toMatchObject({ ok: true, value: [] })
    expect(screen.getByRole('status')).toHaveTextContent(/Deleted "Survey" and 1 response/)

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))

    expect(screen.getByText('Survey')).toBeInTheDocument()
    const restored = repository.listInstances('t1')
    expect(restored.ok && restored.value).toHaveLength(1)
  })
})
