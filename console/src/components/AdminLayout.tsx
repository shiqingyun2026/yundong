import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { authStore } from '../lib/auth'

const navItems = [
  { to: '/dashboard', label: '概览' },
  { to: '/courses', label: '课程管理' },
  { to: '/groups', label: '拼团管理' },
  { to: '/orders', label: '订单管理' },
  { to: '/accounts', label: '账号管理' },
  { to: '/logs', label: '操作日志' }
]

export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = authStore.getUser()
  const currentNavItem =
    navItems.find(item => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)) ||
    navItems[0]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand-kicker">Neighbor Move</p>
          <h1>邻动体适能</h1>
          <p className="brand-subtitle">运营后台骨架</p>
        </div>
        <nav className="nav">
          {navItems.map(item => (
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
