import type { SortableDragHandleProps } from './SortableList'

interface DragHandleProps {
  label: string
  dragHandleProps: SortableDragHandleProps | null
  className?: string
}

/** The grip (⠿) that initiates a drag via pointer or keyboard. */
export function DragHandle({ label, dragHandleProps, className }: DragHandleProps) {
  return (
    <button
      ref={dragHandleProps?.ref}
      type="button"
      aria-label={label}
      className={`cursor-grab touch-none rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${className ?? ''}`}
      {...(dragHandleProps?.attributes ?? {})}
      {...(dragHandleProps?.listeners ?? {})}
    >
      <span aria-hidden="true">⠿</span>
    </button>
  )
}
