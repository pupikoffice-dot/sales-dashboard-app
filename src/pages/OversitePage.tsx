import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardData } from '../hooks/useDashboardData'

export function OversitePage() {
  const { access } = useDashboardAccess()
  const { rows, allRows, isLoading, error, debtLastUpdate } = useDashboardData()

  if (isLoading) return <p className="text-sm text-slate-500">Loading sales data…</p>
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>

  const companies = access?.companies.join(', ') ?? '—'
  const agents = access?.agents?.length ? access.agents.join(', ') : 'All'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Oversite</h1>
      <p className="text-sm text-slate-600">
        Phase 1 shell — full Oversite port from legacy HTML is next.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Your rows" value={rows.length.toLocaleString()} />
        <Stat label="Total rows" value={allRows.length.toLocaleString()} />
        <Stat label="Companies" value={companies} />
        <Stat label="Agents" value={agents} />
      </div>
      {debtLastUpdate && (
        <p className="text-sm text-slate-500">Debt last update: {debtLastUpdate}</p>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  )
}
