import { Modal } from '../primitives/Modal'
import { downloadJson } from './downloadJson'

export interface QuotaRecoveryDialogProps {
  open: boolean
  onClose: () => void
  onRetry: () => void
  /** The in-progress data to offer as a downloadable backup. */
  exportData: unknown
  /** Filename for the downloaded backup, e.g. "my-template.json". */
  exportFilename: string
}

/**
 * Shown when an autosave fails because browser storage is full. Lets the
 * user back up their unsaved work as a JSON file (so nothing is lost) and
 * either retry the save or dismiss to keep working in-memory.
 */
export function QuotaRecoveryDialog({
  open,
  onClose,
  onRetry,
  exportData,
  exportFilename,
}: QuotaRecoveryDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Storage is full">
      <div className="space-y-4 text-sm text-gray-700">
        <p>
          Your changes could not be saved because the browser&apos;s storage quota has been reached.
          Free up space by deleting old templates or form entries, then retry.
        </p>
        <p>
          In the meantime, you can download a backup of your current work so it isn&apos;t lost.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadJson(exportData, exportFilename)}
            className="rounded-md border border-gray-300 px-3 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            Download backup
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700"
          >
            Retry save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 font-medium text-gray-500 hover:bg-gray-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </Modal>
  )
}
