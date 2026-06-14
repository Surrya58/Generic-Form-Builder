import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createRepository, type Repository } from '../../persistence/repository'
import { createMockStorageAdapter, makeTemplate } from '../../persistence/testFixtures'
import { RepositoryProvider } from '../persistence'
import { BuilderScreen } from './BuilderScreen'

function renderAt(path: string, repository: Repository) {
  return render(
    <RepositoryProvider repository={repository}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/builder/:templateId" element={<BuilderScreen />} />
        </Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  )
}

describe('BuilderScreen', () => {
  it('loads an existing template from the repository', () => {
    const repository = createRepository(createMockStorageAdapter())
    repository.saveTemplate(makeTemplate({ id: 'template-1', title: 'My form' }))

    renderAt('/builder/template-1', repository)

    expect(screen.getByRole('textbox', { name: 'Template title' })).toHaveValue('My form')
    expect(screen.getByText('Name')).toBeInTheDocument()
  })

  it('creates a blank template when none exists for the given id', () => {
    const repository = createRepository(createMockStorageAdapter())

    renderAt('/builder/new-id', repository)

    expect(screen.getByRole('textbox', { name: 'Template title' })).toHaveValue('')
    expect(screen.getByText(/No fields yet/)).toBeInTheDocument()
  })
})
