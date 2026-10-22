// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { open, seal } from './cacheCrypto'

async function newKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

describe('cacheCrypto', () => {
  it('round-trips a value and stores nothing readable', async () => {
    const key = await newKey()
    const value = { rows: [{ client: 'Secret Client Ltd', cash: 12345.5 }], note: 'לקוח' }
    const sealed = await seal(key, value)
    const bytes = new TextDecoder('latin1').decode(sealed.data)
    expect(bytes).not.toContain('Secret Client')
    expect(await open(key, sealed)).toEqual(value)
  })

  it('uses a new IV each time, so equal data never gives equal bytes', async () => {
    const key = await newKey()
    const a = await seal(key, { x: 1 })
    const b = await seal(key, { x: 1 })
    expect(Array.from(a.iv)).not.toEqual(Array.from(b.iv))
  })

  it('refuses the wrong key or changed data', async () => {
    const sealed = await seal(await newKey(), { x: 1 })
    await expect(open(await newKey(), sealed)).rejects.toBeTruthy()
    const tampered = new Uint8Array(sealed.data.slice(0))
    tampered[tampered.length - 1] ^= 1
    const key = await newKey()
    const ok = await seal(key, { x: 1 })
    const bad = new Uint8Array(ok.data.slice(0))
    bad[0] ^= 1
    await expect(open(key, { iv: ok.iv, data: bad.buffer })).rejects.toBeTruthy()
  })
})
