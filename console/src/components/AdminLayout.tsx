import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { authStore } from '../lib/auth'
import type { AdminUser } from '../types'

type NavItem = {
  to: string
  label: string
  roles?: ReadonlyArray<AdminUser['role']>
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: '概览' },
  { to: '/banners', label: 'Banner 管理' },
  { to: '/packages', label: '课包管理' },
  { to: '/package-groups', label: '课包拼团' },
  { to: '/package-orders', label: '课包订单' },
  { to: '/accounts', label: '账号管理', roles: ['super_admin'] as const },
  { to: '/logs', label: '操作日志' }
]

export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = authStore.getUser()
  const visibleNavItems = navItems.filter(item => !item.roles || (user && item.roles.includes(user.role)))
  const currentNavItem =
    visibleNavItems.find(item => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)) ||
    visibleNavItems[0] ||
    navItems[0]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand-kicker">Neighbor Move</p>
          <h1>邻动体适能</h1>
          <p className="brand-subtitle">课包拼团运营后台</p>
        </div>
        <nav className="nav">
          {visibleNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <div>
            <h2>{currentNavItem.label}</h2>
          </div>

          <div className="topbar-actions">
            <span className="user-chip">
              {user?.username || '管理员'} / {user?.role || 'admin'}
            </span>
            <button
              className="ghost-button"
              onClick={() => {
                authStore.clear()
                navigate('/login')
              }}
            >
              退出登录
            </button>
          </div>
        </header>

        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
