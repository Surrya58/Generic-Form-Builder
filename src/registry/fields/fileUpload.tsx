import { useId, useState } from 'react'
import { OPERATORS_BY_FIELD_TYPE, evaluateOperator, validateField } from '../../domain'
import { FileUploadIcon } from '../icons'
import type { ConfigEditorProps, FieldDefinition, FillRendererProps } from '../types'
import { ClampedIntInput } from './shared/ClampedIntInput'
import { ConfigField } from './shared/ConfigField'
import { FieldShell, describedBy } from './shared/FieldShell'
import { formatBytes } from './shared/formatBytes'
import { textInputClassName } from './shared/inputStyles'

const MIN_FILES = 1
const MAX_FILES = 10

function FileUploadConfigEditor({ config, onChange }: ConfigEditorProps<'fileUpload'>) {
  const id = useId()
  const [typesText, setTypesText] = useState(config.acceptedTypes.join(', '))

  return (
    <div className="flex flex-col gap-3">
      <ConfigField
        label="Accepted file types"
        htmlFor={`${id}-types`}
        hint="Comma-separated extensions or MIME types, e.g. .pdf, image/*. Leave blank to accept anything."
      >
        <input
          id={`${id}-types`}
          type="text"
          className={textInputClassName}
          value={typesText}
          onChange={(event) => {
            setTypesText(event.target.value)
            onChange({
              ...config,
              acceptedTypes: event.target.value
                .split(',')
                .map((type) => type.trim())
                .filter((type) => type.length > 0),
            })
          }}
        />
      </ConfigField>
      <ConfigField label="Maximum files" htmlFor={`${id}-max-files`}>
        <ClampedIntInput
          id={`${id}-max-files`}
          min={MIN_FILES}
          max={MAX_FILES}
          className={textInputClassName}
          value={config.maxFiles}
          onChange={(maxFiles) => onChange({ ...config, maxFiles })}
        />
      </ConfigField>
    </div>
  )
}

function FileUploadFillRenderer({
  config,
  value,
  onChange,
  label,
  required,
  error,
  readOnly,
}: FillRendererProps<'fileUpload'>) {
  const id = useId()

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const added = Array.from(fileList).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    }))
    onChange([...value, ...added].slice(0, config.maxFiles))
  }

  function removeFile(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <FieldShell
      id={id}
      label={label}
      required={required}
      error={error}
      hint="File content isn't stored — only the name, size and type are saved."
    >
      <input
        id={id}
        type="file"
        multiple={config.maxFiles > 1}
        accept={config.acceptedTypes.length > 0 ? config.acceptedTypes.join(',') : undefined}
        disabled={readOnly || value.length >= config.maxFiles}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { hasHint: true, hasError: Boolean(error) })}
        className="text-sm text-gray-700"
        onChange={(event) => {
          addFiles(event.target.files)
          event.target.value = ''
        }}
      />
      {value.length > 0 && (
        <ul className="flex flex-col gap-1">
          {value.map((file, index) => (
            <li
              key={`${file.name}-${String(index)}`}
              className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700"
            >
              <span className="truncate font-medium">{file.name}</span>
              <span className="text-gray-500">{formatBytes(file.size)}</span>
              <span className="text-gray-500">{file.type || 'unknown type'}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                disabled={readOnly}
                onClick={() => removeFile(index)}
                className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </FieldShell>
  )
}

export const fileUploadDefinition: FieldDefinition<'fileUpload'> = {
  type: 'fileUpload',
  displayName: 'File upload',
  icon: <FileUploadIcon />,
  isInput: true,

  defaultConfig: () => ({ acceptedTypes: [], maxFiles: 5 }),
  emptyValue: () => [],

  ConfigEditor: FileUploadConfigEditor,
  FillRenderer: FileUploadFillRenderer,

  validate: (field, value, ctx) => validateField(field, value, ctx),
  toPdfRows: (field, value) => {
    const files = Array.isArray(value) ? value : []
    const names = files
      .filter(
        (file): file is { name: string } =>
          typeof file === 'object' &&
          file !== null &&
          typeof (file as { name?: unknown }).name === 'string',
      )
      .map((file) => file.name)
    return [{ label: field.label, value: names.join(', ') }]
  },

  conditionOperators: OPERATORS_BY_FIELD_TYPE.fileUpload,
  evaluateCondition: (operator, fieldValue, compareValue) =>
    evaluateOperator('fileUpload', operator, fieldValue, compareValue),
}
