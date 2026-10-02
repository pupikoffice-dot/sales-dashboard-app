/**
 * Strip markdown/table syntax so TTS does not read pipes, separators, or code fences.
 * Keeps non-table prose (e.g. intro sentences above a table).
 */
export function stripMarkdownForSpeech(text: string): string {
  let s = text.replace(/```[\s\S]*?```/g, ' ')

  const lines = s.split('\n')
  const out: string[] = []
  let inTable = false

  for (const line of lines) {
    const t = line.trim()
    const looksLikePipeRow = /^\|/.test(t) && t.includes('|')
    const looksLikeSep =
      /^\|[\s\-:|]+\|?\s*$/.test(t) || (/^[\s\-:|]+$/.test(t) && /-/.test(t) && /\|/.test(t))

    if (looksLikeSep && inTable) {
      continue
    }
    if (looksLikePipeRow) {
      inTable = true
      continue
    }
    if (inTable && t === '') {
      inTable = false
      continue
    }
    if (inTable && !looksLikePipeRow && !looksLikeSep) {
      inTable = false
    }
    out.push(line)
  }

  s = out.join('\n')
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/__([^_]+)__/g, '$1')
  s = s.replace(/[*_`#>|]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()

  if (!s) {
    return 'התשובה כוללת טבלה; עיין במסך.'
  }
  return s
}
