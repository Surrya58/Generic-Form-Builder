import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { FormInstance } from '../../domain'
import type { Repository } from '../../persistence'
import { downloadInstancePdf } from '../../pdf'
import { UndoToast, useRepository, useUndoableDelete } from '../persistence'
import { VirtualList } from '../primitives/VirtualList'
import { NotFoundScreen } from './NotFoundScreen'

// Past this many responses the list virtualizes; below it, natural flow layout.
const VIRTUALIZE_THRESHOLD = 30
const ROW_HEIGHT = 56

function loadInstances(repository: Repository, templateId: string): FormInstance[] {
  const result = repository.listInstances(templateId)
  if (!result.ok) return []
  return [...result.value].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

function trashIds(repository: Repository): string[] {
  const result = repository.listTrash()
  return result.ok ? result.value.map((entry) => entry.id) : []
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function sanitizeFilename(name: string): string {
  const cleaned = name.trim().replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '')
  return cleaned.length > 0 ? cleaned : 'response'
}

export function InstancesListScreen() {
  const { templateId } = useParams<{ templateId: string }>()
  const repository = useRepository()
  const navigate = useNavigate()
  const location = useLocation()
  const justSubmitted = (location.state as { justSubmitted?: string } | null)?.justSubmitted ?? null

  const [meta] = useState(() => {
    if (!templateId) return null
    const result = repository.getTemplate(templateId)
    return { title: result.ok && result.value ? result.value.title : '' }
  })
  const [instances, setInstances] = useState(() =>
    templateId ? loadInstances(repository, templateId) : [],
  )
  const deleter = useUndoableDelete(repository, () =>
    setInstances(templateId ? loadInstances(repository, templateId) : []),
  )

  if (!templateId || !meta) return <NotFoundScreen />

  const tid = templateId
  const title = meta.title || 'Untitled form'

  function removeInstance(instance: FormInstance) {
    deleter.run(() => {
      const before = new Set(trashIds(repository))
      repository.deleteInstance(tid, instance.id)
      return trashIds(repository).filter((id) => !before.has(id))
    }, 'Response deleted.')
  }

  function rowContent(instance: FormInstance): ReactNode {
    return (
      <>
        <span className="text-sm text-gray-700">{formatDateTime(instance.submittedAt)}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => downloadInstancePdf(instance, `${sanitizeFilename(title)}.pdf`)}
            className="rounded-md px-2 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => removeInstance(instance)}
            aria-label={`Delete response from ${formatDateTime(instance.submittedAt)}`}
            className="rounded-md px-2 py-1 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600"
          >
            Delete
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link
        to="/"
        className="text-sm font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        ← Forms
      </Link>
      <header className="mb-6 mt-2 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">
            {instances.length} {instances.length === 1 ? 'response' : 'responses'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void navigate(`/fill/${tid}/${crypto.randomUUID()}`)
          }}
          className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New response
        </button>
      </header>

      {instances.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center text-gray-600">
          No responses yet.
        </div>
      ) : instances.length > VIRTUALIZE_THRESHOLD ? (
        <VirtualList
          items={instances}
          rowHeight={ROW_HEIGHT}
          height={Math.min(560, instances.length * ROW_HEIGHT)}
          getKey={(instance) => instance.id}
          aria-label="Responses"
          className="rounded-lg border border-gray-200"
          renderItem={(instance) => (
            <div
              className={`flex h-full items-center justify-between gap-4 border-b border-gray-100 px-4 ${
                instance.id === justSubmitted ? 'bg-green-50' : ''
              }`}
            >
              {rowContent(instance)}
            </div>
          )}
        />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {instances.map((instance) => (
            <li
              key={instance.id}
              className={`flex items-center justify-between gap-4 px-4 py-3 ${
                instance.id === justSubmitted ? 'bg-green-50' : ''
              }`}
            >
              {rowContent(instance)}
            </li>
          ))}
        </ul>
      )}

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
