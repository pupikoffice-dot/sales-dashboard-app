import type { LogicalCompany } from '../types/dashboard'

const STORAGE_PREFIX = 'oversight-co-filter:'

export function readOversightCompanyFilter(
  userId: string,
  allowed: LogicalCompany[],
): Set<LogicalCompany> {
  if (allowed.length === 0) return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId)
    if (!raw) return new Set(allowed)
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set(allowed)
    const allowedSet = new Set(allowed)
    const picked = parsed.filter((id): id is LogicalCompany => allowedSet.has(id as LogicalCompany))
    return picked.length > 0 ? new Set(picked) : new Set(allowed)
  } catch {
    return new Set(allowed)
  }
}

export function writeOversightCompanyFilter(userId: string, selected: Set<LogicalCompany>): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify([...selected]))
  } catch {
    /* ignore quota / private mode */
  }
}
