import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../lib/api'
import { authStore } from '../lib/auth'
import type { LoginResponse } from '../types'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123456')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const data = await api.post<LoginResponse>('/login', { username, password })
      authStore.setSession(data)
      navigate('/dashboard')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-copy">
          <p className="brand-kicker">Operations Console</p>
          <h1>邻动体适能运营后台</h1>
          <p>
            当前版本先打通登录、课程、订单、账号管理骨架，方便我们尽快进入真实联调。
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            用户名
            <input value={username} onChange={event => setUsername(event.target.value)} />
          </label>

          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? '登录中...' : '进入后台'}
          </button>
        </form>
      </div>
    </div>
  )
}
