import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { Field } from '../../domain'
import { createRepository, type Repository } from '../../persistence'
import { createMockStorageAdapter } from '../../persistence/testFixtures'
import { makeTestTemplate, singleLineTextField } from '../../domain/testFixtures'
import { BuilderProvider } from '../../state'
import { RepositoryProvider } from '../persistence'
import { BuilderHeader } from './BuilderHeader'

function renderHeader(
  fields: Field[],
  repository: Repository = createRepository(createMockStorageAdapter()),
) {
  const template = makeTestTemplate(fields)
  render(
    <MemoryRouter>
      <RepositoryProvider repository={repository}>
        <BuilderProvider template={template}>
          <BuilderHeader />
        </BuilderProvider>
      </RepositoryProvider>
    </MemoryRouter>,
  )
  return { repository, template }
}

function savedTitle(repository: Repository, id: string): string | null | undefined {
  const result = repository.getTemplate(id)
  return result.ok ? (result.value?.title ?? null) : undefined
}

describe('BuilderHeader', () => {
  it('commits a valid template to the repository on Save and clears the dirty state', async () => {
    const { repository, template } = renderHeader([singleLineTextField('a', { label: 'Name' })])

    // Save is disabled until there are unsaved changes.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    await userEvent.type(screen.getByRole('textbox', { name: 'Template title' }), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(savedTitle(repository, template.id)).toBe('Test template!')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('blocks Save and shows an error summary when the template is invalid', async () => {
    const { repository, template } = renderHeader([singleLineTextField('a', { label: '' })])

    await userEvent.type(screen.getByRole('textbox', { name: 'Template title' }), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/missing a label/i)
    expect(savedTitle(repository, template.id)).toBeNull()
  })

  it('reverts edits on Discard', async () => {
    renderHeader([singleLineTextField('a', { label: 'Name' })])
    const title = screen.getByRole('textbox', { name: 'Template title' })

    await userEvent.type(title, ' edited')
    expect(title).toHaveValue('Test template edited')

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(title).toHaveValue('Test template')
  })

  it('discards an abandoned (never-committed) template draft when leaving', async () => {
    const { repository, template } = renderHeader([singleLineTextField('a', { label: 'Name' })])
    repository.saveTemplateDraft({
      kind: 'template',
      refId: template.id,
      payload: template,
      updatedAt: new Date().toISOString(),
    })

    await userEvent.click(screen.getByRole('button', { name: '← Templates' }))

    const draft = repository.getTemplateDraft(template.id)
    expect(draft.ok && draft.value).toBeNull()
  })

  it('keeps the draft of a committed template when leaving (preserves unsaved edits)', async () => {
    const { repository, template } = renderHeader([singleLineTextField('a', { label: 'Name' })])
    repository.saveTemplate(template) // commit it first
    repository.saveTemplateDraft({
      kind: 'template',
      refId: template.id,
      payload: { ...template, title: 'Edited but not saved' },
      updatedAt: new Date().toISOString(),
    })

    await userEvent.click(screen.getByRole('button', { name: '← Templates' }))

    const draft = repository.getTemplateDraft(template.id)
    expect(draft.ok && draft.value).not.toBeNull()
  })
})
