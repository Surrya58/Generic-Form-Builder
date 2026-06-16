import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FormInstance, Template, ValidationError } from '../../domain'
import { useFill, validateFill } from '../../state'
import { AutosaveStatusPill, QuotaRecoveryDialog, useAutosave, useRepository } from '../persistence'
import { FormRenderer } from '../form'

const AUTOSAVE_DEBOUNCE_MS = 700

function focusField(fieldId: string): void {
  const container = document.querySelector(`[data-field-id="${fieldId}"]`)
  const focusable = container?.querySelector<HTMLElement>(
    'input, textarea, select, button, [tabindex]',
  )
  focusable?.focus()
}

/**
 * The fill experience for one instance: live conditional/calculated rendering,
 * debounced draft autosave, and a validated submit that writes an immutable
 * FormInstance (snapshotting the template) and clears the draft. A failed
 * submit keeps the draft and surfaces the recovery dialog so a full disk never
 * destroys a completed response.
 */
export function FillForm({ template }: { template: Template }) {
  const { state, dispatch } = useFill()
  const repository = useRepository()
  const navigate = useNavigate()

  const [errors, setErrors] = useState<Map<string, ValidationError>>(new Map())
  const [quotaOpen, setQuotaOpen] = useState(false)

  const autosave = useAutosave(state.values, {
    debounceMs: AUTOSAVE_DEBOUNCE_MS,
    save: (values) => {
      const result = repository.saveInstanceDraft({
        kind: 'instance',
        refId: state.instanceId,
        payload: values,
        updatedAt: new Date().toISOString(),
      })
      if (!result.ok && (result.error === 'quota' || result.error === 'unavailable')) {
        setQuotaOpen(true)
      }
      return result
    },
  })

  function handleLeave() {
    // Leaving the form in-app without submitting abandons this response, so
    // discard its draft (it's never recoverable from any list anyway). A page
    // refresh does NOT trigger this handler, so refresh-recovery still works.
    repository.clearInstanceDraft(state.instanceId)
    void navigate('/')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateFill(template.fields, state.values)

    if (result.errors.size > 0) {
      setErrors(result.errors)
      const firstInvalid = template.fields.find((field) => result.errors.has(field.id))
      if (firstInvalid) focusField(firstInvalid.id)
      return
    }

    const instance: FormInstance = {
      id: state.instanceId,
      templateId: state.templateId,
      templateSnapshot: {
        title: template.title,
        fields: template.fields,
        schemaVersion: template.schemaVersion,
      },
      values: result.submittedValues,
      submittedAt: new Date().toISOString(),
    }

    const saveResult = repository.saveInstance(instance)
    if (!saveResult.ok) {
      // Submit-failure safety net: keep the draft, surface recovery, stay put.
      if (saveResult.error === 'quota' || saveResult.error === 'unavailable') setQuotaOpen(true)
      return
    }

    repository.clearInstanceDraft(state.instanceId)
    void navigate(`/templates/${state.templateId}/instances`, {
      state: { justSubmitted: instance.id },
    })
  }

  const errorList = template.fields
    .map((field) => {
      const error = errors.get(field.id)
      return error ? { fieldId: field.id, error } : null
    })
    .filter((entry): entry is { fieldId: string; error: ValidationError } => entry !== null)

  return (
    <div className="mx-auto max-w-2xl p-6">
      <button
        type="button"
        onClick={handleLeave}
        className="text-sm font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        ← Forms
      </button>
      <div className="mb-6 mt-2 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">{template.title || 'Untitled form'}</h1>
        <AutosaveStatusPill
          status={autosave.status}
          lastSavedAt={autosave.lastSavedAt}
          onRetry={autosave.retry}
        />
      </div>

      {errorList.length > 0 && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-medium">
            Please fix {errorList.length} {errorList.length === 1 ? 'error' : 'errors'}:
          </p>
          <ul className="mt-1 list-inside list-disc">
            {errorList.map(({ fieldId, error }) => (
              <li key={fieldId}>
                <button
                  type="button"
                  onClick={() => focusField(fieldId)}
                  className="underline hover:no-underline"
                >
                  {error.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <FormRenderer
          fields={template.fields}
          values={state.values}
          onChange={(fieldId, value) => dispatch({ type: 'setValue', fieldId, value })}
          errors={errors}
        />
        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Submit
          </button>
        </div>
      </form>

      <QuotaRecoveryDialog
        open={quotaOpen}
        onClose={() => setQuotaOpen(false)}
        onRetry={() => {
          setQuotaOpen(false)
          autosave.retry()
        }}
        exportData={state.values}
        exportFilename={`${template.title || 'response'}.json`}
      />
    </div>
  )
}
