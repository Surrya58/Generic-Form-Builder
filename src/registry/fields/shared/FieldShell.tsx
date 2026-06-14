import type { ReactNode } from 'react'
import type { ValidationError } from '../../../domain'

export function hintId(id: string): string {
  return `${id}-hint`
}

export function errorId(id: string): string {
  return `${id}-error`
}

/** Builds an `aria-describedby` value referencing whichever of hint/error are present. */
export function describedBy(
  id: string,
  opts: { hasHint?: boolean; hasError?: boolean },
): string | undefined {
  const ids = [opts.hasHint && hintId(id), opts.hasError && errorId(id)].filter(
    (value): value is string => typeof value === 'string',
  )
  return ids.length > 0 ? ids.join(' ') : undefined
}

interface FieldShellProps {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: ValidationError | null
  children: ReactNode
  /**
   * 'label' (default) renders a real `<label htmlFor={id}>` for a single
   * focusable control. 'span' renders a plain labelled span with that same
   * `id`, for group controls (radiogroup, listbox) that take
   * `aria-labelledby` instead of `for`.
   */
  labelAs?: 'label' | 'span'
}

/**
 * The common label/input/hint/error layout shared by every FillRenderer.
 * The real label is always shown; a hint (e.g. a placeholder echoed
 * as text) is supplementary, never the only description of the field.
 */
export function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  children,
  labelAs = 'label',
}: FieldShellProps) {
  const LabelTag = labelAs === 'span' ? 'span' : 'label'
  return (
    <div className="flex flex-col gap-1">
      <LabelTag
        {...(labelAs === 'span' ? { id } : { htmlFor: id })}
        className="text-sm font-medium text-gray-900"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-600">
            *
          </span>
        )}
      </LabelTag>
      {children}
      {hint && !error && (
        <p id={hintId(id)} className="text-xs text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId(id)} role="alert" className="text-xs text-red-600">
          {error.message}
        </p>
      )}
    </div>
  )
}
