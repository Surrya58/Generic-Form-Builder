import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Repository } from '../../persistence'
import { UndoToast, useRepository, useUndoableDelete } from '../persistence'
import { Modal } from '../primitives/Modal'

interface TemplateRow {
  id: string
  title: string
  updatedAt: string
  fieldCount: number
  instanceCount: number
}

function loadRows(repository: Repository): TemplateRow[] {
  const summaries = repository.listTemplateSummaries()
  if (!summaries.ok) return []
  return summaries.value
    .map((summary): TemplateRow => {
      const template = repository.getTemplate(summary.id)
      const instances = repository.listInstances(summary.id)
      return {
        id: summary.id,
        title: summary.title,
        updatedAt: summary.updatedAt,
        fieldCount: template.ok && template.value ? template.value.fields.length : 0,
        instanceCount: instances.ok ? instances.value.length : 0,
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function trashIds(repository: Repository): string[] {
  const result = repository.listTrash()
  return result.ok ? result.value.map((entry) => entry.id) : []
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function pluralize(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`
}

export function TemplatesListScreen() {
  const repository = useRepository()
  const navigate = useNavigate()
  const [rows, setRows] = useState(() => loadRows(repository))
  const [confirming, setConfirming] = useState<TemplateRow | null>(null)

  const refresh = () => setRows(loadRows(repository))
  const deleter = useUndoableDelete(repository, refresh)

  function newTemplate() {
    void navigate(`/builder/${crypto.randomUUID()}`)
  }

  function newResponse(templateId: string) {
    void navigate(`/fill/${templateId}/${crypto.randomUUID()}`)
  }

  function performDelete(row: TemplateRow) {
    setConfirming(null)
    deleter.run(() => {
      const before = new Set(trashIds(repository))
      const instances = repository.listInstances(row.id)
      if (instances.ok) {
        for (const instance of instances.value) repository.deleteInstance(row.id, instance.id)
      }
      repository.deleteTemplate(row.id)
      // The cascade pushed one trash entry per record; return the new ones so
      // Undo can restore the template and all its responses together.
      return trashIds(repository).filter((id) => !before.has(id))
    }, deleteMessage(row))
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Forms</h1>
        <button
          type="button"
          onClick={newTemplate}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New form
        </button>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-600">No forms yet.</p>
          <button
            type="button"
            onClick={newTemplate}
            className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create your first form
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => {
                  void navigate(`/builder/${row.id}`)
                }}
                className="flex-1 rounded-t-lg px-4 pb-3 pt-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <h2 className="truncate text-base font-semibold text-gray-900">
                  {row.title || 'Untitled form'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {`${pluralize(row.fieldCount, 'field')} · ${pluralize(row.instanceCount, 'response')}`}
                </p>
                <p className="mt-1 text-xs text-gray-400">Edited {formatDate(row.updatedAt)}</p>
              </button>
              <div className="flex items-center gap-1 border-t border-gray-100 px-2 py-2">
                <button
                  type="button"
                  onClick={() => newResponse(row.id)}
                  className="rounded-md px-2 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  New response
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void navigate(`/templates/${row.id}/instances`)
                  }}
                  className="rounded-md px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Responses
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(row)}
                  aria-label={`Delete ${row.title || 'Untitled form'}`}
                  className="ml-auto rounded-md px-2 py-1 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={confirming !== null} onClose={() => setConfirming(null)} title="Delete form?">
        {confirming && (
          <div className="space-y-4 text-sm text-gray-700">
            <p>
              Delete <strong>{confirming.title || 'Untitled form'}</strong>
              {confirming.instanceCount > 0 && (
                <>
                  {' '}
                  and its <strong>{pluralize(confirming.instanceCount, 'response')}</strong>
                </>
              )}
              ? You can undo for a few seconds.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="rounded-md px-3 py-2 font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => performDelete(confirming)}
                className="rounded-md bg-red-600 px-3 py-2 font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>

      {deleter.pending && (
        <UndoToast
          message={deleter.pending.message}
          onUndo={deleter.undo}
          onDismiss={deleter.dismiss}
        />
      )}
    </div>
  )
}

function deleteMessage(row: TemplateRow): string {
  const name = row.title || 'Untitled form'
  if (row.instanceCount === 0) return `Deleted "${name}".`
  return `Deleted "${name}" and ${pluralize(row.instanceCount, 'response')}.`
}
