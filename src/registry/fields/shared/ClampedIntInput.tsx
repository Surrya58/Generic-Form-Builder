import { useState } from 'react'
import { parseOptionalInt } from './parsing'

interface ClampedIntInputProps {
  id: string
  value: number
  min: number
  max: number
  onChange: (next: number) => void
  className?: string
}

/**
 * A number input for required, range-clamped integer config (e.g. visible
 * rows). Keeps its own draft text so the user can freely clear and retype;
 * out-of-range values are only clamped on blur.
 */
export function ClampedIntInput({
  id,
  value,
  min,
  max,
  onChange,
  className,
}: ClampedIntInputProps) {
  const [text, setText] = useState(String(value))

  function handleChange(raw: string) {
    setText(raw)
    const parsed = parseOptionalInt(raw)
    if (parsed !== undefined) onChange(parsed)
  }

  function handleBlur() {
    const clamped = Math.min(Math.max(value, min), max)
    setText(String(clamped))
    if (clamped !== value) onChange(clamped)
  }

  return (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      className={className}
      value={text}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
    />
  )
}
