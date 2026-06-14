import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SortableList } from './SortableList'
import { DragHandle } from './DragHandle'
import type { SortableItemRenderProps } from './SortableList'

interface Item {
  id: string
  label: string
}

const ITEMS: Item[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
]

function renderItem(item: Item, props: SortableItemRenderProps) {
  return (
    <div data-testid={`row-${item.id}`}>
      <DragHandle label={`Drag ${item.label}`} dragHandleProps={props.dragHandleProps} />
      <span>{item.label}</span>
      <button
        type="button"
        aria-label={`Move ${item.label} up`}
        disabled={!props.canMoveUp}
        onClick={props.moveUp}
      >
        Up
      </button>
      <button
        type="button"
        aria-label={`Move ${item.label} down`}
        disabled={!props.canMoveDown}
        onClick={props.moveDown}
      >
        Down
      </button>
      <span data-testid={`index-${item.id}`}>{props.index}</span>
    </div>
  )
}

describe('SortableList', () => {
  it('renders every item in order with its index', () => {
    render(
      <SortableList
        items={ITEMS}
        onReorder={() => {}}
        getLabel={(item) => item.label}
        renderItem={renderItem}
      />,
    )

    expect(screen.getAllByText(/Alpha|Beta|Gamma/).map((el) => el.textContent)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ])
    expect(screen.getByTestId('index-a')).toHaveTextContent('0')
    expect(screen.getByTestId('index-b')).toHaveTextContent('1')
    expect(screen.getByTestId('index-c')).toHaveTextContent('2')
  })

  it('disables move-up on the first item and move-down on the last', () => {
    render(
      <SortableList
        items={ITEMS}
        onReorder={() => {}}
        getLabel={(item) => item.label}
        renderItem={renderItem}
      />,
    )

    expect(screen.getByRole('button', { name: 'Move Alpha up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Alpha down' })).toBeEnabled()

    expect(screen.getByRole('button', { name: 'Move Beta up' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Move Beta down' })).toBeEnabled()

    expect(screen.getByRole('button', { name: 'Move Gamma up' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Move Gamma down' })).toBeDisabled()
  })

  it('calls onReorder with the item id and target index when moved down', async () => {
    const onReorder = vi.fn()
    render(
      <SortableList
        items={ITEMS}
        onReorder={onReorder}
        getLabel={(item) => item.label}
        renderItem={renderItem}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Move Alpha down' }))

    expect(onReorder).toHaveBeenCalledWith('a', 1)
  })

  it('calls onReorder with the item id and target index when moved up', async () => {
    const onReorder = vi.fn()
    render(
      <SortableList
        items={ITEMS}
        onReorder={onReorder}
        getLabel={(item) => item.label}
        renderItem={renderItem}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Move Gamma up' }))

    expect(onReorder).toHaveBeenCalledWith('c', 1)
  })

  it('renders the empty state when there are no items', () => {
    render(
      <SortableList
        items={[]}
        onReorder={() => {}}
        getLabel={(item: Item) => item.label}
        renderItem={renderItem}
        emptyState={<p>Nothing here yet</p>}
      />,
    )

    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
  })

  it('gives every drag handle an accessible label and makes it focusable', () => {
    render(
      <SortableList
        items={ITEMS}
        onReorder={() => {}}
        getLabel={(item) => item.label}
        renderItem={renderItem}
      />,
    )

    const handle = screen.getByRole('button', { name: 'Drag Alpha' })
    expect(handle).toHaveAttribute('tabIndex', '0')
  })

  it('lifts an item via the keyboard and cancels with Escape without reordering', async () => {
    const onReorder = vi.fn()
    render(
      <SortableList
        items={ITEMS}
        onReorder={onReorder}
        getLabel={(item) => item.label}
        renderItem={renderItem}
      />,
    )

    const handle = screen.getByRole('button', { name: 'Drag Alpha' })
    handle.focus()
    await userEvent.keyboard(' ')
    await userEvent.keyboard('{Escape}')

    expect(onReorder).not.toHaveBeenCalled()
  })
})
