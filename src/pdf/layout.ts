import { textWidth } from './helveticaWidths'

/** Hard-breaks a single word that is wider than `maxWidth` into fitting chunks. */
function breakLongWord(word: string, fontSize: number, bold: boolean, maxWidth: number): string[] {
  const chunks: string[] = []
  let current = ''
  for (const ch of word) {
    const candidate = current + ch
    if (current !== '' && textWidth(candidate, fontSize, bold) > maxWidth) {
      chunks.push(current)
      current = ch
    } else {
      current = candidate
    }
  }
  if (current !== '') chunks.push(current)
  return chunks.length > 0 ? chunks : ['']
}

/**
 * Wraps `text` to lines no wider than `maxWidth` points, measuring with the
 * Helvetica metrics. Honors explicit newlines, greedily packs words, and
 * hard-breaks any single word too long to fit on its own line.
 */
export function wrapText(
  text: string,
  fontSize: number,
  bold: boolean,
  maxWidth: number,
): string[] {
  const out: string[] = []

  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter((word) => word.length > 0)
    if (words.length === 0) {
      out.push('')
      continue
    }

    let line = ''
    for (const word of words) {
      if (textWidth(word, fontSize, bold) > maxWidth) {
        if (line !== '') {
          out.push(line)
        }
        const chunks = breakLongWord(word, fontSize, bold, maxWidth)
        for (const chunk of chunks.slice(0, -1)) out.push(chunk)
        line = chunks[chunks.length - 1] ?? ''
        continue
      }

      if (line === '') {
        line = word
      } else if (textWidth(`${line} ${word}`, fontSize, bold) <= maxWidth) {
        line = `${line} ${word}`
      } else {
        out.push(line)
        line = word
      }
    }
    if (line !== '') out.push(line)
  }

  return out
}
