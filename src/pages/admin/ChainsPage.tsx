import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SortTh, useSortedRows } from '../../components/rnd/sortRows'
import { useDebounced } from '../../components/rnd/PurchaseSearch'
import { companyLabel } from '../../lib/salesMetrics'
import {
  addChainStores,
  addSummary,
  chainStores,
  deleteChain,
  listChains,
  parseClientNumbers,
  removeChainStore,
  saveChain,
  searchStores,
} from '../../lib/chainAdmin'
import type { LogicalCompany } from '../../types/dashboard'

const COMPANIES: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']

/** Admin -> Chains: the one place chains and their stores are kept. The Client card, the B2B portal and later builds read from here. */
export function ChainsPage() {
  const qc = useQueryClient()
  const chains = useQuery({ queryKey: ['admin-chains'], queryFn: listChains })
  const [chainId, setChainId] = useState<string | null>(null)
  const [company, setCompany] = useState<LogicalCompany>('mt')
  const [newName, setNewName] = useState('')
  const [rename, setRename] = useState('')
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [paste, setPaste] = useState('')
  const [move, setMove] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const list = chains.data ?? []
  const chain = list.find(c => c.id === chainId) ?? null

  const stores = useQuery({
    queryKey: ['admin-chain-stores', chainId, company],
    queryFn: () => chainStores(chainId as string, company),
    enabled: !!chainId,
  })
  const hits = useQuery({
    queryKey: ['admin-store-search', company, q],
    queryFn: () => searchStores(company, q),
    enabled: !!chainId && q.trim().length >= 2,
  })
  const sorter = useSortedRows(
    stores.data,
    { store: s => s.name || s.id, id: s => s.id, city: s => s.city, agent: s => s.agent },
    { key: 'store', dir: 'asc' },
    ['store', 'id', 'city', 'agent'],
  )
  const total = useMemo(() => (chain ? Object.values(chain.companies).reduce((a, b) => a + b, 0) : 0), [chain])

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin-chains'] })
    void qc.invalidateQueries({ queryKey: ['admin-chain-stores'] })
    void qc.invalidateQueries({ queryKey: ['admin-store-search'] })
    void qc.invalidateQueries({ queryKey: ['pc-chains'] })
  }
  const create = useMutation({
    mutationFn: () => saveChain(null, newName),
    onSuccess: r => {
      if (r.error) setMsg(r.error)
      else {
        setMsg(`Chain ${r.name} created.`)
        setNewName('')
        setChainId(r.id ?? null)
      }
      refresh()
    },
    onError: e => setMsg((e as Error).message),
  })
  const renameM = useMutation({
    mutationFn: () => saveChain(chainId, rename),
    onSuccess: r => {
      setMsg(r.error ?? 'Renamed.')
      refresh()
    },
    onError: e => setMsg((e as Error).message),
  })
  const del = useMutation({
    mutationFn: () => deleteChain(chainId as string),
    onSuccess: r => {
      if (r.error) setMsg(r.error)
      else {
        setMsg('Chain deleted.')
        setChainId(null)
      }
      refresh()
    },
    onError: e => setMsg((e as Error).message),
  })
  const add = useMutation({
    mutationFn: (ids: string[]) => addChainStores(chainId as string, company, ids, move),
    onSuccess: r => {
      setMsg(addSummary(r))
      setPaste('')
      refresh()
    },
    onError: e => setMsg((e as Error).message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => removeChainStore(company, id),
    onSuccess: refresh,
    onError: e => setMsg((e as Error).message),
  })

  const pick = (id: string) => {
    setChainId(id)
    setRename(list.find(c => c.id === id)?.name ?? '')
    setMsg(null)
  }

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Admin — Chains</h2>
      <p className="sel-months-list" style={{ marginTop: 0 }}>
        The one place chains are built. A store belongs to one chain. The Client card reads this list; the B2B portal and later builds should read it from here too.
      </p>

      <div className="hub-grid">
        <section className="hub-card hub-span-4">
          <div className="hub-card-hdr">
            <h3>Chains</h3>
          </div>
          {chains.isLoading ? <p className="status-msg">Loading…</p> : null}
          {chains.error ? <p className="status-msg error">{(chains.error as Error).message}</p> : null}
          {chains.isSuccess && chains.data.length === 0 ? <p className="status-msg">No chains yet.</p> : null}
          <div className="tw">
            <table>
              <tbody>
                {list.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer', fontWeight: c.id === chainId ? 700 : undefined }} onClick={() => pick(c.id)}>
                    <td style={{ textAlign: 'left' }}>{c.name}</td>
                    <td style={{ textAlign: 'right' }}>
                      <small>{COMPANIES.filter(k => c.companies[k]).map(k => `${companyLabel(k)} ${c.companies[k]}`).join(' · ') || 'no stores'}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form
            style={{ display: 'flex', gap: 8, marginTop: 12 }}
            onSubmit={e => {
              e.preventDefault()
              if (newName.trim()) create.mutate()
            }}
          >
            <input className="sbar-search" value={newName} onChange={e => setNewName(e.target.value)} placeholder="New chain name…" aria-label="New chain name" style={{ flex: 1 }} />
            <button type="submit" className="chip active" disabled={!newName.trim() || create.isPending}>
              Create
            </button>
          </form>
        </section>

        <section className="hub-card hub-span-8">
          {!chain ? (
            <p className="status-msg">Pick a chain on the left, or create one.</p>
          ) : (
            <>
              <div className="hub-card-hdr" style={{ flexWrap: 'wrap', gap: 8 }}>
                <h3>{chain.name}</h3>
                <span className="hub-card-aside">{total} stores in all companies</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <input className="sbar-search" value={rename} onChange={e => setRename(e.target.value)} aria-label="Chain name" style={{ minWidth: 200 }} />
                <button type="button" className="chip" disabled={!rename.trim() || rename.trim() === chain.name || renameM.isPending} onClick={() => renameM.mutate()}>
                  Rename
                </button>
                <button
                  type="button"
                  className="chip"
                  disabled={total > 0 || del.isPending}
                  title={total > 0 ? 'Remove the stores first' : 'Delete this chain'}
                  onClick={() => {
                    if (window.confirm(`Delete the chain ${chain.name}?`)) del.mutate()
                  }}
                >
                  Delete chain
                </button>
              </div>

              <div className="chip-row" style={{ marginBottom: 12 }}>
                {COMPANIES.map(c => (
                  <button key={c} type="button" className={`chip${c === company ? ' active' : ''}`} onClick={() => setCompany(c)}>
                    {companyLabel(c)} ({chain.companies[c] ?? 0})
                  </button>
                ))}
              </div>

              {msg ? <p className="status-msg">{msg}</p> : null}

              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <SortTh label="Store" k="store" left sort={sorter.sort} onSort={sorter.onSort} />
                      <SortTh label="Client no." k="id" left sort={sorter.sort} onSort={sorter.onSort} />
                      <SortTh label="City" k="city" left sort={sorter.sort} onSort={sorter.onSort} />
                      <SortTh label="Agent" k="agent" sort={sorter.sort} onSort={sorter.onSort} />
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sorter.sorted.map(s => (
                      <tr key={s.id}>
                        <td style={{ textAlign: 'left' }}>{s.name || '—'}</td>
                        <td style={{ textAlign: 'left' }}>{s.id}</td>
                        <td style={{ textAlign: 'left' }}>{s.city ?? ''}</td>
                        <td>{s.agent ?? '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="chip"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (window.confirm(`Remove ${s.name || s.id} from ${chain.name}?`)) remove.mutate(s.id)
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stores.isSuccess && !stores.data.length ? <p className="status-msg">No stores in {companyLabel(company)} yet.</p> : null}
              </div>

              <h4 style={{ margin: '16px 0 8px' }}>Add stores to {chain.name} in {companyLabel(company)}</h4>
              <input
                className="sbar-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="🔍 Find a store by name or client number…"
                aria-label="Find a store"
                style={{ width: '100%', maxWidth: 420 }}
              />
              {hits.data?.length ? (
                <div className="tw" style={{ marginTop: 8 }}>
                  <table>
                    <tbody>
                      {hits.data.map(h => (
                        <tr key={h.id}>
                          <td style={{ textAlign: 'left' }}>{h.name || '—'}</td>
                          <td style={{ textAlign: 'left' }}>{h.id}</td>
                          <td style={{ textAlign: 'left' }}>{h.city ?? ''}</td>
                          <td>{h.chain ? <small>in {h.chain}</small> : null}</td>
                          <td>
                            <button type="button" className="chip" disabled={add.isPending || h.chain === chain.name} onClick={() => add.mutate([h.id])}>
                              Add
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <p style={{ margin: '12px 0 4px' }}>Or paste client numbers (one per line, or separated by commas or spaces):</p>
              <textarea
                value={paste}
                onChange={e => setPaste(e.target.value)}
                rows={4}
                aria-label="Client numbers"
                style={{ width: '100%', maxWidth: 420, display: 'block' }}
              />
              <label style={{ display: 'block', margin: '6px 0' }}>
                <input type="checkbox" checked={move} onChange={e => setMove(e.target.checked)} /> Move stores that are already in another chain
              </label>
              <button type="button" className="chip active" disabled={!parseClientNumbers(paste).length || add.isPending} onClick={() => add.mutate(parseClientNumbers(paste))}>
                Add {parseClientNumbers(paste).length || ''} stores
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
