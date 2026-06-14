export interface UndoToastProps {
  message: string
  onUndo: () => void
  onDismiss: () => void
}

/** Transient bottom toast offering to undo a just-completed deletion. */
export function UndoToast({ message, onUndo, onDismiss }: UndoToastProps) {
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[90vw] items-center gap-4 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="font-semibold text-blue-300 hover:text-blue-200"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-lg leading-none text-gray-400 hover:text-white"
      >
        ×
      </button>
    </div>
  )
}
