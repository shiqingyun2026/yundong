import { useEffect, useState } from 'react'

import { api } from '../lib/api'
import type { AdminLogItem } from '../types'

const ACTION_OPTIONS = [
  { value: '', label: '全部动作' },
  { value: 'admin_login', label: '登录' },
  { value: 'account_create', label: '创建账号' },
  { value: 'account_update', label: '更新账号' },
  { value: 'account_delete', label: '删除账号' },
  { value: 'course_create', label: '创建课程' },
  { value: 'course_update', label: '编辑课程' },
  { value: 'course_offline', label: '下架课程' },
  { value: 'course_status_sync', label: '课程状态同步' },
  { value: 'course_auto_refund', label: '课程自动退款' },
  { value: 'order_refund', label: '订单手动退款' }
]

const TARGET_TYPE_OPTIONS = [
  { value: '', label: '全部对象' },
  { value: 'admin_user', label: '管理员账号' },
  { value: 'course', label: '课程' },
  { value: 'order', label: '订单' }
]

const formatDetail = (detail: AdminLogItem['detail']) => {
  const entries = Object.entries(detail || {})
  if (!entries.length) {
    return '-'
  }

  return entries
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : `${value}`}`)
    .join('\n')
}

export function AdminLogPage() {
  const [items, setItems] = useState<AdminLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [targetId, setTargetId] = useState('')

  const fetchLogs = async (
    nextAdminUsername = adminUsername,
    nextAction = action,
    nextTargetType = targetType,
    nextTargetId = targetId
  ) => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (nextAdminUsername) params.set('admin_username', nextAdminUsername)
      if (nextAction) params.set('action', nextAction)
      if (nextTargetType) params.set('target_type', nextTargetType)
      if (nextTargetId) params.set('target_id', nextTargetId)
      params.set('page', '1')
      params.set('size', '50')

      const data = await api.get<{ list: AdminLogItem[] }>(`/logs?${params.toString()}`)
      setItems(data.list || [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取操作日志失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchLogs()
  }, [])

  return (
    <section className="stack">
      <section className="panel search-panel">
        <div className="filter-grid">
          <label className="filter-field">
            <span>管理员</span>
            <input
              placeholder="管理员用户名"
              value={adminUsername}
              onChange={event => setAdminUsername(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>动作</span>
            <select value={action} onChange={event => setAction(event.target.value)}>
              {ACTION_OPTIONS.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>对象类型</span>
            <select value={targetType} onChange={event => setTargetType(event.target.value)}>
              {TARGET_TYPE_OPTIONS.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>对象ID</span>
            <input
              placeholder="对象ID"
              value={targetId}
              onChange={event => setTargetId(event.target.value)}
            />
          </label>
        </div>

        <div className="filter-actions filter-actions-end">
          <button
            className="secondary-button compact-action-button query-button"
            type="button"
            onClick={() => void fetchLogs(adminUsername, action, targetType, targetId)}
          >
            查询
          </button>
        </div>
      </section>

      <section className="panel stack">
        {loading ? <p className="muted-text">加载中...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading && !error ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>管理员</th>
                <th>动作</th>
                <th>对象类型</th>
                <th>对象ID</th>
                <th>详情</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.created_at || '-'}</td>
                  <td>{item.admin_username ? `${item.admin_username} / ${item.admin_role || '-'}` : item.admin_id || '-'}</td>
                  <td>{item.action || '-'}</td>
                  <td>{item.target_type || '-'}</td>
                  <td>{item.target_id || '-'}</td>
                  <td>
                    <pre className="log-detail">{formatDetail(item.detail)}</pre>
                  </td>
                  <td>{item.ip || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </section>
  )
}
