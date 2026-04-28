import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PageBackButton } from '../components/PageBackButton'
import { PaginationBar } from '../components/PaginationBar'
import { api } from '../lib/api'
import type { PackageGroupListItem, PackageGroupListResponse } from '../types'

const getStatusText = (status: PackageGroupListItem['status']) => {
  if (status === 'success') return '已成团'
  if (status === 'failed') return '已失败'
  return '进行中'
}

const formatRemainingTime = (seconds: number) => {
  if (seconds <= 0) {
    return '已截止'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours} 小时 ${minutes} 分钟`
}

const formatScheduleList = (scheduleList: unknown[]) =>
  scheduleList
    .map(item => {
      if (typeof item === 'string') {
        return item
      }

      if (!item || typeof item !== 'object') {
        return ''
      }

      const scheduleItem = item as Record<string, unknown>
      const textFields = ['schedule_text', 'text', 'label', 'display_text', 'lesson_text']
      for (const field of textFields) {
        const value = scheduleItem[field]
        if (typeof value === 'string' && value.trim()) {
          return value.trim()
        }
      }

      const dateValue = ['date', 'class_date', 'lesson_date', 'start_date']
        .map(field => scheduleItem[field])
        .find(value => typeof value === 'string' && value.trim())
      const timeValue = ['time', 'start_time', 'class_time', 'lesson_time']
        .map(field => scheduleItem[field])
        .find(value => typeof value === 'string' && value.trim())

      if (typeof dateValue === 'string' && typeof timeValue === 'string') {
        return `${dateValue.trim()} ${timeValue.trim()}`
      }

      if (typeof dateValue === 'string') {
        return dateValue.trim()
      }

      if (typeof timeValue === 'string') {
        return timeValue.trim()
      }

      return JSON.stringify(item)
    })
    .filter(Boolean)

export function PackageGroupListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const packageIdFromQuery = searchParams.get('package_id') || ''
  const [packageId, setPackageId] = useState(packageIdFromQuery)
  const [status, setStatus] = useState('')
  const [items, setItems] = useState<PackageGroupListItem[]>([])
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1, page: 1, size: 10 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const applySearch = (nextPackageId = packageId, nextStatus = status, nextPage = 1) => {
    const params = new URLSearchParams()
    if (nextPackageId) params.set('package_id', nextPackageId)
    if (nextStatus) params.set('status', nextStatus)
    if (nextPage > 1) params.set('page', `${nextPage}`)
    setSearchParams(params)
  }

  const fetchList = async (nextPackageId = packageId, nextStatus = status, nextPage = 1) => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (nextPackageId) params.set('package_id', nextPackageId)
      if (nextStatus) params.set('status', nextStatus)
      params.set('page', `${nextPage}`)
      params.set('size', '10')

      const data = await api.get<PackageGroupListResponse>(`/package-groups?${params.toString()}`)
      setItems(data.list || [])
      setPagination({
        total: data.total || 0,
        total_pages: data.total_pages || 1,
        page: data.page || nextPage,
        size: data.size || 10
      })
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取课包拼团列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const nextPackageId = searchParams.get('package_id') || ''
    const nextStatus = searchParams.get('status') || ''
    const nextPage = Number(searchParams.get('page') || '1') || 1

    setPackageId(nextPackageId)
    setStatus(nextStatus)
    void fetchList(nextPackageId, nextStatus, nextPage)
  }, [searchParams])

  return (
    <section className="stack">
      {packageIdFromQuery ? <PageBackButton fallback="/packages" /> : null}

      <section className="panel search-panel">
        <div className="filter-grid">
          <label className="filter-field">
            <span>课包 ID</span>
            <input placeholder="按课包 ID 过滤" value={packageId} onChange={event => setPackageId(event.target.value)} />
          </label>
          <label className="filter-field">
            <span>拼团状态</span>
            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              <option value="active">进行中</option>
              <option value="success">已成团</option>
              <option value="failed">已失败</option>
            </select>
          </label>
        </div>

        <div className="filter-actions">
          <button
            className="secondary-button compact-action-button query-button"
            type="button"
            onClick={() => applySearch(packageId, status, 1)}
          >
            查询
          </button>
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
                  <th>拼团 ID</th>
                  <th>所属课包</th>
                  <th>状态</th>
                  <th>拼团进度</th>
                  <th>单人金额</th>
                  <th>排课信息</th>
                  <th>截止时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>
                      <div>
                        <strong>{item.package_name || '-'}</strong>
                        <p className="table-subtext">课包 ID: {item.package_id || '-'}</p>
                      </div>
                    </td>
                    <td>{getStatusText(item.status)}</td>
                    <td>
                      {item.current_count}/{item.target_count}
                      <p className="table-subtext">创建人：{item.creator_id || '-'}</p>
                    </td>
                    <td>{item.member_amount_text || '-'}</td>
                    <td>
                      <div>
                        <span>{item.schedule_text || '-'}</span>
                        {item.schedule_list.length ? (
                          <p className="table-subtext">{formatScheduleList(item.schedule_list as unknown[]).join(' / ')}</p>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div>
                        <span>{item.deadline || '-'}</span>
                        <p className="table-subtext">剩余：{formatRemainingTime(item.remaining_seconds)}</p>
                      </div>
                    </td>
                    <td>
                      <div className="button-row">
                        <Link className="table-link" to={`/package-groups/${item.id}`}>
                          查看详情
                        </Link>
                        <Link className="table-link" to={`/packages/${item.package_id}`}>
                          查看课包
                        </Link>
                        <Link className="table-link" to={`/package-orders?package_group_id=${item.id}`}>
                          查看订单
                        </Link>
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
              onPrev={() => applySearch(packageId, status, pagination.page - 1)}
              onNext={() => applySearch(packageId, status, pagination.page + 1)}
            />
          </>
        ) : null}
      </section>
    </section>
  )
}
