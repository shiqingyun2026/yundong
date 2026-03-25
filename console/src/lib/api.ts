import { authStore } from './auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/admin'

type RequestOptions = {
  method?: string
  body?: unknown
}

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = authStore.getToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await response.text()
    throw new Error(
      text.includes('<!DOCTYPE') || text.includes('<html')
        ? '接口返回了页面内容，请确认后端已启动且 VITE_API_BASE_URL 指向管理端接口'
        : '接口未返回 JSON，请确认后端服务是否正常'
    )
  }

  const payload = (await response.json()) as ApiEnvelope<T>

  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || '请求失败')
  }

  return payload.data
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' })
}
