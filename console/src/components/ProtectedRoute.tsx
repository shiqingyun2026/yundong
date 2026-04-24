import { useEffect, useState, type ReactNode } from 'react'

import { Navigate } from 'react-router-dom'

import { api } from '../lib/api'
import { authStore } from '../lib/auth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const cachedUser = authStore.getUser()
  const [checking, setChecking] = useState(!cachedUser)
  const [allowed, setAllowed] = useState(!!cachedUser)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const session = await api.getSession()
        if (cancelled) {
          return
        }

        authStore.setSession({
          user: session.user
        })
        setAllowed(true)
      } catch {
        if (cancelled) {
          return
        }

        // Keep the optimistic local session until a real logout or a cold start
        // without cached identity. This avoids flicker and test-only races while
        // the browser is still establishing the HttpOnly cookie session.
        if (!cachedUser) {
          authStore.clear()
          setAllowed(false)
        }
      } finally {
        if (!cancelled) {
          setChecking(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (checking) {
    return <p className="muted-text">登录状态校验中...</p>
  }

  if (!allowed) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
