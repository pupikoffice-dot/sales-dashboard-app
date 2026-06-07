import type { ReactNode } from 'react'
import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { canShowModule } from '../lib/permissions'
import { MODULE_REGISTRY } from '../modules/registry'

export function DashboardLayout() {
  const { signOut, isSuperAdmin } = useAuth()
  const { access, loading } = useDashboardAccess()

  if (loading) return <p className="p-6 text-sm text-slate-500">Loading permissions…</p>
  if (!access?.active) return <p className="p-6 text-sm text-red-600">No dashboard access configured.</p>

  const visible = MODULE_REGISTRY.filter(m => canShowModule(access, m.id))

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-56 bg-slate-900 text-slate-100 flex flex-col">
        <div className="p-4 font-semibold border-b border-slate-700">Sales Dashboard</div>
        <nav className="flex-1 p-2 space-y-1">
          {visible.map(m => (
            <NavLink
              key={m.id}
              to={m.path}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm ${isActive ? 'bg-slate-700' : 'hover:bg-slate-800'}`
              }
            >
              {m.label}
            </NavLink>
          ))}
          {isSuperAdmin && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm mt-4 ${isActive ? 'bg-slate-700' : 'hover:bg-slate-800'}`
              }
            >
              Admin — Users
            </NavLink>
          )}
        </nav>
        <button
          type="button"
          onClick={() => signOut()}
          className="m-2 px-3 py-2 text-sm text-left rounded hover:bg-slate-800"
        >
          Sign out
        </button>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

export function RequireModule({ moduleId, children }: { moduleId: string; children: ReactNode }) {
  const { access } = useDashboardAccess()
  if (!access || !canShowModule(access, moduleId as never)) {
    return <Navigate to="/oversite" replace />
  }
  return <>{children}</>
}
