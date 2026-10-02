import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import type { AgentSummary, Client } from '../lib/types'

const COMPANIES = ['pupik', 'mt', 'grow', 'gold'] as const

type SortKey = 'name_asc' | 'name_desc' | 'erp_asc' | 'erp_desc'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name_asc', label: 'Name A→Z' },
  { value: 'name_desc', label: 'Name Z→A' },
  { value: 'erp_asc', label: 'ERP ID A→Z' },
  { value: 'erp_desc', label: 'ERP ID Z→A' },
]

const companyLabel: Record<string, string> = {
  pupik: 'Pupik',
  mt: 'Monkeytime',
  grow: 'Grow',
  gold: 'Gold',
}

function sortClients(list: Client[], sort: SortKey): Client[] {
  const out = [...list]
  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  out.sort((x, y) => {
    if (sort === 'name_asc' || sort === 'name_desc') {
      const r = cmp(x.name, y.name)
      return sort === 'name_asc' ? r : -r
    }
    const r = cmp(x.erp_client_id, y.erp_client_id)
    return sort === 'erp_asc' ? r : -r
  })
  return out
}

export function ClientsPage() {
  const qc = useQueryClient()
  const [searchByCompany, setSearchByCompany] = useState<Record<string, string>>({})
  const [sortByCompany, setSortByCompany] = useState<Record<string, SortKey>>({})
  const [openByCompany, setOpenByCompany] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COMPANIES.map(c => [c, false])),
  )

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const { data: agents = [] } = useQuery<AgentSummary[]>({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, email, agent_erp_id')
        .eq('role', 'agent')
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })

  const assignAgent = useMutation({
    mutationFn: async ({ clientId, agentId }: { clientId: string; agentId: string | null }) => {
      const { error } = await supabase
        .from('clients')
        .update({ assigned_agent_id: agentId })
        .eq('id', clientId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })

  const byCompany = useMemo(() => {
    const m: Record<string, Client[]> = { pupik: [], mt: [], grow: [], gold: [] }
    for (const c of clients) {
      const co = c.company?.toLowerCase()
      if (co && co in m) m[co].push(c)
      else if (co) {
        if (!m[co]) m[co] = []
        m[co].push(c)
      }
    }
    return m
  }, [clients])

  const agentMap = useMemo(
    () => Object.fromEntries(agents.map(a => [a.id, a.name])),
    [agents],
  )

  function setSearch(company: string, v: string) {
    setSearchByCompany(prev => ({ ...prev, [company]: v }))
  }

  function setSort(company: string, v: SortKey) {
    setSortByCompany(prev => ({ ...prev, [company]: v }))
  }

  function toggleOpen(company: string) {
    setOpenByCompany(prev => ({ ...prev, [company]: !prev[company] }))
  }

  function filterAndSort(company: string): Client[] {
    const q = (searchByCompany[company] ?? '').trim().toLowerCase()
    let list = byCompany[company] ?? []
    if (q) {
      list = list.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          c.erp_client_id.toLowerCase().includes(q) ||
          (c.erp_agent_id && c.erp_agent_id.toLowerCase().includes(q)),
      )
    }
    const sk = sortByCompany[company] ?? 'name_asc'
    return sortClients(list, sk)
  }

  const displayCompanies = useMemo(() => {
    const extra = Object.keys(byCompany)
      .filter(k => !(COMPANIES as readonly string[]).includes(k))
      .sort()
    return [...COMPANIES, ...extra] as string[]
  }, [byCompany])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <p className="text-sm text-gray-500 mt-1">
          {clients.length} clients synced from ERP · one list per company (same ERP ID can differ by company)
        </p>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-3">
          {displayCompanies.map(co => {
            const total = (byCompany[co] ?? []).length
            const rows = filterAndSort(co)
            const open = openByCompany[co] ?? false

            return (
              <div
                key={co}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleOpen(co)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-gray-50/80 hover:bg-gray-50 border-b border-gray-100 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {open ? (
                      <ChevronDown size={18} className="text-gray-500 shrink-0" />
                    ) : (
                      <ChevronRight size={18} className="text-gray-500 shrink-0" />
                    )}
                    <span className="font-semibold text-gray-900">
                      {companyLabel[co] ?? co}
                    </span>
                    <span className="text-sm text-gray-500 font-normal">
                      {total} client{total === 1 ? '' : 's'}
                      {open && rows.length !== total ? ` · ${rows.length} shown` : ''}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                    {companyLabel[co] ?? co}
                  </span>
                </button>

                {open && (
                  <div className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        />
                        <input
                          value={searchByCompany[co] ?? ''}
                          onChange={e => setSearch(co, e.target.value)}
                          placeholder={`Search ${companyLabel[co] ?? co} by name, ERP ID, or agent code…`}
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-600 shrink-0">
                        <span className="text-gray-500 whitespace-nowrap">Sort</span>
                        <select
                          value={sortByCompany[co] ?? 'name_asc'}
                          onChange={e => setSort(co, e.target.value as SortKey)}
                          className="border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          {SORT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                      <table className="w-full text-xs sm:text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Client</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">ERP ID</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600 hidden sm:table-cell">
                              Region
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">ERP agent</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Assigned</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                                {total === 0 ? 'No clients for this company yet.' : 'No matches.'}
                              </td>
                            </tr>
                          ) : (
                            rows.map(c => (
                              <tr key={c.id} className="hover:bg-gray-50/50">
                                <td className="px-3 py-2 font-medium text-gray-900 max-w-[10rem] truncate">
                                  {c.name}
                                </td>
                                <td className="px-3 py-2 text-gray-600 font-mono text-[11px] sm:text-xs whitespace-nowrap">
                                  {c.erp_client_id}
                                </td>
                                <td className="px-3 py-2 text-gray-500 hidden sm:table-cell max-w-[8rem] truncate">
                                  {c.region ?? '—'}
                                </td>
                                <td className="px-3 py-2 text-gray-600 font-mono text-[11px] sm:text-xs">
                                  {c.erp_agent_id?.trim() ? c.erp_agent_id : '—'}
                                </td>
                                <td className="px-3 py-2">
                                  <select
                                    value={c.assigned_agent_id ?? ''}
                                    onChange={e =>
                                      assignAgent.mutate({
                                        clientId: c.id,
                                        agentId: e.target.value || null,
                                      })
                                    }
                                    className="max-w-[11rem] sm:max-w-[14rem] border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white truncate"
                                    title={c.assigned_agent_id ? agentMap[c.assigned_agent_id] : undefined}
                                  >
                                    <option value="">Unassigned</option>
                                    {agents.map(a => (
                                      <option key={a.id} value={a.id}>
                                        {a.name}
                                        {a.agent_erp_id?.trim() ? ` (${a.agent_erp_id})` : ''}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
