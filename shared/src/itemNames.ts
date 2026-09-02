/** Keep the longest non-empty item label seen for a SKU (ERP exports vary by row). */
export function preferItemName(current: string, candidate: string | undefined | null): string {
  const next = String(candidate ?? '').trim()
  if (!next) return current
  if (!current.trim()) return next
  return next.length > current.length ? next : current
}
