import { Navigate, Route, Routes } from 'react-router-dom'

import { AdminLayout } from './components/AdminLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AccountListPage } from './pages/AccountListPage'
import { CourseFormPage } from './pages/CourseFormPage'
import { CourseListPage } from './pages/CourseListPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { OrderListPage } from './pages/OrderListPage'

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
        <Route path="courses/:id/edit" element={<CourseFormPage mode="edit" />} />
        <Route path="orders" element={<OrderListPage />} />
        <Route path="accounts" element={<AccountListPage />} />
      </Route>
    </Routes>
  )
}
