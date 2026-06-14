import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRepository } from '../../persistence/repository'
import { createMockStorageAdapter, makeTemplate } from '../../persistence/testFixtures'
import { RepositoryProvider } from './RepositoryContext'
import { useRepository } from './useRepository'

function TemplateCountProbe() {
  const repository = useRepository()
  const result = repository.listTemplateSummaries()
  return <div data-testid="count">{result.ok ? result.value.length : 'error'}</div>
}

describe('RepositoryProvider / useRepository', () => {
  it('provides the given repository to descendants', () => {
    const repository = createRepository(createMockStorageAdapter())
    repository.saveTemplate(makeTemplate({ id: 'template-1' }))

    render(
      <RepositoryProvider repository={repository}>
        <TemplateCountProbe />
      </RepositoryProvider>,
    )

    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })

  it('falls back to a default repository when no provider is given', () => {
    render(<TemplateCountProbe />)

    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })
})
