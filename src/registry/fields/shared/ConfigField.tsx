import type { ReactNode } from 'react'

interface ConfigFieldProps {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}

/** A labeled row inside a field's right-panel ConfigEditor. */
export function ConfigField({ label, htmlFor, hint, children }: ConfigFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-gray-700">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
