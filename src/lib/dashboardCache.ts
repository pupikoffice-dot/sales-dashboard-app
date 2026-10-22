/**
 * Dashboard downloads kept on this device (IndexedDB), encrypted (see cacheCrypto.ts), so reopening the app shows
 * numbers at once while fresh data loads in the background, and older years are not downloaded twice.
 *
 * Two kinds of entry, both keyed by user id:
 *   base       the current + previous year (and the other tables), shown at once on reopen; ignored after 48 h
 *   year:<y>   one older year; kept while its fingerprint (row count + last sync time from the database) is unchanged
 *
 * Everything is wiped when the signed-in user changes or signs out (AuthContext). Every call is best-effort:
 * private windows, blocked storage, no key or quota errors just mean no cache.
 */
import { forgetCacheKey, getCacheKey, open, seal, type Sealed } from './cacheCrypto'

const DB_NAME = 'dashboard-cache'
const STORE = 'kv'
/** Bump when the stored shape changes; older entries (plain text in v1) are then ignored and removed. */
const SCHEMA = 2
/** Older than this, the saved base copy is not shown at all. */
export const CACHE_MAX_AGE_MS = 48 * 60 * 60 * 1000

interface Envelope {
  schema: number
  userId: string
  savedAt: number
  fingerprint?: string
  sealed: Sealed
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function run<R>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<R> | void): Promise<R | null> {
  return openDb().then(
    db =>
      new Promise<R | null>(resolve => {
        if (!db) return resolve(null)
        try {
          const tx = db.transaction(STORE, mode)
          const req = fn(tx.objectStore(STORE))
          tx.oncomplete = () => {
            db.close()
            resolve(req ? (req.result as R) : null)
          }
          tx.onerror = tx.onabort = () => {
            db.close()
            resolve(null)
          }
        } catch {
          db.close()
          resolve(null)
        }
      }),
  )
}

const baseKey = (userId: string) => `dashboard:${userId}`
const yearKey = (userId: string, year: number) => `year:${userId}:${year}`

async function readEntry<T>(userId: string, key: string): Promise<{ value: T; savedAt: number; fingerprint?: string } | null> {
  const env = await run<Envelope | undefined>('readonly', s => s.get(key))
  if (!env || env.schema !== SCHEMA || env.userId !== userId || !env.sealed) return null
  const k = await getCacheKey(userId)
  if (!k) return null
  try {
    return { value: await open<T>(k, env.sealed), savedAt: env.savedAt, fingerprint: env.fingerprint }
  } catch {
    return null // wrong key or damaged entry
  }
}

let askedToPersist = false

async function writeEntry(userId: string, key: string, value: unknown, fingerprint?: string): Promise<void> {
  const k = await getCacheKey(userId)
  if (!k) return
  let sealed: Sealed
  try {
    sealed = await seal(k, value)
  } catch {
    return
  }
  const env: Envelope = { schema: SCHEMA, userId, savedAt: Date.now(), fingerprint, sealed }
  await run('readwrite', s => {
    // one user per device at a time: drop another user's entries and any old plain-text (schema 1) entry
    const cursorReq = s.openCursor()
    cursorReq.onsuccess = () => {
      const cur = cursorReq.result
      if (!cur) return
      const v = cur.value as Partial<Envelope> | undefined
      if (!v || v.schema !== SCHEMA || v.userId !== userId) cur.delete()
      cur.continue()
    }
    s.put(env, key)
  })
  if (!askedToPersist) {
    askedToPersist = true
    try {
      // ask the browser not to evict the history under storage pressure (no-op where unsupported)
      void navigator.storage?.persist?.()
    } catch {
      /* ignore */
    }
  }
}

export async function readDashboardCache<T>(userId: string): Promise<{ value: T; savedAt: number } | null> {
  const hit = await readEntry<T>(userId, baseKey(userId))
  if (!hit || Date.now() - hit.savedAt > CACHE_MAX_AGE_MS) return null
  return { value: hit.value, savedAt: hit.savedAt }
}

export async function writeDashboardCache<T>(userId: string, value: T): Promise<void> {
  await writeEntry(userId, baseKey(userId), value)
}

/** An older year kept on this device, or null when it is missing or its fingerprint no longer matches. */
export async function readYearCache<T>(userId: string, year: number, fingerprint: string): Promise<T | null> {
  const hit = await readEntry<T>(userId, yearKey(userId, year))
  return hit && hit.fingerprint === fingerprint ? hit.value : null
}

export async function writeYearCache(userId: string, year: number, value: unknown, fingerprint: string): Promise<void> {
  await writeEntry(userId, yearKey(userId, year), value, fingerprint)
}

export async function clearDashboardCache(): Promise<void> {
  forgetCacheKey()
  await run('readwrite', s => s.clear())
}
