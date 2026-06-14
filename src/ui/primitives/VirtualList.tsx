import { useState, type ReactNode, type UIEvent } from 'react'

export interface VirtualListProps<T> {
  items: T[]
  /** Fixed height of every row, in pixels. */
  rowHeight: number
  /** Height of the scroll viewport, in pixels. */
  height: number
  /** Extra rows rendered above/below the viewport to avoid blank flashes on scroll. */
  overscan?: number
  getKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
  className?: string
  'aria-label'?: string
}

/**
 * A minimal fixed-row-height virtual list: only the rows intersecting the
 * viewport (plus a small overscan) are mounted, while a spacer preserves the
 * full scroll height. Used for long response lists so thousands of rows stay
 * cheap to render.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  height,
  overscan = 4,
  getKey,
  renderItem,
  className,
  'aria-label': ariaLabel,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)

  const totalHeight = items.length * rowHeight
  const firstVisible = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const visibleCount = Math.ceil(height / rowHeight) + overscan * 2
  const lastVisible = Math.min(items.length, firstVisible + visibleCount)
  const window = items.slice(firstVisible, lastVisible)

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    setScrollTop(event.currentTarget.scrollTop)
  }

  return (
    <div
      className={className}
      style={{ height, overflowY: 'auto' }}
      onScroll={handleScroll}
      aria-label={ariaLabel}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {window.map((item, offset) => {
          const index = firstVisible + offset
          return (
            <div
              key={getKey(item, index)}
              style={{ position: 'absolute', top: index * rowHeight, left: 0, right: 0, height: rowHeight }}
            >
              {renderItem(item, index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
