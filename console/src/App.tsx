import type { ReactNode } from 'react'

import { Navigate, Route, Routes } from 'react-router-dom'

import { AdminLayout } from './components/AdminLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AccountListPage } from './pages/AccountListPage'
import { AdminLogPage } from './pages/AdminLogPage'
import { BannerFormPage } from './pages/BannerFormPage'
import { BannerListPage } from './pages/BannerListPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { PackageFormPage } from './pages/PackageFormPage'
import { PackageGroupDetailPage } from './pages/PackageGroupDetailPage'
import { PackageGroupListPage } from './pages/PackageGroupListPage'
import { PackageListPage } from './pages/PackageListPage'
import { PackageOrderListPage } from './pages/PackageOrderListPage'
import { authStore } from './lib/auth'

function SuperAdminRoute({ children }: { children: ReactNode }) {
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
        <Route path="banners" element={<BannerListPage />} />
        <Route path="banners/new" element={<BannerFormPage mode="create" />} />
        <Route path="banners/:id" element={<BannerFormPage mode="view" />} />
        <Route path="banners/:id/edit" element={<BannerFormPage mode="edit" />} />
        <Route path="packages" element={<PackageListPage />} />
        <Route path="packages/new" element={<PackageFormPage mode="create" />} />
        <Route path="packages/:id" element={<PackageFormPage mode="view" />} />
        <Route path="packages/:id/edit" element={<PackageFormPage mode="edit" />} />
        <Route path="package-groups" element={<PackageGroupListPage />} />
        <Route path="package-groups/:id" element={<PackageGroupDetailPage />} />
        <Route path="package-orders" element={<PackageOrderListPage />} />
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
