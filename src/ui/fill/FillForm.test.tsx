import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { createRepository, type Repository } from '../../persistence'
import { createMockStorageAdapter } from '../../persistence/testFixtures'
import { makeTestTemplate, singleLineTextField } from '../../domain/testFixtures'
import { FillProvider } from '../../state'
import { RepositoryProvider } from '../persistence'
import { FillForm } from './FillForm'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderForm(repository: Repository) {
  const template = makeTestTemplate(
    [singleLineTextField('a', { label: 'Name', defaultRequired: true })],
    { id: 't' },
  )
  render(
    <MemoryRouter initialEntries={['/start']}>
      <RepositoryProvider repository={repository}>
        <Routes>
          <Route
            path="/start"
            element={
              <FillProvider init={{ templateId: 't', instanceId: 'inst-1', values: {} }}>
                <FillForm template={template} />
              </FillProvider>
            }
          />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

describe('FillForm', () => {
  it('blocks submit and shows an error summary when a required field is empty', async () => {
    const repository = createRepository(createMockStorageAdapter())
    renderForm(repository)

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(screen.getByText(/please fix 1 error/i)).toBeInTheDocument()
    const instances = repository.listInstances('t')
    expect(instances.ok && instances.value).toHaveLength(0)
  })

  it('submits a valid response, clears the draft, and navigates to the instances list', async () => {
    const repository = createRepository(createMockStorageAdapter())
    renderForm(repository)

    await userEvent.type(screen.getByRole('textbox', { name: /Name/ }), 'Ada')
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))

    const instances = repository.listInstances('t')
    expect(instances.ok && instances.value).toHaveLength(1)
    expect(instances.ok && instances.value[0]?.values).toMatchObject({ a: 'Ada' })
    expect(screen.getByTestId('location').textContent).toBe('/templates/t/instances')

    const draft = repository.getInstanceDraft('inst-1')
    expect(draft.ok && draft.value).toBeNull()
  })
})
