import type { SVGProps } from 'react'

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1.25em"
      height="1.25em"
      aria-hidden="true"
      {...props}
    />
  )
}

export function SingleLineTextIcon() {
  return (
    <Icon>
      <path d="M4 7h16M4 12h10" />
    </Icon>
  )
}

export function MultiLineTextIcon() {
  return (
    <Icon>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </Icon>
  )
}

export function NumberIcon() {
  return (
    <Icon>
      <path d="M5 4 3 20M15 4l-2 16M3 9h18M2 15h18" />
    </Icon>
  )
}

export function DateIcon() {
  return (
    <Icon>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </Icon>
  )
}

export function SingleSelectIcon() {
  return (
    <Icon>
      <circle cx="6" cy="7" r="2" />
      <circle cx="6" cy="17" r="2" />
      <path d="M12 7h8M12 17h8" />
    </Icon>
  )
}

export function MultiSelectIcon() {
  return (
    <Icon>
      <rect x="4" y="4" width="5" height="5" rx="1" />
      <rect x="4" y="15" width="5" height="5" rx="1" />
      <path d="M5.5 6.5 7 8l1.5-2.5M12 6.5h8M12 17.5h8" />
    </Icon>
  )
}

export function FileUploadIcon() {
  return (
    <Icon>
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Icon>
  )
}

export function SectionHeaderIcon() {
  return (
    <Icon>
      <path d="M4 5v14M14 5v14M4 12h10" />
      <path d="M17 9h3v10M17 19h6" />
    </Icon>
  )
}

export function CalculationIcon() {
  return (
    <Icon>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v3M8 19h.01M12 19h.01" />
    </Icon>
  )
}
