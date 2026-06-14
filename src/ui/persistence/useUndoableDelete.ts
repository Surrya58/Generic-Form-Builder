import { useCallback, useEffect, useRef, useState } from 'react'
import type { Repository } from '../../persistence'

/** How long the Undo affordance stays available before the deletion is purged. */
export const UNDO_WINDOW_MS = 6000

export interface PendingDeletion {
  message: string
  /** fb:trash entry ids created by the deletion, restored on undo or purged on expiry. */
  entryIds: string[]
}

export interface UndoableDelete {
  pending: PendingDeletion | null
  /**
   * Runs `perform` — which deletes records (each delete pushes an fb:trash
   * entry) and returns the ids of the entries it created — then opens the
   * ~6s undo window. Restoring those entries undoes the whole cascade.
   */
  run: (perform: () => string[], message: string) => void
  undo: () => void
  dismiss: () => void
}

/**
 * Backs the safe-reversible cascade delete: a deletion is staged into
 * fb:trash, an Undo toast is shown, and the trash entries are restored on
 * undo or purged when the window expires (or another delete happens).
 */
export function useUndoableDelete(repository: Repository, onAfterChange: () => void): UndoableDelete {
  const [pending, setPending] = useState<PendingDeletion | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<PendingDeletion | null>(null)
  useEffect(() => {
    pendingRef.current = pending
  }, [pending])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const purge = useCallback(
    (entryIds: string[]) => {
      for (const id of entryIds) repository.purgeTrash(id)
    },
    [repository],
  )

  useEffect(() => clearTimer, [clearTimer])

  const run = useCallback(
    (perform: () => string[], message: string) => {
      clearTimer()
      // A still-pending deletion's window ends as soon as another delete happens.
      if (pendingRef.current) purge(pendingRef.current.entryIds)

      const entryIds = perform()
      setPending({ message, entryIds })
      onAfterChange()

      timerRef.current = setTimeout(() => {
        purge(entryIds)
        setPending(null)
        timerRef.current = null
      }, UNDO_WINDOW_MS)
    },
    [clearTimer, purge, onAfterChange],
  )

  const undo = useCallback(() => {
    clearTimer()
    const current = pendingRef.current
    if (!current) return
    for (const id of current.entryIds) repository.restoreFromTrash(id)
    setPending(null)
    onAfterChange()
  }, [clearTimer, repository, onAfterChange])

  const dismiss = useCallback(() => {
    clearTimer()
    const current = pendingRef.current
    if (!current) return
    purge(current.entryIds)
    setPending(null)
  }, [clearTimer, purge])

  return { pending, run, undo, dismiss }
}
