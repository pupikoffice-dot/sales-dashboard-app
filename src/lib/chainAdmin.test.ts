import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createTranslator } from '../i18n'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('./supabase', () => ({ supabase: { rpc } }))

import { addSummary, parseClientNumbers, removeAllChainStores, removeAllConfirmText, removeAllResultText } from './chainAdmin'

describe('chain admin helpers', () => {
  it('reads client numbers from pasted text and drops duplicates', () => {
    expect(parseClientNumbers('2120700, 2120701\n2120700  2120702;')).toEqual(['2120700', '2120701', '2120702'])
    expect(parseClientNumbers('  \n ')).toEqual([])
  })
  it('summarises what was added and what was left out', () => {
    expect(addSummary({ added: 3 })).toBe('3 added')
    expect(addSummary({ added: 1, unknown: ['9'], inOtherChain: [{ id: '2', chain: 'MYST' }] })).toBe(
      '1 added · not found in this company: 9 · already in another chain (left as they are): 2 (MYST)',
    )
    expect(addSummary({ error: 'Unknown chain.' })).toBe('Unknown chain.')
  })
})

describe('remove all stores of a chain from one company', () => {
  const t = createTranslator('en')
  const he = createTranslator('he')

  it('confirmation states chain, company, exact count and that others are untouched', () => {
    const txt = removeAllConfirmText(t, 'Tsomet', 'Pupik', 63)
    expect(txt).toContain('all 63 stores of Tsomet from Pupik')
    expect(txt).toContain('only affects Pupik')
    expect(txt).toContain('other companies are not changed')
    const heTxt = removeAllConfirmText(he, 'צומת', 'פופיק', 63)
    expect(heTxt).toContain('63')
    expect(heTxt).toContain('צומת')
    expect(heTxt).toContain('פופיק')
  })
  it('result message carries the count and company', () => {
    expect(removeAllResultText(t, 'Pupik', 63)).toBe('63 stores removed from Pupik')
  })
  it('passes chain AND company to the RPC and returns the deleted count', async () => {
    rpc.mockResolvedValueOnce({ data: 63, error: null })
    await expect(removeAllChainStores('tsomet', 'pupik')).resolves.toBe(63)
    expect(rpc).toHaveBeenCalledWith('remove_chain_stores', { p_chain_id: 'tsomet', p_company: 'pupik' })
  })
  it('treats a null answer (not super admin) as an error and surfaces RPC errors', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await expect(removeAllChainStores('tsomet', 'pupik')).rejects.toThrow('Not allowed')
    rpc.mockResolvedValueOnce({ data: null, error: new Error('boom') })
    await expect(removeAllChainStores('tsomet', 'pupik')).rejects.toThrow('boom')
  })
  it('page wires the button to confirm, count and the selected company', () => {
    const src = readFileSync(resolve(__dirname, '../pages/admin/ChainsPage.tsx'), 'utf8')
    expect(src).toContain("t('chains.removeAll'")
    expect(src).toContain('window.confirm(removeAllConfirmText(t, chain.name, companyLabel(company), companyCount))')
    expect(src).toContain('removeAllChainStores(chainId as string, company)')
  })
})
