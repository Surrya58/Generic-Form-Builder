import {
  computeAll,
  getEffectiveValues,
  resolve,
  type FormInstance,
  type TemplateSnapshot,
} from '../domain'
import { withField } from '../registry'
import { wrapText } from './layout'
import { escapePdfText } from './pdfString'

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN = 56
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const TITLE_SIZE = 18
const META_SIZE = 10
const LABEL_SIZE = 11
const VALUE_SIZE = 11
const NOTE_SIZE = 9

const SECTION_HEADING_SIZE: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
}

interface Line {
  text: string
  size: number
  bold: boolean
  /** Extra space (points) above this line, on top of normal leading. */
  gapBefore: number
}

interface PositionedLine {
  text: string
  size: number
  bold: boolean
  x: number
  y: number
}

function leading(size: number): number {
  return size * 1.35
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
}

/** Appends `text` to `lines`, wrapped to the content width. */
function pushText(lines: Line[], text: string, size: number, bold: boolean, gapBefore: number): void {
  const wrapped = wrapText(text, size, bold, CONTENT_WIDTH)
  wrapped.forEach((line, index) => {
    lines.push({ text: line, size, bold, gapBefore: index === 0 ? gapBefore : size * 0.2 })
  })
}

/** Builds the ordered, pre-wrapped lines for a submitted instance. */
function buildLines(snapshot: TemplateSnapshot, values: Record<string, unknown>, submittedAt: string): Line[] {
  const lines: Line[] = []
  pushText(lines, snapshot.title || 'Untitled form', TITLE_SIZE, true, 0)
  pushText(lines, `Submitted ${formatTimestamp(submittedAt)}`, META_SIZE, false, 4)

  const { states } = resolve(snapshot.fields, values)
  const effective = getEffectiveValues(snapshot.fields, values, states)
  const calc = computeAll(snapshot.fields, effective)

  for (const field of snapshot.fields) {
    if (!states.get(field.id)?.visible) continue

    if (field.type === 'sectionHeader') {
      pushText(lines, field.label, SECTION_HEADING_SIZE[field.config.size], true, 18)
      continue
    }

    const value = field.type === 'calculation' ? (calc.get(field.id) ?? null) : values[field.id]
    const rows = withField(field, (typedField, definition) =>
      definition.toPdfRows(typedField, value),
    )
    for (const row of rows) {
      pushText(lines, row.label, LABEL_SIZE, true, 12)
      pushText(lines, row.value === '' ? '—' : row.value, VALUE_SIZE, false, 2)
    }

    if (field.type === 'fileUpload') {
      pushText(lines, 'File contents are not included in this export.', NOTE_SIZE, false, 2)
    }
  }

  return lines
}

/** Splits lines into pages, assigning each an absolute (x, y) baseline. */
function paginate(lines: Line[]): PositionedLine[][] {
  const pages: PositionedLine[][] = []
  let current: PositionedLine[] = []
  let y = PAGE_HEIGHT - MARGIN

  for (const line of lines) {
    const advance = line.gapBefore + leading(line.size)
    if (y - advance < MARGIN && current.length > 0) {
      pages.push(current)
      current = []
      y = PAGE_HEIGHT - MARGIN
    }
    y -= advance
    current.push({ text: line.text, size: line.size, bold: line.bold, x: MARGIN, y })
  }

  if (current.length > 0) pages.push(current)
  return pages.length > 0 ? pages : [[]]
}

/** Renders one page's text-drawing operators. */
function pageContent(lines: PositionedLine[]): string {
  let stream = ''
  for (const line of lines) {
    if (line.text === '') continue
    const font = line.bold ? '/F2' : '/F1'
    stream += `BT\n${font} ${String(line.size)} Tf\n${String(line.x)} ${String(round(line.y))} Td\n(${escapePdfText(line.text)}) Tj\nET\n`
  }
  return stream
}

/** Serializes pages into a complete PDF 1.7 document string (ASCII only). */
function serialize(pages: PositionedLine[][]): string {
  const pageObjNum = (i: number): number => 5 + i * 2
  const contentObjNum = (i: number): number => 6 + i * 2

  const objects: { num: number; body: string }[] = [
    { num: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    {
      num: 2,
      body: `<< /Type /Pages /Kids [${pages.map((_, i) => `${String(pageObjNum(i))} 0 R`).join(' ')}] /Count ${String(pages.length)} >>`,
    },
    { num: 3, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
    {
      num: 4,
      body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    },
  ]

  pages.forEach((linesOnPage, i) => {
    objects.push({
      num: pageObjNum(i),
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${String(PAGE_WIDTH)} ${String(PAGE_HEIGHT)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${String(contentObjNum(i))} 0 R >>`,
    })
    const content = pageContent(linesOnPage)
    objects.push({
      num: contentObjNum(i),
      body: `<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`,
    })
  })

  objects.sort((a, b) => a.num - b.num)
  const maxNum = Math.max(...objects.map((object) => object.num))

  let pdf = '%PDF-1.7\n'
  const offsets: number[] = []
  for (const object of objects) {
    offsets[object.num] = pdf.length
    pdf += `${String(object.num)} 0 obj\n${object.body}\nendobj\n`
  }

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${String(maxNum + 1)}\n`
  pdf += '0000000000 65535 f \n'
  for (let num = 1; num <= maxNum; num += 1) {
    const offset = offsets[num] ?? 0
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${String(maxNum + 1)} /Root 1 0 R >>\nstartxref\n${String(xrefOffset)}\n%%EOF\n`

  return pdf
}

/**
 * Builds the bytes of a submitted instance's PDF. Visible fields are recomputed
 * from the instance's own `templateSnapshot` + stored values via the condition
 * engine, so re-downloads stay faithful even after the live template changes.
 */
export function buildInstancePdfString(instance: FormInstance): string {
  const lines = buildLines(instance.templateSnapshot, instance.values, instance.submittedAt)
  return serialize(paginate(lines))
}

export function buildInstancePdfBytes(instance: FormInstance): Uint8Array {
  return new TextEncoder().encode(buildInstancePdfString(instance))
}

export function buildInstancePdf(instance: FormInstance): Blob {
  // The document is ASCII, so a string BlobPart yields identical bytes and
  // avoids the Uint8Array/SharedArrayBuffer BlobPart typing friction.
  return new Blob([buildInstancePdfString(instance)], { type: 'application/pdf' })
}

/** Triggers a browser download of the instance's PDF. Never persisted. */
export function downloadInstancePdf(instance: FormInstance, filename: string): void {
  const url = URL.createObjectURL(buildInstancePdf(instance))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
