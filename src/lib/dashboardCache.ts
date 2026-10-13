/**
 * Last dashboard download kept on this device (IndexedDB), so reopening the app
 * shows numbers at once while fresh data loads in the background.
 *
 * Keyed by user id. Everything is wiped when the signed-in user changes or
 * signs out (AuthContext). Every call is best-effort: private windows, blocked
 * storage or quota errors just mean no cache.
 */
const DB_NAME = 'dashboard-cache'
const STORE = 'kv'
/** Bump when the stored shape changes; older entries are then ignored. */
const SCHEMA = 1
/** Older than this, the saved copy is not shown at all. */
export const CACHE_MAX_AGE_MS = 48 * 60 * 60 * 1000

interface Envelope<T> {
  schema: number
  userId: string
  savedAt: number
  value: T
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

const keyFor = (userId: string) => `dashboard:${userId}`

export async function readDashboardCache<T>(userId: string): Promise<{ value: T; savedAt: number } | null> {
  const env = await run<Envelope<T> | undefined>('readonly', s => s.get(keyFor(userId)))
  if (!env || env.schema !== SCHEMA || env.userId !== userId) return null
  if (Date.now() - env.savedAt > CACHE_MAX_AGE_MS) return null
  return { value: env.value, savedAt: env.savedAt }
}

export async function writeDashboardCache<T>(userId: string, value: T, savedAt = Date.now()): Promise<void> {
  const env: Envelope<T> = { schema: SCHEMA, userId, savedAt, value }
  await run('readwrite', s => {
    s.clear() // one user per device at a time
    s.put(env, keyFor(userId))
  })
}

export async function clearDashboardCache(): Promise<void> {
  await run('readwrite', s => s.clear())
}
