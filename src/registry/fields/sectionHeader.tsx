import { useId } from 'react'
import { OPERATORS_BY_FIELD_TYPE, evaluateOperator, validateField } from '../../domain'
import { SectionHeaderIcon } from '../icons'
import type { ConfigEditorProps, FieldDefinition, FillRendererProps } from '../types'
import { ConfigField } from './shared/ConfigField'
import { textInputClassName } from './shared/inputStyles'

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const

function isSize(value: string): value is (typeof SIZES)[number] {
  return (SIZES as readonly string[]).includes(value)
}

const SIZE_CLASSES: Record<(typeof SIZES)[number], string> = {
  xs: 'text-sm font-semibold',
  sm: 'text-base font-semibold',
  md: 'text-lg font-semibold',
  lg: 'text-xl font-semibold',
  xl: 'text-2xl font-semibold',
}

function SectionHeaderConfigEditor({ config, onChange }: ConfigEditorProps<'sectionHeader'>) {
  const id = useId()
  return (
    <ConfigField label="Size" htmlFor={`${id}-size`}>
      <select
        id={`${id}-size`}
        className={textInputClassName}
        value={config.size}
        onChange={(event) => {
          const size = event.target.value
          if (isSize(size)) onChange({ ...config, size })
        }}
      >
        {SIZES.map((size) => (
          <option key={size} value={size}>
            {size.toUpperCase()}
          </option>
        ))}
      </select>
    </ConfigField>
  )
}

function SectionHeaderFillRenderer({ config, label }: FillRendererProps<'sectionHeader'>) {
  return <p className={`${SIZE_CLASSES[config.size]} text-gray-900`}>{label}</p>
}

export const sectionHeaderDefinition: FieldDefinition<'sectionHeader'> = {
  type: 'sectionHeader',
  displayName: 'Section header',
  icon: <SectionHeaderIcon />,
  isInput: false,

  defaultConfig: () => ({ size: 'md' }),
  emptyValue: () => {
    throw new Error('sectionHeader captures no value')
  },

  ConfigEditor: SectionHeaderConfigEditor,
  FillRenderer: SectionHeaderFillRenderer,

  validate: (field, value, ctx) => validateField(field, value, ctx),
  toPdfRows: () => [],

  conditionOperators: OPERATORS_BY_FIELD_TYPE.sectionHeader,
  evaluateCondition: (operator, fieldValue, compareValue) =>
    evaluateOperator('sectionHeader', operator, fieldValue, compareValue),
}
