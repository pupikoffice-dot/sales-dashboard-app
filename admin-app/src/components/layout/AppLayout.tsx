import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ChatSessionProvider } from '../../context/ChatSessionContext'
import { Users, UserCheck, RefreshCw, Settings, BarChart2, Shield, LayoutDashboard, Menu, X, LogOut, MessageSquare, Smartphone, List } from 'lucide-react'
import type { UserRole } from '../../lib/types'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  minRole: UserRole
  end?: boolean
}

const ROLE_RANK: Record<UserRole, number> = {
  agent: 0, manager: 1, admin: 2, super_admin: 3,
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin',          label: 'Dashboard', icon: <LayoutDashboard size={14} />, minRole: 'manager', end: true },
  { to: '/admin/users',    label: 'Users',     icon: <Users size={14} />,           minRole: 'manager' },
  { to: '/admin/clients',  label: 'Clients',   icon: <UserCheck size={14} />,       minRole: 'manager' },
  { to: '/admin/sync',     label: 'Sync',      icon: <RefreshCw size={14} />,       minRole: 'admin' },
  { to: '/admin/settings', label: 'AI',        icon: <Settings size={14} />,        minRole: 'super_admin' },
  { to: '/admin/chat',     label: 'Chat',      icon: <MessageSquare size={14} />,   minRole: 'manager' },
  { to: '/admin/queries',  label: 'Queries',   icon: <List size={14} />,            minRole: 'manager' },
  { to: '/admin/devices',  label: 'Tablets',   icon: <Smartphone size={14} />,      minRole: 'manager' },
  { to: '/admin/usage',    label: 'Usage',     icon: <BarChart2 size={14} />,       minRole: 'admin' },
  { to: '/admin/security', label: 'Security',  icon: <Shield size={14} />,          minRole: 'admin' },
]

export function AppLayout() {
  const { signOut, role } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const visibleLinks = NAV_ITEMS.filter(item =>
    role && ROLE_RANK[role] >= ROLE_RANK[item.minRole]
  )

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded transition-colors whitespace-nowrap ${
      isActive ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
    }`

  return (
    <div className="min-h-screen bg-background">
      <nav
        className="sticky top-0 z-30 px-6 py-3 shadow-ambient"
        style={{ background: 'linear-gradient(135deg, #001a4d 0%, #003080 100%)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-bold text-white text-base tracking-tight whitespace-nowrap">Sales Console</span>
            <div className="hidden md:flex items-center gap-0.5">
              {visibleLinks.map(item => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:block text-xs text-white/40 font-mono">{role?.replace('_', ' ')}</span>
            <button
              onClick={handleSignOut}
              className="hidden md:flex items-center gap-1 text-sm text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded px-3 py-1 transition-colors"
            >
              <LogOut size={14} />
              Sign Out
            </button>
            <button
              className="md:hidden text-white/80 hover:text-white p-1"
              onClick={() => setMenuOpen(o => !o)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden pt-3 pb-1 border-t border-white/10 mt-3 flex flex-col gap-1">
            {visibleLinks.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={navClass}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-sm text-white/60 hover:text-white px-3 py-2 mt-1 border-t border-white/10"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        )}
      </nav>

      <main className="p-6 max-w-7xl mx-auto">
        <ChatSessionProvider>
          <Outlet />
        </ChatSessionProvider>
      </main>
    </div>
  )
}
