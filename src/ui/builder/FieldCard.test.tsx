import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  makeCondition,
  makeTestTemplate,
  numberField,
  singleLineTextField,
} from '../../domain/testFixtures'
import { BuilderProvider, useBuilder } from '../../state'
import type { SortableItemRenderProps } from '../primitives/SortableList'
import { FieldCard } from './FieldCard'

const NOOP_RENDER_PROPS: SortableItemRenderProps = {
  dragHandleProps: null,
  isDragging: false,
  isDropTarget: false,
  index: 0,
  canMoveUp: false,
  canMoveDown: true,
  moveUp: vi.fn(),
  moveDown: vi.fn(),
}

function StateProbe() {
  const { state } = useBuilder()
  return (
    <div>
      <div data-testid="field-ids">{state.template.fields.map((field) => field.id).join(',')}</div>
      <div data-testid="selected">{state.selectedFieldId ?? 'none'}</div>
    </div>
  )
}

describe('FieldCard', () => {
  it('shows the field label and its type', () => {
    const field = singleLineTextField('a', { label: 'Full name' })
    render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <FieldCard field={field} renderProps={NOOP_RENDER_PROPS} />
      </BuilderProvider>,
    )

    expect(screen.getByText('Full name')).toBeInTheDocument()
    expect(screen.getByText('Single line text')).toBeInTheDocument()
  })

  it('falls back to an "Untitled <type>" label when the field has no label', () => {
    const field = singleLineTextField('a', { label: '' })
    render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <FieldCard field={field} renderProps={NOOP_RENDER_PROPS} />
      </BuilderProvider>,
    )

    expect(screen.getByText('Untitled single line text')).toBeInTheDocument()
  })

  it('marks the card invalid with a red border when hasError is set', () => {
    const field = singleLineTextField('a', { label: '' })
    const { container } = render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <FieldCard field={field} renderProps={NOOP_RENDER_PROPS} hasError />
      </BuilderProvider>,
    )

    const card = container.querySelector('[aria-invalid="true"]')
    expect(card).not.toBeNull()
    expect(card?.className).toContain('border-red-500')
  })

  it('does not mark the card invalid when hasError is absent', () => {
    const field = singleLineTextField('a', { label: 'Full name' })
    const { container } = render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <FieldCard field={field} renderProps={NOOP_RENDER_PROPS} />
      </BuilderProvider>,
    )

    expect(container.querySelector('[aria-invalid="true"]')).toBeNull()
  })

  it('selects the field when clicked', async () => {
    const field = singleLineTextField('a', { label: 'Full name' })
    render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <FieldCard field={field} renderProps={NOOP_RENDER_PROPS} />
        <StateProbe />
      </BuilderProvider>,
    )

    await userEvent.click(screen.getByRole('button', { pressed: false }))
    expect(screen.getByTestId('selected')).toHaveTextContent('a')
  })

  it('deletes the field via the delete action', async () => {
    const field = singleLineTextField('a', { label: 'Full name' })
    render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <FieldCard field={field} renderProps={NOOP_RENDER_PROPS} />
        <StateProbe />
      </BuilderProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Delete Full name' }))
    expect(screen.getByTestId('field-ids')).toHaveTextContent('')
  })

  it('duplicates the field via the duplicate action', async () => {
    const field = singleLineTextField('a', { label: 'Full name' })
    render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <FieldCard field={field} renderProps={NOOP_RENDER_PROPS} />
        <StateProbe />
      </BuilderProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Duplicate Full name' }))
    expect(screen.getByTestId('field-ids').textContent?.split(',')).toHaveLength(2)
  })

  it('toggles the summary section between collapsed and expanded', async () => {
    const field = singleLineTextField('a', { label: 'Full name' })
    render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <FieldCard field={field} renderProps={NOOP_RENDER_PROPS} />
      </BuilderProvider>,
    )

    expect(screen.getByText('No conditions or required fields')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Collapse Full name' }))
    expect(screen.queryByText('No conditions or required fields')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand Full name' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('calls moveUp/moveDown and respects the canMoveUp/canMoveDown flags', async () => {
    const field = singleLineTextField('a', { label: 'Full name' })
    const moveUp = vi.fn()
    const moveDown = vi.fn()
    render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <FieldCard
          field={field}
          renderProps={{
            ...NOOP_RENDER_PROPS,
            canMoveUp: false,
            canMoveDown: true,
            moveUp,
            moveDown,
          }}
        />
      </BuilderProvider>,
    )

    expect(screen.getByRole('button', { name: 'Move Full name up' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Move Full name down' }))
    expect(moveDown).toHaveBeenCalledTimes(1)
    expect(moveUp).not.toHaveBeenCalled()
  })

  it('shows badges for hidden-by-default, required, and conditions', () => {
    const field = numberField('a', {
      label: 'Score',
      defaultVisibility: 'hidden',
      defaultRequired: true,
      conditions: [
        makeCondition({ targetFieldId: 'b', operator: 'equals', value: 1, effect: 'require' }),
      ],
    })
    render(
      <BuilderProvider template={makeTestTemplate([field])}>
        <FieldCard field={field} renderProps={NOOP_RENDER_PROPS} />
      </BuilderProvider>,
    )

    expect(screen.getByText('Hidden by default')).toBeInTheDocument()
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.getByText('1 condition')).toBeInTheDocument()
  })
})
