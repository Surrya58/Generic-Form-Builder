/**
 * Escapes a string for use inside a PDF literal string `( … )`: backslash and
 * parentheses are escaped, and any non-printable / non-ASCII character is
 * replaced with `?` so the byte stream stays valid WinAnsi (the base-14 fonts
 * have no glyphs for them anyway).
 */
export function escapePdfText(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const code = text.charCodeAt(i)
    if (ch === '\\') out += '\\\\'
    else if (ch === '(') out += '\\('
    else if (ch === ')') out += '\\)'
    else if (code >= 32 && code <= 126) out += ch
    else out += '?'
  }
  return out
}
