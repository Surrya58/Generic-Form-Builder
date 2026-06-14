import { useId } from 'react'
import { OPERATORS_BY_FIELD_TYPE, evaluateOperator, validateField } from '../../domain'
import { CalculationIcon } from '../icons'
import type { ConfigEditorProps, FieldDefinition, FillRendererProps } from '../types'
import { DragHandle } from '../../ui/primitives/DragHandle'
import { SortableList } from '../../ui/primitives/SortableList'
import { moveItem } from '../../state/listOperations'
import { ClampedIntInput } from './shared/ClampedIntInput'
import { ConfigField } from './shared/ConfigField'
import { FieldShell } from './shared/FieldShell'
import { textInputClassName } from './shared/inputStyles'

const AGGREGATIONS = ['sum', 'avg', 'min', 'max'] as const

function isAggregation(value: string): value is (typeof AGGREGATIONS)[number] {
  return (AGGREGATIONS as readonly string[]).includes(value)
}

const AGGREGATION_LABELS: Record<(typeof AGGREGATIONS)[number], string> = {
  sum: 'Sum',
  avg: 'Average',
  min: 'Minimum',
  max: 'Maximum',
}

const MIN_DECIMALS = 0
const MAX_DECIMALS = 4

function CalculationConfigEditor({
  field,
  allFields,
  config,
  onChange,
}: ConfigEditorProps<'calculation'>) {
  const id = useId()
  const candidates = allFields.filter((candidate) => candidate.id !== field.id)
  const selectedIds = new Set(config.sourceFieldIds)

  const orphanIds = config.sourceFieldIds.filter((sourceId) => {
    const source = allFields.find((candidate) => candidate.id === sourceId)
    return source === undefined || source.type !== 'number'
  })

  function setSourceIds(sourceFieldIds: string[]) {
    onChange({ ...config, sourceFieldIds })
  }

  function toggleSource(candidateId: string) {
    if (selectedIds.has(candidateId)) {
      setSourceIds(config.sourceFieldIds.filter((sourceId) => sourceId !== candidateId))
    } else {
      setSourceIds([...config.sourceFieldIds, candidateId])
    }
  }

  function removeSource(sourceId: string) {
    setSourceIds(config.sourceFieldIds.filter((id) => id !== sourceId))
  }

  function reorderSources(sourceId: string, toIndex: number) {
    const items = config.sourceFieldIds.map((sourceFieldId) => ({ id: sourceFieldId }))
    setSourceIds(moveItem(items, sourceId, toIndex).map((item) => item.id))
  }

  return (
    <div className="flex flex-col gap-3">
      <ConfigField label="Aggregation" htmlFor={`${id}-aggregation`}>
        <select
          id={`${id}-aggregation`}
          className={textInputClassName}
          value={config.aggregation}
          onChange={(event) => {
            const aggregation = event.target.value
            if (isAggregation(aggregation)) onChange({ ...config, aggregation })
          }}
        >
          {AGGREGATIONS.map((aggregation) => (
            <option key={aggregation} value={aggregation}>
              {AGGREGATION_LABELS[aggregation]}
            </option>
          ))}
        </select>
      </ConfigField>
      <ConfigField label="Decimal places" htmlFor={`${id}-decimals`}>
        <ClampedIntInput
          id={`${id}-decimals`}
          min={MIN_DECIMALS}
          max={MAX_DECIMALS}
          className={textInputClassName}
          value={config.decimals}
          onChange={(decimals) => onChange({ ...config, decimals })}
        />
      </ConfigField>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-700">Sources</span>
        {config.sourceFieldIds.length === 0 && (
          <p className="text-xs text-amber-600">
            Add at least one number field as a source — a calculation with no sources can&apos;t
            produce a value.
          </p>
        )}
        <SortableList
          items={config.sourceFieldIds.map((sourceId) => ({ id: sourceId }))}
          onReorder={reorderSources}
          getLabel={(item) =>
            allFields.find((candidate) => candidate.id === item.id)?.label ?? 'Untitled field'
          }
          className="flex flex-col gap-1"
          renderItem={(item, { dragHandleProps, index }) => {
            const source = allFields.find((candidate) => candidate.id === item.id)
            const isOrphan = source === undefined || source.type !== 'number'
            return (
              <div
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-sm ${
                  isOrphan
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-gray-200 text-gray-700'
                }`}
              >
                <DragHandle
                  label={`Reorder source ${String(index + 1)}`}
                  dragHandleProps={dragHandleProps}
                />
                <span className="flex-1 truncate">
                  {source?.label ?? 'Deleted field'}
                  {isOrphan && ' (no longer a number field)'}
                </span>
                <button
                  type="button"
                  aria-label={`Remove source ${source?.label ?? 'Deleted field'}`}
                  onClick={() => removeSource(item.id)}
                  className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            )
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-700">Add a source</span>
        <div className="flex flex-col gap-1">
          {candidates.map((candidate) => {
            const isNumber = candidate.type === 'number'
            const reason = isNumber
              ? null
              : candidate.type === 'calculation'
                ? "Calculations can't use other calculations."
                : 'Only number fields can be used as calculation sources.'
            const selected = selectedIds.has(candidate.id)
            return (
              <label
                key={candidate.id}
                className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm ${
                  isNumber
                    ? 'border-gray-200 text-gray-700'
                    : 'cursor-not-allowed border-gray-100 text-gray-400'
                }`}
              >
                <input
                  type="checkbox"
                  aria-label={candidate.label || 'Untitled question'}
                  checked={selected}
                  disabled={!isNumber}
                  onChange={() => toggleSource(candidate.id)}
                />
                <span className="flex-1 truncate">{candidate.label || 'Untitled question'}</span>
                {reason && <span className="text-xs">{reason}</span>}
              </label>
            )
          })}
          {candidates.length === 0 && <p className="text-xs text-gray-500">No other fields yet.</p>}
        </div>
      </div>

      {orphanIds.length > 0 && (
        <p className="text-xs text-amber-600">
          {orphanIds.length} source{orphanIds.length === 1 ? '' : 's'} no longer exist as number
          fields and will be ignored — remove them above.
        </p>
      )}
    </div>
  )
}

function CalculationFillRenderer({
  config,
  value,
  label,
  error,
}: FillRendererProps<'calculation'>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} error={error} labelAs="span">
      <div
        id={`${id}-value`}
        aria-labelledby={id}
        className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
      >
        {value === null ? '—' : value.toFixed(config.decimals)}
      </div>
    </FieldShell>
  )
}

export const calculationDefinition: FieldDefinition<'calculation'> = {
  type: 'calculation',
  displayName: 'Calculation',
  icon: <CalculationIcon />,
  isInput: true,

  defaultConfig: () => ({ sourceFieldIds: [], aggregation: 'sum', decimals: 0 }),
  emptyValue: () => null,

  ConfigEditor: CalculationConfigEditor,
  FillRenderer: CalculationFillRenderer,

  validate: (field, value, ctx) => validateField(field, value, ctx),
  toPdfRows: (field, value) => [
    {
      label: field.label,
      value:
        typeof value === 'number' && Number.isFinite(value)
          ? value.toFixed(field.config.decimals)
          : '',
    },
  ],

  conditionOperators: OPERATORS_BY_FIELD_TYPE.calculation,
  evaluateCondition: (operator, fieldValue, compareValue) =>
    evaluateOperator('calculation', operator, fieldValue, compareValue),
}
