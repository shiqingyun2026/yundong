import type { ReactNode } from 'react'

import { Navigate } from 'react-router-dom'

import { authStore } from '../lib/auth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = authStore.getToken()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
