import { isRequirableField, type Field } from '../../domain'
import { getDefinitionForField } from '../../registry'
import { copyField, useBuilder } from '../../state'
import { DragHandle } from '../primitives/DragHandle'
import type { SortableItemRenderProps } from '../primitives/SortableList'

const actionButtonClassName =
  'rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'

export interface FieldCardProps {
  field: Field
  renderProps: SortableItemRenderProps
}

/** One row on the Builder canvas: header (select/reorder/duplicate/delete) plus a collapsible summary. */
export function FieldCard({ field, renderProps }: FieldCardProps) {
  const { state, dispatch } = useBuilder()
  const definition = getDefinitionForField(field)
  const { dragHandleProps, isDragging, canMoveUp, canMoveDown, moveUp, moveDown } = renderProps

  const isSelected = state.selectedFieldId === field.id
  const isCollapsed = state.collapsedFieldIds.has(field.id)
  const displayLabel = field.label || `Untitled ${definition.displayName.toLowerCase()}`

  const showRequiredBadge = isRequirableField(field.type) && field.defaultRequired
  const showHiddenBadge = field.defaultVisibility === 'hidden'
  const conditionCount = field.conditions.length

  return (
    <div
      className={`rounded-lg border bg-white ${isSelected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'} ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex items-center gap-1 px-2 py-2">
        <DragHandle label={`Reorder ${displayLabel}`} dragHandleProps={dragHandleProps} />
        <button
          type="button"
          onClick={() => dispatch({ type: 'selectField', fieldId: field.id })}
          aria-pressed={isSelected}
          className="flex flex-1 items-center gap-2 overflow-hidden rounded-md px-1 py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <span aria-hidden="true" className="shrink-0 text-gray-400">
            {definition.icon}
          </span>
          <span className="truncate text-sm font-medium text-gray-900">{displayLabel}</span>
          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
            {definition.displayName}
          </span>
        </button>
        <button
          type="button"
          aria-label={`Move ${displayLabel} up`}
          disabled={!canMoveUp}
          onClick={moveUp}
          className={actionButtonClassName}
        >
          <span aria-hidden="true">▲</span>
        </button>
        <button
          type="button"
          aria-label={`Move ${displayLabel} down`}
          disabled={!canMoveDown}
          onClick={moveDown}
          className={actionButtonClassName}
        >
          <span aria-hidden="true">▼</span>
        </button>
        <button
          type="button"
          aria-label={`Duplicate ${displayLabel}`}
          onClick={() =>
            dispatch({ type: 'duplicateField', fieldId: field.id, newField: copyField(field) })
          }
          className={actionButtonClassName}
        >
          <span aria-hidden="true">⧉</span>
        </button>
        <button
          type="button"
          aria-label={`Delete ${displayLabel}`}
          onClick={() => dispatch({ type: 'deleteField', fieldId: field.id })}
          className={actionButtonClassName}
        >
          <span aria-hidden="true">🗑</span>
        </button>
        <button
          type="button"
          aria-label={isCollapsed ? `Expand ${displayLabel}` : `Collapse ${displayLabel}`}
          aria-expanded={!isCollapsed}
          onClick={() => dispatch({ type: 'toggleCollapsed', fieldId: field.id })}
          className={actionButtonClassName}
        >
          <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
        </button>
      </div>
      {!isCollapsed && (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-3 py-2 text-xs">
          {showHiddenBadge && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
              Hidden by default
            </span>
          )}
          {showRequiredBadge && (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">Required</span>
          )}
          {conditionCount > 0 && (
            <span className="rounded bg-purple-50 px-1.5 py-0.5 text-purple-700">
              {conditionCount} condition{conditionCount === 1 ? '' : 's'}
            </span>
          )}
          {!showHiddenBadge && !showRequiredBadge && conditionCount === 0 && (
            <span className="text-gray-400">No conditions or required fields</span>
          )}
        </div>
      )}
    </div>
  )
}
