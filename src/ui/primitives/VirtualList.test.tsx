import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { VirtualList } from './VirtualList'

const items = Array.from({ length: 1000 }, (_, i) => ({ id: `row-${String(i)}`, n: i }))

function renderList() {
  return render(
    <VirtualList
      items={items}
      rowHeight={20}
      height={200}
      overscan={2}
      aria-label="rows"
      getKey={(item) => item.id}
      renderItem={(item) => <div>Row {item.n}</div>}
    />,
  )
}

describe('VirtualList', () => {
  it('mounts only the rows near the viewport, not all 1000', () => {
    renderList()
    // 200px / 20px = 10 visible + 2*2 overscan ≈ 14 rows, far fewer than 1000.
    expect(screen.getByText('Row 0')).toBeInTheDocument()
    expect(screen.queryByText('Row 500')).not.toBeInTheDocument()
    expect(screen.getAllByText(/^Row /).length).toBeLessThan(30)
  })

  it('renders different rows after scrolling', () => {
    renderList()
    const scroller = screen.getByLabelText('rows')
    fireEvent.scroll(scroller, { target: { scrollTop: 10_000 } })
    // 10000 / 20 = row 500 is now in view; row 0 is gone.
    expect(screen.getByText('Row 500')).toBeInTheDocument()
    expect(screen.queryByText('Row 0')).not.toBeInTheDocument()
  })
})
