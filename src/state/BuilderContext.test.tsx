import type { ReactNode } from 'react'
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { makeTestTemplate, singleLineTextField } from '../domain/testFixtures'
import type { Template } from '../domain'
import { BuilderProvider } from './BuilderContext'
import { useBuilder, useIsDirty, useSelectedField } from './builderHooks'

function makeWrapper(template: Template) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <BuilderProvider template={template}>{children}</BuilderProvider>
  }
}

function useTestHarness() {
  const { state, dispatch } = useBuilder()
  return { state, dispatch, selected: useSelectedField(), dirty: useIsDirty() }
}

describe('useBuilder', () => {
  it('throws when used outside a BuilderProvider', () => {
    const { result } = renderHook(() => {
      try {
        return useBuilder()
      } catch (error) {
        return error
      }
    })

    expect(result.current).toBeInstanceOf(Error)
  })

  it('provides state and dispatch, and reflects dispatched actions', () => {
    const template = makeTestTemplate([singleLineTextField('a', { label: 'A' })])
    const { result } = renderHook(() => useBuilder(), { wrapper: makeWrapper(template) })

    expect(result.current.state.template.title).toBe('Test template')

    act(() => {
      result.current.dispatch({ type: 'setTitle', title: 'Changed' })
    })

    expect(result.current.state.template.title).toBe('Changed')
  })
})

describe('useSelectedField and useIsDirty', () => {
  it('start at null/false and update as the shared state changes', () => {
    const template = makeTestTemplate([singleLineTextField('a', { label: 'A' })])
    const { result } = renderHook(() => useTestHarness(), { wrapper: makeWrapper(template) })

    expect(result.current.selected).toBeNull()
    expect(result.current.dirty).toBe(false)

    act(() => {
      result.current.dispatch({ type: 'selectField', fieldId: 'a' })
    })
    expect(result.current.selected?.id).toBe('a')
    expect(result.current.dirty).toBe(false)

    act(() => {
      result.current.dispatch({ type: 'setTitle', title: 'Changed' })
    })
    expect(result.current.dirty).toBe(true)
  })
})

function ConsumerScreen() {
  const { state, dispatch } = useBuilder()
  const selected = useSelectedField()
  const dirty = useIsDirty()

  return (
    <div>
      <p data-testid="title">{state.template.title}</p>
      <p data-testid="selected">{selected ? selected.label : 'none'}</p>
      <p data-testid="dirty">{dirty ? 'dirty' : 'clean'}</p>
      <button onClick={() => dispatch({ type: 'setTitle', title: 'Renamed' })}>Rename</button>
      <button onClick={() => dispatch({ type: 'selectField', fieldId: 'a' })}>Select A</button>
    </div>
  )
}

describe('BuilderProvider', () => {
  it('shares a single state across consumers and reflects dispatches', async () => {
    const template = makeTestTemplate([singleLineTextField('a', { label: 'A' })])
    render(
      <BuilderProvider template={template}>
        <ConsumerScreen />
      </BuilderProvider>,
    )

    expect(screen.getByTestId('title')).toHaveTextContent('Test template')
    expect(screen.getByTestId('selected')).toHaveTextContent('none')
    expect(screen.getByTestId('dirty')).toHaveTextContent('clean')

    await userEvent.click(screen.getByRole('button', { name: 'Select A' }))
    expect(screen.getByTestId('selected')).toHaveTextContent('A')

    await userEvent.click(screen.getByRole('button', { name: 'Rename' }))
    expect(screen.getByTestId('title')).toHaveTextContent('Renamed')
    expect(screen.getByTestId('dirty')).toHaveTextContent('dirty')
  })
})
