import { useRef } from 'react'
import type { KeyboardEvent } from 'react'

export interface RovingOptionGroupOption {
  id: string
  label: string
}

interface RovingOptionGroupProps {
  options: RovingOptionGroupOption[]
  value: string | null
  onChange: (value: string) => void
  /** Both variants share identical selection semantics and keyboard model. */
  variant?: 'radio' | 'tiles'
  disabled?: boolean
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-required'?: boolean
  'aria-invalid'?: boolean
}

const ARROW_KEYS = new Set(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'])

/**
 * A `role="radiogroup"` of `role="radio"` buttons with roving tabindex:
 * only the selected option (or the first, if none is selected) is
 * tabbable, and arrow/Home/End keys move focus AND selection together,
 * matching native radio button behavior.
 */
export function RovingOptionGroup({
  options,
  value,
  onChange,
  variant = 'radio',
  disabled = false,
  ...aria
}: RovingOptionGroupProps) {
  const itemRefs = useRef(new Map<string, HTMLButtonElement>())
  const tabStopId = value ?? options[0]?.id

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!ARROW_KEYS.has(event.key)) return
    event.preventDefault()

    let nextIndex: number
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % options.length
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + options.length) % options.length
        break
      case 'Home':
        nextIndex = 0
        break
      default:
        nextIndex = options.length - 1
        break
    }

    const next = options[nextIndex]
    if (!next) return
    itemRefs.current.get(next.id)?.focus()
    onChange(next.id)
  }

  return (
    <div
      role="radiogroup"
      className={variant === 'tiles' ? 'flex flex-wrap gap-2' : 'flex flex-col gap-2'}
      {...aria}
    >
      {options.map((option, index) => {
        const checked = option.id === value
        return (
          <button
            key={option.id}
            ref={(element) => {
              if (element) itemRefs.current.set(option.id, element)
              else itemRefs.current.delete(option.id)
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={option.id === tabStopId ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={
              variant === 'tiles'
                ? `rounded-md border px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    checked
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  } disabled:cursor-not-allowed disabled:opacity-50`
                : `flex items-center gap-2 rounded-md px-2 py-1 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    checked ? 'font-medium text-blue-700' : 'text-gray-700'
                  } disabled:cursor-not-allowed disabled:opacity-50`
            }
          >
            {variant === 'radio' && (
              <span
                aria-hidden="true"
                className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  checked ? 'border-blue-600' : 'border-gray-400'
                }`}
              >
                {checked && <span className="h-2 w-2 rounded-full bg-blue-600" />}
              </span>
            )}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
