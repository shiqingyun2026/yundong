import { Navigate, Route, Routes } from 'react-router-dom'

import { AdminLayout } from './components/AdminLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AccountListPage } from './pages/AccountListPage'
import { AdminLogPage } from './pages/AdminLogPage'
import { CourseFormPage } from './pages/CourseFormPage'
import { CourseListPage } from './pages/CourseListPage'
import { DashboardPage } from './pages/DashboardPage'
import { GroupDetailPage } from './pages/GroupDetailPage'
import { GroupListPage } from './pages/GroupListPage'
import { LoginPage } from './pages/LoginPage'
import { OrderListPage } from './pages/OrderListPage'
import { authStore } from './lib/auth'

function SuperAdminRoute({ children }: { children: JSX.Element }) {
  const user = authStore.getUser()

  if (user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="courses" element={<CourseListPage />} />
        <Route path="courses/new" element={<CourseFormPage mode="create" />} />
        <Route path="courses/:id" element={<CourseFormPage mode="view" />} />
        <Route path="courses/:id/edit" element={<CourseFormPage mode="edit" />} />
        <Route path="groups" element={<GroupListPage />} />
        <Route path="groups/:id" element={<GroupDetailPage />} />
        <Route path="orders" element={<OrderListPage />} />
        <Route
          path="accounts"
          element={
            <SuperAdminRoute>
              <AccountListPage />
            </SuperAdminRoute>
          }
        />
        <Route path="logs" element={<AdminLogPage />} />
      </Route>
    </Routes>
  )
}
