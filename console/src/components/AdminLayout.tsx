import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { authStore } from '../lib/auth'

const navItems = [
  { to: '/dashboard', label: '概览' },
  { to: '/courses', label: '课程管理' },
  { to: '/orders', label: '订单管理' },
  { to: '/accounts', label: '账号管理' }
]

export function AdminLayout() {
  const navigate = useNavigate()
  const user = authStore.getUser()

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
            <p className="page-caption">运营工作台</p>
            <h2>管理端开发骨架</h2>
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
