import { getDefinitionForField } from '../../registry'
import { useBuilder } from '../../state'
import { SortableList } from '../primitives/SortableList'
import { FieldCard } from './FieldCard'

/** Center panel: the ordered list of fields on the template, drag-and-drop or keyboard reorderable. */
export function Canvas() {
  const { state, dispatch } = useBuilder()

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <SortableList
        items={state.template.fields}
        onReorder={(id, toIndex) => dispatch({ type: 'moveField', fieldId: id, toIndex })}
        getLabel={(field) => field.label || getDefinitionForField(field).displayName}
        className="flex flex-col gap-2"
        emptyState={
          <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
            No fields yet. Add one from the palette to get started.
          </div>
        }
        renderItem={(field, itemProps) => <FieldCard field={field} renderProps={itemProps} />}
      />
    </div>
  )
}
