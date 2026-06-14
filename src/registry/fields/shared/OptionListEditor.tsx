import type { Option } from '../../../domain'
import { DragHandle } from '../../../ui/primitives/DragHandle'
import { SortableList } from '../../../ui/primitives/SortableList'
import { moveItem } from '../../../state/listOperations'
import { textInputClassName } from './inputStyles'

interface OptionListEditorProps {
  options: Option[]
  onChange: (next: Option[]) => void
}

/**
 * Add/remove/reorder editor for an option list, shared by every select-style
 * field's config editor. Reordering always goes through `moveItem`, so it's
 * deterministic and never changes option ids — conditions and saved values
 * reference options by id and survive reordering.
 */
export function OptionListEditor({ options, onChange }: OptionListEditorProps) {
  function addOption() {
    const id = crypto.randomUUID()
    onChange([...options, { id, label: `Option ${String(options.length + 1)}` }])
  }

  function updateLabel(id: string, label: string) {
    onChange(options.map((option) => (option.id === id ? { ...option, label } : option)))
  }

  function removeOption(id: string) {
    onChange(options.filter((option) => option.id !== id))
  }

  function reorder(id: string, toIndex: number) {
    onChange(moveItem(options, id, toIndex))
  }

  return (
    <div className="flex flex-col gap-2">
      <SortableList
        items={options}
        onReorder={reorder}
        getLabel={(option) => option.label || 'Untitled option'}
        className="flex flex-col gap-2"
        emptyState={<p className="text-xs text-gray-500">No options yet.</p>}
        renderItem={(
          option,
          { dragHandleProps, index, canMoveUp, canMoveDown, moveUp, moveDown },
        ) => (
          <div className="flex items-center gap-1">
            <DragHandle
              label={`Reorder option ${String(index + 1)}`}
              dragHandleProps={dragHandleProps}
            />
            <input
              type="text"
              aria-label={`Option ${String(index + 1)} label`}
              className={textInputClassName}
              value={option.label}
              onChange={(event) => updateLabel(option.id, event.target.value)}
            />
            <button
              type="button"
              aria-label={`Move option ${String(index + 1)} up`}
              disabled={!canMoveUp}
              onClick={moveUp}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move option ${String(index + 1)} down`}
              disabled={!canMoveDown}
              onClick={moveDown}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↓
            </button>
            <button
              type="button"
              aria-label={`Remove option ${String(index + 1)}`}
              onClick={() => removeOption(option.id)}
              className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        )}
      />
      <button
        type="button"
        onClick={addOption}
        className="self-start rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-900"
      >
        + Add option
      </button>
    </div>
  )
}
