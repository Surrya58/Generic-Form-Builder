import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * An accessible modal dialog built on the native <dialog> element.
 *
 * Focus handling is implemented explicitly (not left to the browser)
 * so it behaves identically across browsers and in tests: opening
 * moves focus inside the dialog and remembers what was focused before;
 * closing restores it. Tab/Shift+Tab are trapped within the dialog, and
 * Escape or a click on the backdrop both close it via `onClose`.
 */
export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal()
    } else {
      dialog.open = true
    }

    const focusTarget = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? dialog
    focusTarget.focus()

    return () => {
      if (typeof dialog.close === 'function') {
        if (dialog.open) dialog.close()
      } else {
        dialog.open = false
      }
      previouslyFocused.current?.focus()
      previouslyFocused.current = null
    }
  }, [open])

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return

    const dialog = dialogRef.current
    if (!dialog) return

    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (!first || !last) return

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) onClose()
  }

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      className={`w-full max-w-lg rounded-lg p-0 shadow-xl backdrop:bg-black/50 ${className ?? ''}`}
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          ×
        </button>
      </div>
      <div className="max-h-[70vh] overflow-auto p-4">{children}</div>
    </dialog>
  )
}
