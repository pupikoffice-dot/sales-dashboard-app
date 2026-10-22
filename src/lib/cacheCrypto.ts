import { supabase } from './supabase'

/**
 * Encryption for the dashboard copy kept on this device.
 *
 * The key is a per-user random key held by the database (get_cache_key) and fetched after sign-in. It lives in
 * memory only and is never written to disk, so the stored copy cannot be read without a signed-in session, even
 * by someone who copies the browser's files. Data is gzip-compressed first, then AES-GCM encrypted with a fresh
 * random IV for every entry.
 */
export interface Sealed {
  iv: Uint8Array
  data: ArrayBuffer
}

let keyCache: { userId: string; key: Promise<CryptoKey | null> } | null = null

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function forgetCacheKey(): void {
  keyCache = null
}

/** The user's key, or null when it cannot be had (offline, no Web Crypto, inactive user): then nothing is cached. */
export function getCacheKey(userId: string): Promise<CryptoKey | null> {
  if (keyCache?.userId === userId) return keyCache.key
  const key = (async () => {
    try {
      if (typeof crypto === 'undefined' || !crypto.subtle) return null
      const { data, error } = await supabase.rpc('get_cache_key')
      if (error || typeof data !== 'string' || !data) return null
      return await crypto.subtle.importKey('raw', b64ToBytes(data), 'AES-GCM', false, ['encrypt', 'decrypt'])
    } catch {
      return null
    }
  })()
  keyCache = { userId, key }
  // a failed attempt must not stick for the whole session
  void key.then(k => {
    if (!k && keyCache?.key === key) keyCache = null
  })
  return key
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}

/** JSON-serialise, compress, encrypt. */
export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const raw = new TextEncoder().encode(JSON.stringify(value))
  const packed = typeof CompressionStream !== 'undefined' ? await pipe(raw, new CompressionStream('gzip')) : raw
  const flag = new Uint8Array([typeof CompressionStream !== 'undefined' ? 1 : 0])
  const body = new Uint8Array(flag.length + packed.length)
  body.set(flag, 0)
  body.set(packed, flag.length)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, body as BufferSource)
  return { iv, data }
}

/** Decrypt, decompress, parse. Throws when the key is wrong or the data was changed. */
export async function open<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const body = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv as BufferSource }, key, sealed.data),
  )
  const packed = body.subarray(1)
  const raw = body[0] === 1 ? await pipe(packed, new DecompressionStream('gzip')) : packed
  return JSON.parse(new TextDecoder().decode(raw)) as T
}
