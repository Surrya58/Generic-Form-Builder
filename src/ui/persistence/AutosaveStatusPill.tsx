import { assertNever } from '../../domain'
import type { AutosaveStatus } from '../../persistence/autosave'

export interface AutosaveStatusPillProps {
  status: AutosaveStatus
  lastSavedAt: Date | null
  onRetry?: () => void
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Compact, always-visible indicator of the autosave state, shown in the Builder header. */
export function AutosaveStatusPill({ status, lastSavedAt, onRetry }: AutosaveStatusPillProps) {
  if (status === 'failed') {
    return (
      <div role="status" className="flex items-center gap-2 text-sm text-red-600">
        <span>Save failed</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="font-medium underline hover:no-underline"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  const label = ((): string => {
    switch (status) {
      case 'idle':
        return lastSavedAt ? `Saved ${formatTime(lastSavedAt)}` : 'No changes yet'
      case 'editing':
        return 'Unsaved changes'
      case 'saving':
        return 'Saving…'
      case 'saved':
        return lastSavedAt ? `Saved ${formatTime(lastSavedAt)}` : 'Saved'
      default:
        return assertNever(status)
    }
  })()

  return (
    <div role="status" className="text-sm text-gray-500">
      {label}
    </div>
  )
}
