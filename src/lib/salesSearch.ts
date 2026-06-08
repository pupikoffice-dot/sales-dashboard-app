export function matchesSearch(query: string, ...parts: (string | undefined | null)[]): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return true
  return parts.some(p => p != null && String(p).toLowerCase().includes(q))
}
