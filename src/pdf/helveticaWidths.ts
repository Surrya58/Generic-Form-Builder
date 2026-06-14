/**
 * Helvetica / Helvetica-Bold glyph advance widths (per 1000 em units) for
 * printable ASCII (codes 32–126), straight from the base-14 AFM metrics.
 * Used to wrap text to the page width without embedding or measuring fonts.
 */
const HELVETICA: readonly number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]

const HELVETICA_BOLD: readonly number[] = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]

/** Advance width (per 1000 units) of a single character code. */
function charWidth(code: number, bold: boolean): number {
  const table = bold ? HELVETICA_BOLD : HELVETICA
  // Unknown/non-ASCII glyphs render as '?' (code 63); use its width.
  const index = code >= 32 && code <= 126 ? code - 32 : 63 - 32
  return table[index] ?? 556
}

/** Width of `text` in points at `fontSize`, summing per-glyph advances. */
export function textWidth(text: string, fontSize: number, bold: boolean): number {
  let units = 0
  for (let i = 0; i < text.length; i += 1) {
    units += charWidth(text.charCodeAt(i), bold)
  }
  return (units / 1000) * fontSize
}
