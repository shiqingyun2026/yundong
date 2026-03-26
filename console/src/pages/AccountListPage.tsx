import { FormEvent, useEffect, useState } from 'react'

import { api } from '../lib/api'
import type { AccountListItem } from '../types'

type EditorMode = 'create' | 'edit'

type EditorState = {
  mode: EditorMode
  id?: string
  username: string
  password: string
  role: 'super_admin' | 'admin'
  status: 'active' | 'disabled'
}

const emptyEditor: EditorState = {
  mode: 'create',
  username: '',
  password: '',
  role: 'admin',
  status: 'active'
}

export function AccountListPage() {
  const [items, setItems] = useState<AccountListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchAccounts = async (nextKeyword = '') => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (nextKeyword) {
        params.set('keyword', nextKeyword)
      }
      const data = await api.get<{ list: AccountListItem[] }>(`/accounts?${params.toString()}`)
      setItems(data.list || [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取账号失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchAccounts()
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editor) {
      return
    }

    setSubmitting(true)
    setError('')

    try {
      if (editor.mode === 'create') {
        await api.post('/accounts', {
          username: editor.username,
          password: editor.password,
          role: editor.role
        })
      } else if (editor.id) {
        await api.put(`/accounts/${editor.id}`, {
          password: editor.password || undefined,
          role: editor.role,
          status: editor.status
        })
      }

      setEditor(null)
      await fetchAccounts(keyword)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存账号失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const target = items.find(item => item.id === id)
    const activeSuperAdminCount = items.filter(
      item => item.role === 'super_admin' && item.status === 'active'
    ).length

    if (target && target.role === 'super_admin' && target.status === 'active' && activeSuperAdminCount <= 1) {
      setError('至少保留一个超级管理员账号')
      return
    }

    if (!window.confirm('确认删除该账号吗？')) {
      return
    }

    setError('')

    try {
      await api.delete(`/accounts/${id}`)
      await fetchAccounts(keyword)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除账号失败')
    }
  }

  return (
    <section className="stack">
      <div className="page-actions">
        <div>
          <p className="section-kicker">Accounts</p>
          <h3>账号管理</h3>
        </div>
        <button className="primary-button" onClick={() => setEditor({ ...emptyEditor })}>
          新增账号
        </button>
      </div>

      <section className="panel stack">
        <div className="filter-bar">
          <input
            placeholder="按用户名搜索"
            value={keyword}
            onChange={event => setKeyword(event.target.value)}
          />
          <button className="secondary-button" onClick={() => void fetchAccounts(keyword)}>
            搜索
          </button>
        </div>

        {editor ? (
          <form className="panel stack subtle-panel" onSubmit={handleSubmit}>
            <div>
              <p className="section-kicker">Account Editor</p>
              <h4>{editor.mode === 'create' ? '新增管理员' : '编辑管理员'}</h4>
            </div>

            <div className="form-grid">
              <label>
                用户名
                <input
                  value={editor.username}
                  disabled={editor.mode === 'edit'}
                  onChange={event => setEditor(current => current && { ...current, username: event.target.value })}
                />
              </label>

              <label>
                角色
                <select
                  value={editor.role}
                  onChange={event =>
                    setEditor(current => current && { ...current, role: event.target.value as 'super_admin' | 'admin' })
                  }
                >
                  <option value="admin">管理员</option>
                  <option value="super_admin">超级管理员</option>
                </select>
              </label>

              <label>
                状态
                <select
                  value={editor.status}
                  disabled={editor.mode === 'create'}
                  onChange={event =>
                    setEditor(current => current && { ...current, status: event.target.value as 'active' | 'disabled' })
                  }
                >
                  <option value="active">启用</option>
                  <option value="disabled">停用</option>
                </select>
              </label>
            </div>

            <label>
              {editor.mode === 'create' ? '密码' : '新密码（留空则不修改）'}
              <input
                type="password"
                value={editor.password}
                placeholder={editor.mode === 'create' ? '至少 6 位' : '不修改可留空'}
                onChange={event => setEditor(current => current && { ...current, password: event.target.value })}
              />
            </label>

            <div className="button-row">
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? '保存中...' : '保存'}
              </button>
              <button className="ghost-button" type="button" onClick={() => setEditor(null)}>
                取消
              </button>
            </div>
          </form>
        ) : null}

        {loading ? <p className="muted-text">加载中...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>角色</th>
                <th>状态</th>
                <th>最后登录时间</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.username}</td>
                  <td>{item.role}</td>
                  <td>{item.status === 'active' ? '启用' : '停用'}</td>
                  <td>{item.last_login_time || '-'}</td>
                  <td>{item.create_time || '-'}</td>
                  <td className="button-row">
                    <button
                      className="secondary-button compact-button"
                      onClick={() =>
                        setEditor({
                          mode: 'edit',
                          id: item.id,
                          username: item.username,
                          password: '',
                          role: item.role as 'super_admin' | 'admin',
                          status: item.status as 'active' | 'disabled'
                        })
                      }
                    >
                      编辑
                    </button>
                    <button
                      className="ghost-button compact-button"
                      onClick={() => void handleDelete(item.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </section>
  )
}
