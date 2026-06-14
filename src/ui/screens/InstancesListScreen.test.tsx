import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createRepository, type Repository } from '../../persistence'
import { createMockStorageAdapter, makeInstance, makeTemplate } from '../../persistence/testFixtures'
import { RepositoryProvider } from '../persistence'
import { InstancesListScreen } from './InstancesListScreen'

function setup(seed: (repository: Repository) => void) {
  const repository = createRepository(createMockStorageAdapter())
  seed(repository)
  render(
    <MemoryRouter initialEntries={['/templates/t1/instances']}>
      <RepositoryProvider repository={repository}>
        <Routes>
          <Route path="/templates/:templateId/instances" element={<InstancesListScreen />} />
        </Routes>
      </RepositoryProvider>
    </MemoryRouter>,
  )
  return repository
}

describe('InstancesListScreen', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:test')
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an empty state when there are no responses', () => {
    setup((repository) => repository.saveTemplate(makeTemplate({ id: 't1', title: 'Survey' })))
    expect(screen.getByText('No responses yet.')).toBeInTheDocument()
    expect(screen.getByText('Survey')).toBeInTheDocument()
  })

  it('lists submitted responses', () => {
    setup((repository) => {
      repository.saveTemplate(makeTemplate({ id: 't1', title: 'Survey' }))
      repository.saveInstance(makeInstance('t1', { id: 'inst-1' }))
      repository.saveInstance(makeInstance('t1', { id: 'inst-2' }))
    })
    expect(screen.getByText('2 responses')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Download PDF' })).toHaveLength(2)
  })

  it('downloads a PDF for a response', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    setup((repository) => {
      repository.saveTemplate(makeTemplate({ id: 't1', title: 'Survey' }))
      repository.saveInstance(makeInstance('t1', { id: 'inst-1' }))
    })

    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('deletes a response and restores it via Undo', async () => {
    const repository = setup((repo) => {
      repo.saveTemplate(makeTemplate({ id: 't1', title: 'Survey' }))
      repo.saveInstance(makeInstance('t1', { id: 'inst-1' }))
    })

    await userEvent.click(screen.getByRole('button', { name: /Delete response/ }))
    expect(repository.listInstances('t1')).toMatchObject({ ok: true, value: [] })
    expect(screen.getByRole('status')).toHaveTextContent('Response deleted.')

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    const restored = repository.listInstances('t1')
    expect(restored.ok && restored.value).toHaveLength(1)
  })
})
