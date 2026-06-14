import { paletteEntries } from '../../registry'
import { createField, useBuilder } from '../../state'

/** Left panel: every registered field type, appended to the canvas on click. */
export function FieldPalette() {
  const { state, dispatch } = useBuilder()

  return (
    <nav aria-label="Add a field" className="flex flex-col gap-1 p-3">
      <h2 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Add field
      </h2>
      <ul className="flex flex-col gap-0.5">
        {paletteEntries.map((entry) => (
          <li key={entry.type}>
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: 'addField',
                  field: createField(entry.type),
                  atIndex: state.template.fields.length,
                })
              }
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <span aria-hidden="true" className="text-gray-400">
                {entry.icon}
              </span>
              {entry.displayName}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
