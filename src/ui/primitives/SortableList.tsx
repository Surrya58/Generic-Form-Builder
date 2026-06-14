import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  Announcements,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DraggableAttributes,
  DraggableSyntheticListeners,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/** Props to spread onto the element that should act as the drag handle. */
export interface SortableDragHandleProps {
  ref: (element: HTMLElement | null) => void
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
}

export interface SortableItemRenderProps {
  /** Null for the floating drag-overlay clone, which is non-interactive. */
  dragHandleProps: SortableDragHandleProps | null
  isDragging: boolean
  /** True while another item is being dragged over this item's slot. */
  isDropTarget: boolean
  index: number
  canMoveUp: boolean
  canMoveDown: boolean
  moveUp: () => void
  moveDown: () => void
}

interface SortableListProps<T extends { id: string }> {
  items: T[]
  /** Called with the moved item's id and its new index. Dispatch moveItem from here. */
  onReorder: (id: string, toIndex: number) => void
  renderItem: (item: T, props: SortableItemRenderProps) => ReactNode
  /** Human-readable label used for screen-reader drag announcements. */
  getLabel: (item: T) => string
  className?: string
  itemClassName?: string
  emptyState?: ReactNode
}

const NOOP_RENDER_PROPS: Omit<SortableItemRenderProps, 'index'> = {
  dragHandleProps: null,
  isDragging: true,
  isDropTarget: false,
  canMoveUp: false,
  canMoveDown: false,
  moveUp: () => undefined,
  moveDown: () => undefined,
}

/**
 * One reusable abstraction for every reorderable surface (canvas, palette
 * drops, option lists): pointer + keyboard drag via dnd-kit, a drag overlay
 * clone, a drop-target insertion line, and always-on move-up/move-down
 * callbacks. All paths funnel through `onReorder`, so a single moveItem
 * call covers click, drag, and keyboard reordering.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  getLabel,
  className,
  itemClassName,
  emptyState,
}: SortableListProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    setOverId(event.over ? String(event.over.id) : null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)
    if (!over || active.id === over.id) return

    const toIndex = items.findIndex((item) => item.id === over.id)
    if (toIndex === -1) return
    onReorder(String(active.id), toIndex)
  }

  function handleDragCancel() {
    setActiveId(null)
    setOverId(null)
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      const index = items.findIndex((item) => item.id === active.id)
      const item = items[index]
      if (!item) return undefined
      return `Picked up ${getLabel(item)}. It is in position ${index + 1} of ${items.length}.`
    },
    onDragOver({ active, over }) {
      const item = items.find((entry) => entry.id === active.id)
      if (!item) return undefined
      if (!over) return `${getLabel(item)} is no longer over a droppable area.`
      const overIndex = items.findIndex((entry) => entry.id === over.id)
      return `${getLabel(item)} was moved to position ${overIndex + 1} of ${items.length}.`
    },
    onDragEnd({ active, over }) {
      const item = items.find((entry) => entry.id === active.id)
      if (!item) return undefined
      if (!over) return `${getLabel(item)} was dropped without a change in position.`
      const overIndex = items.findIndex((entry) => entry.id === over.id)
      return `${getLabel(item)} was dropped at position ${overIndex + 1} of ${items.length}.`
    },
    onDragCancel({ active }) {
      const item = items.find((entry) => entry.id === active.id)
      return item ? `Moving ${getLabel(item)} was cancelled.` : undefined
    },
  }

  const activeIndex = items.findIndex((item) => item.id === activeId)
  const activeItem = activeIndex === -1 ? null : items[activeIndex]

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{ announcements }}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.length === 0 && emptyState}
          {items.map((item, index) => (
            <SortableListRow
              key={item.id}
              item={item}
              index={index}
              total={items.length}
              isDropTarget={overId === item.id && activeId !== null && activeId !== item.id}
              className={itemClassName}
              onReorder={onReorder}
              renderItem={renderItem}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeItem && (
          <div className={`${itemClassName ?? ''} opacity-80 shadow-xl`}>
            {renderItem(activeItem, { ...NOOP_RENDER_PROPS, index: activeIndex })}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

interface SortableListRowProps<T extends { id: string }> {
  item: T
  index: number
  total: number
  isDropTarget: boolean
  className?: string
  onReorder: (id: string, toIndex: number) => void
  renderItem: (item: T, props: SortableItemRenderProps) => ReactNode
}

function SortableListRow<T extends { id: string }>({
  item,
  index,
  total,
  isDropTarget,
  className,
  onReorder,
  renderItem,
}: SortableListRowProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={className}
    >
      {isDropTarget && <div aria-hidden="true" className="-mt-px h-0.5 rounded-full bg-blue-500" />}
      {renderItem(item, {
        dragHandleProps: { ref: setActivatorNodeRef, attributes, listeners },
        isDragging,
        isDropTarget,
        index,
        canMoveUp: index > 0,
        canMoveDown: index < total - 1,
        moveUp: () => onReorder(item.id, index - 1),
        moveDown: () => onReorder(item.id, index + 1),
      })}
    </div>
  )
}
