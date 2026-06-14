import { useId } from 'react'
import { isRequirableField, type Field, type FieldBase, type FieldConfigMap } from '../../domain'
import { getDefinitionForField, withField } from '../../registry'
import { ConfigField } from '../../registry/fields/shared/ConfigField'
import { textInputClassName } from '../../registry/fields/shared/inputStyles'
import { useBuilder, useSelectedField } from '../../state'
import { ConditionEditor } from './ConditionEditor'

/**
 * Right panel: settings for the selected field. Covers the label,
 * visibility/required toggles, the per-type ConfigEditor, and the
 * condition editor.
 */
export function ConfigPanel() {
  const { state, dispatch } = useBuilder()
  const selected = useSelectedField()
  const id = useId()

  if (!selected) {
    return (
      <aside aria-label="Field settings" className="p-4 text-sm text-gray-500">
        Select a field to edit its settings.
      </aside>
    )
  }

  const definition = getDefinitionForField(selected)

  function updateField(patch: Partial<FieldBase>) {
    dispatch({ type: 'updateField', field: { ...selected, ...patch } as Field })
  }

  return (
    <aside aria-label="Field settings" className="flex flex-col gap-4 overflow-y-auto p-4">
      <h2 className="text-sm font-semibold text-gray-900">{definition.displayName}</h2>

      <ConfigField label="Label" htmlFor={`${id}-label`}>
        <input
          id={`${id}-label`}
          type="text"
          className={textInputClassName}
          value={selected.label}
          onChange={(event) => updateField({ label: event.target.value })}
        />
      </ConfigField>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={selected.defaultVisibility === 'hidden'}
          onChange={(event) =>
            updateField({ defaultVisibility: event.target.checked ? 'hidden' : 'visible' })
          }
        />
        Hidden by default
      </label>

      {isRequirableField(selected.type) && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={selected.defaultRequired}
            onChange={(event) => updateField({ defaultRequired: event.target.checked })}
          />
          Required
        </label>
      )}

      {withField(selected, (field, fieldDefinition) => (
        <fieldDefinition.ConfigEditor
          field={field}
          allFields={state.template.fields}
          config={field.config as FieldConfigMap[typeof field.type]}
          onChange={(config) =>
            dispatch({ type: 'updateField', field: { ...field, config } as Field })
          }
        />
      ))}

      <ConditionEditor
        field={selected}
        allFields={state.template.fields}
        onChange={(conditions) => updateField({ conditions })}
      />
    </aside>
  )
}
