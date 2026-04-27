import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PaginationBar } from '../components/PaginationBar'
import { api } from '../lib/api'
import type { BannerListItem, BannerListResponse, BannerStatus } from '../types'

const getStatusText = (status: BannerStatus) => {
  if (status === 'active') return '已上线'
  if (status === 'inactive') return '已下线'
  return '待上线'
}

const getJumpTypeText = (jumpType: BannerListItem['jump_type']) => {
  if (jumpType === 'packageDetail') return '课程详情'
  if (jumpType === 'customUrl') return '外部链接'
  if (jumpType === 'miniprogramPage') return '站内页面'
  return '不跳转'
}

export function BannerListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [items, setItems] = useState<BannerListItem[]>([])
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1, page: 1, size: 10 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState('')

  const applySearch = (nextKeyword = keyword, nextStatus = status, nextPage = 1) => {
    const params = new URLSearchParams()
    if (nextKeyword) params.set('keyword', nextKeyword)
    if (nextStatus) params.set('status', nextStatus)
    if (nextPage > 1) params.set('page', `${nextPage}`)
    setSearchParams(params)
  }

  const fetchList = async (nextKeyword = keyword, nextStatus = status, nextPage = 1) => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (nextKeyword) params.set('keyword', nextKeyword)
      if (nextStatus) params.set('status', nextStatus)
      params.set('page', `${nextPage}`)
      params.set('size', '10')

      const data = await api.get<BannerListResponse>(`/banners?${params.toString()}`)
      setItems(data.list || [])
      setPagination({
        total: data.total || 0,
        total_pages: data.total_pages || 1,
        page: data.page || nextPage,
        size: data.size || 10
      })
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取 Banner 列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const nextKeyword = searchParams.get('keyword') || ''
    const nextStatus = searchParams.get('status') || ''
    const nextPage = Number(searchParams.get('page') || '1') || 1

    setKeyword(nextKeyword)
    setStatus(nextStatus)
    void fetchList(nextKeyword, nextStatus, nextPage)
  }, [searchParams])

  const handleOffline = async (item: BannerListItem) => {
    if (item.status !== 'active') {
      return
    }

    if (!window.confirm(`确认下线 Banner「${item.title || item.id}」吗？`)) {
      return
    }

    try {
      setActioningId(item.id)
      setError('')
      await api.post(`/banners/${item.id}/offline`)
      await fetchList(keyword, status, pagination.page)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '下线 Banner 失败')
    } finally {
      setActioningId('')
    }
  }

  return (
    <section className="stack">
      <section className="panel search-panel">
        <div className="filter-grid">
          <label className="filter-field">
            <span>Banner 关键词</span>
            <input placeholder="按标题 / 跳转目标搜索" value={keyword} onChange={event => setKeyword(event.target.value)} />
          </label>
          <label className="filter-field">
            <span>状态</span>
            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              <option value="pending">待上线</option>
              <option value="active">已上线</option>
              <option value="inactive">已下线</option>
            </select>
          </label>
        </div>

        <div className="page-actions">
          <button className="secondary-button compact-action-button query-button" type="button" onClick={() => applySearch(keyword, status, 1)}>
            查询
          </button>
          <Link className="primary-button link-button compact-action-button" to="/banners/new">
            新建
          </Link>
        </div>
      </section>

      <section className="panel">
        {loading ? <p className="muted-text">加载中...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading && !error ? (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>跳转</th>
                  <th>排序</th>
                  <th>上线时间</th>
                  <th>下线时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title || '-'}</strong>
                    </td>
                    <td>
                      <div>
                        <strong>{getJumpTypeText(item.jump_type)}</strong>
                        <p className="table-subtext">{item.jump_target || '-'}</p>
                      </div>
                    </td>
                    <td>{item.sort}</td>
                    <td>{item.online_time || '-'}</td>
                    <td>{item.offline_time || '-'}</td>
                    <td>{getStatusText(item.status)}</td>
                    <td>
                      <div className="button-row">
                        <Link className="table-link" to={`/banners/${item.id}`}>
                          查看
                        </Link>
                        {item.status !== 'active' ? (
                          <Link className="table-link" to={`/banners/${item.id}/edit`}>
                            编辑
                          </Link>
                        ) : null}
                        <Link className="table-link" to={`/banners/new?copyFrom=${item.id}`}>
                          复制
                        </Link>
                        {item.status === 'active' ? (
                          <button className="table-link button-as-link" type="button" disabled={actioningId === item.id} onClick={() => void handleOffline(item)}>
                            {actioningId === item.id ? '下线中...' : '下线'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar
              total={pagination.total}
              page={pagination.page}
              totalPages={pagination.total_pages}
              onPrev={() => applySearch(keyword, status, pagination.page - 1)}
              onNext={() => applySearch(keyword, status, pagination.page + 1)}
            />
          </>
        ) : null}
      </section>
    </section>
  )
}
