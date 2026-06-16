import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { validateTemplate, type Field, type Template } from '../../domain'
import { useBuilder, useIsDirty } from '../../state'
import { AutosaveStatusPill, QuotaRecoveryDialog, useAutosave, useRepository } from '../persistence'
import { FormRenderer } from '../form'
import { Modal } from '../primitives/Modal'

const AUTOSAVE_DEBOUNCE_MS = 700

/** Interactive, non-persisting preview of the form as a filler would see it. */
function PreviewBody({ fields }: { fields: Field[] }) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  return (
    <FormRenderer
      fields={fields}
      values={values}
      onChange={(fieldId, value) => setValues((prev) => ({ ...prev, [fieldId]: value }))}
    />
  )
}

/**
 * Builder top bar: template title, autosave status, and the Preview / Discard
 * / Save actions. Owns draft autosave (debounced, flushed on tab-hide via
 * useAutosave), the quota recovery dialog, and the Save guard that blocks on
 * builder-time template-validation errors.
 */
export function BuilderHeader() {
  const { state, dispatch } = useBuilder()
  const repository = useRepository()
  const isDirty = useIsDirty()
  const navigate = useNavigate()

  const [previewOpen, setPreviewOpen] = useState(false)
  const [quotaOpen, setQuotaOpen] = useState(false)

  const errorIssues = useMemo(
    () => validateTemplate(state.template).filter((issue) => issue.severity === 'error'),
    [state.template],
  )

  const autosave = useAutosave(state.template, {
    debounceMs: AUTOSAVE_DEBOUNCE_MS,
    enabled: isDirty,
    save: (template) => {
      const result = repository.saveTemplateDraft({
        kind: 'template',
        refId: template.id,
        payload: template,
        updatedAt: new Date().toISOString(),
      })
      if (!result.ok && (result.error === 'quota' || result.error === 'unavailable')) {
        setQuotaOpen(true)
      }
      return result
    },
  })

  function handleSave() {
    if (errorIssues.length > 0) {
      // Surface the error summary AND the red borders on offending field cards.
      dispatch({ type: 'showValidation' })
      return
    }
    const committed: Template = { ...state.template, updatedAt: new Date().toISOString() }
    const result = repository.saveTemplate(committed)
    if (!result.ok) {
      if (result.error === 'quota' || result.error === 'unavailable') setQuotaOpen(true)
      return
    }
    repository.clearTemplateDraft(committed.id)
    dispatch({ type: 'markSaved', template: committed })
  }

  function handleDiscard() {
    repository.clearTemplateDraft(state.template.id)
    dispatch({ type: 'discard' })
  }

  function handleLeave() {
    // A never-committed (brand-new) template that's abandoned has no list entry
    // to ever resurface it, so discard its draft on leave. For an already-saved
    // template we keep the draft so unsaved edits survive returning to it.
    const existing = repository.getTemplate(state.template.id)
    const isCommitted = existing.ok && existing.value !== null
    if (!isCommitted) repository.clearTemplateDraft(state.template.id)
    void navigate('/')
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
        <button
          type="button"
          onClick={handleLeave}
          className="shrink-0 text-sm font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          ← Templates
        </button>
        <input
          aria-label="Template title"
          value={state.template.title}
          onChange={(event) => dispatch({ type: 'setTitle', title: event.target.value })}
          placeholder="Untitled form"
          className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-lg font-semibold text-gray-900 hover:border-gray-200 focus:border-blue-500 focus:outline-none"
        />
        <AutosaveStatusPill
          status={autosave.status}
          lastSavedAt={autosave.lastSavedAt}
          onRetry={autosave.retry}
        />
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          disabled={!isDirty}
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 enabled:hover:bg-gray-100 disabled:opacity-40"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty}
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white enabled:hover:bg-blue-700 disabled:opacity-40"
        >
          Save
        </button>
      </header>

      {state.showValidation && errorIssues.length > 0 && (
        <div
          role="alert"
          className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"
        >
          <p className="font-medium">Fix these problems before saving:</p>
          <ul className="mt-1 list-inside list-disc">
            {errorIssues.map((issue) => (
              <li key={`${issue.fieldId ?? 'form'}-${issue.conditionId ?? issue.code}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <QuotaRecoveryDialog
        open={quotaOpen}
        onClose={() => setQuotaOpen(false)}
        onRetry={() => {
          setQuotaOpen(false)
          autosave.retry()
        }}
        exportData={state.template}
        exportFilename={`${state.template.title || 'template'}.json`}
      />

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={state.template.title || 'Untitled form'}
      >
        <PreviewBody fields={state.template.fields} />
      </Modal>
    </>
  )
}
