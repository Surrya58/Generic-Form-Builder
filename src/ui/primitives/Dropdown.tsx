import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

export interface DropdownOption {
  id: string
  label: string
}

interface DropdownProps {
  id?: string
  options: DropdownOption[]
  value: string | null
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-required'?: boolean
  'aria-invalid'?: boolean
}

const TYPEAHEAD_RESET_MS = 500

/**
 * A select-style combobox (ARIA 1.2 combobox + listbox pattern) with
 * full keyboard support: ArrowUp/Down open the list and move the active
 * option, Home/End jump to the ends, Enter/Space commit, Escape closes
 * without changing the value, and typing does typeahead — selecting
 * immediately when closed (like a native `<select>`), or just moving
 * the active option when open.
 */
export function Dropdown({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  ...aria
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const typeaheadRef = useRef('')
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout>>()

  const selected = options.find((option) => option.id === value) ?? null

  useEffect(() => {
    return () => clearTimeout(typeaheadTimer.current)
  }, [])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function openList() {
    setActiveId(value ?? options[0]?.id ?? null)
    setOpen(true)
  }

  function commit(optionId: string) {
    onChange(optionId)
    setOpen(false)
  }

  function moveActive(delta: number) {
    if (options.length === 0) return
    const currentIndex = options.findIndex((option) => option.id === activeId)
    const nextIndex = (currentIndex + delta + options.length) % options.length
    setActiveId(options[nextIndex]?.id ?? null)
  }

  function handleTypeahead(char: string) {
    clearTimeout(typeaheadTimer.current)
    typeaheadRef.current += char.toLowerCase()

    const match = options.find((option) =>
      option.label.toLowerCase().startsWith(typeaheadRef.current),
    )
    if (match) {
      if (open) setActiveId(match.id)
      else onChange(match.id)
    }

    typeaheadTimer.current = setTimeout(() => {
      typeaheadRef.current = ''
    }, TYPEAHEAD_RESET_MS)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (open) moveActive(1)
        else openList()
        break
      case 'ArrowUp':
        event.preventDefault()
        if (open) moveActive(-1)
        else openList()
        break
      case 'Home':
        if (open) {
          event.preventDefault()
          setActiveId(options[0]?.id ?? null)
        }
        break
      case 'End':
        if (open) {
          event.preventDefault()
          setActiveId(options[options.length - 1]?.id ?? null)
        }
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (open) {
          if (activeId) commit(activeId)
        } else {
          openList()
        }
        break
      case 'Escape':
        if (open) {
          event.preventDefault()
          setOpen(false)
        }
        break
      default:
        if (event.key.length === 1 && event.key !== ' ') {
          handleTypeahead(event.key)
        }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && activeId ? `${listboxId}-${activeId}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        {...aria}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected?.label ?? placeholder}
        </span>
        <span aria-hidden="true" className="text-gray-400">
          ▾
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          id={listboxId}
          aria-label={aria['aria-labelledby'] ? undefined : placeholder}
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {options.map((option) => (
            <li
              key={option.id}
              id={`${listboxId}-${option.id}`}
              role="option"
              aria-selected={option.id === value}
              onPointerDown={(event) => {
                event.preventDefault()
                commit(option.id)
              }}
              onMouseEnter={() => setActiveId(option.id)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                option.id === activeId ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
              } ${option.id === value ? 'font-medium' : ''}`}
            >
              {option.label}
            </li>
          ))}
          {options.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">No options</li>}
        </ul>
      )}
    </div>
  )
}
