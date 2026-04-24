import type { AdminUser, LoginResponse } from '../types'

const USER_KEY = 'console_admin_user'

export const authStore = {
  getUser(): AdminUser | null {
    const raw = window.localStorage.getItem(USER_KEY)
    if (!raw) {
      return null
    }

    try {
      return JSON.parse(raw) as AdminUser
    } catch {
      return null
    }
  },
  setSession(payload: LoginResponse) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(payload.user))
  },
  clear() {
    window.localStorage.removeItem(USER_KEY)
  }
}
