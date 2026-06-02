import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PaginationBar } from '../components/PaginationBar'
import { api } from '../lib/api'
import type { PackageListItem, PackageListResponse } from '../types'

const getStatusText = (status: PackageListItem['status']) => {
  if (status === 'pending') return '待上架'
  if (status === 'active') return '已上架'
  return '已下架'
}

const formatSupportedPeople = (supportedPeople: number[]) =>
  supportedPeople.length ? supportedPeople.map(item => `${item}人团`).join(' / ') : '-'

const getDistrictTail = (value: string) => {
  const normalized = `${value || ''}`
    .split('/')
    .map(item => item.trim())
    .filter(Boolean)
  return normalized.length ? normalized[normalized.length - 1] : ''
}

const getListLocationText = (item: PackageListItem) => {
  const district = getDistrictTail(item.location_district || '')
  const community = `${item.location_community || ''}`.trim()
  return [district, community].filter(Boolean).join(' / ') || '-'
}

export function PackageListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const [packageCategory, setPackageCategory] = useState('')
  const [status, setStatus] = useState('')
  const [items, setItems] = useState<PackageListItem[]>([])
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1, page: 1, size: 10 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState('')

  const applySearch = (
    nextKeyword = keyword,
    nextPackageCategory = packageCategory,
    nextStatus = status,
    nextPage = 1
  ) => {
    const params = new URLSearchParams()
    if (nextKeyword) params.set('keyword', nextKeyword)
    if (nextPackageCategory) params.set('package_category', nextPackageCategory)
    if (nextStatus) params.set('status', nextStatus)
    if (nextPage > 1) params.set('page', `${nextPage}`)
    setSearchParams(params)
  }

  const fetchList = async (
    nextKeyword = keyword,
    nextPackageCategory = packageCategory,
    nextStatus = status,
    nextPage = 1
  ) => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (nextKeyword) {
        params.set('keyword', nextKeyword)
      }
      if (nextPackageCategory) {
        params.set('package_category', nextPackageCategory)
      }
      if (nextStatus) {
        params.set('status', nextStatus)
      }
      params.set('page', `${nextPage}`)
      params.set('size', '10')

      const data = await api.get<PackageListResponse>(`/packages?${params.toString()}`)
      setItems(data.list || [])
      setPagination({
        total: data.total || 0,
        total_pages: data.total_pages || 1,
        page: data.page || nextPage,
        size: data.size || 10
      })
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取课包失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const nextKeyword = searchParams.get('keyword') || ''
    const nextPackageCategory = searchParams.get('package_category') || ''
    const nextStatus = searchParams.get('status') || ''
    const nextPage = Number(searchParams.get('page') || '1') || 1

    setKeyword(nextKeyword)
    setPackageCategory(nextPackageCategory)
    setStatus(nextStatus)
    void fetchList(nextKeyword, nextPackageCategory, nextStatus, nextPage)
  }, [searchParams])

  const handleOffline = async (item: PackageListItem) => {
    if (item.status !== 'active') {
      return
    }

    if (
      !window.confirm(
        '确认下架该课包吗？\n下架后，该课包将不会继续在小程序首页展示。\n如有进行中的拼团，将自动扭转拼团状态为失败，并退款。'
      )
    ) {
      return
    }

    try {
      setActioningId(item.id)
      setError('')
      await api.put(`/packages/${item.id}/offline`)
      await fetchList(keyword, packageCategory, status, pagination.page)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '下架课包失败')
    } finally {
      setActioningId('')
    }
  }

  return (
    <section className="stack">
      <section className="panel search-panel">
        <div className="filter-grid">
          <label className="filter-field">
            <span>课包编号 / 名称</span>
            <input
              placeholder="按课包编号或名称搜索"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>课包类型</span>
            <select value={packageCategory} onChange={event => setPackageCategory(event.target.value)}>
              <option value="">全部类型</option>
              <option value="体适能">体适能</option>
              <option value="体验课">体验课</option>
              <option value="跳绳">跳绳</option>
            </select>
          </label>
          <label className="filter-field">
            <span>课包状态</span>
            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              <option value="pending">待上架</option>
              <option value="active">已上架</option>
              <option value="inactive">已下架</option>
            </select>
          </label>
        </div>

        <div className="page-actions">
          <button
            className="secondary-button compact-action-button query-button"
            type="button"
            onClick={() => applySearch(keyword, packageCategory, status, 1)}
          >
            查询
          </button>
          <Link className="primary-button link-button compact-action-button" to="/packages/new">
            新建课包
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
                  <th>课包ID</th>
                  <th>课包名称</th>
                  <th>类型</th>
                  <th>适用年龄</th>
                  <th>节数/时长</th>
                  <th>支持人数</th>
                  <th>地点</th>
                  <th>状态</th>
                  <th>上架时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>{item.id || '-'}</td>
                    <td>
                      {item.name || '-'}
                    </td>
                    <td>{item.package_category || '-'}</td>
                    <td>{item.age_range || '-'}</td>
                    <td>{item.class_count > 0 && item.class_duration_minutes > 0 ? `${item.class_count}节 / ${item.class_duration_minutes}分钟` : '-'}</td>
                    <td>{formatSupportedPeople(item.supported_people)}</td>
                    <td>{getListLocationText(item)}</td>
                    <td>{getStatusText(item.status)}</td>
                    <td>{item.publish_time || '-'}</td>
                    <td>
                      <div className="button-row">
                        <Link className="table-link" to={`/packages/${item.id}`}>
                          查看
                        </Link>
                        {item.status !== 'active' ? (
                          <Link className="table-link" to={`/packages/${item.id}/edit`}>
                            编辑
                          </Link>
                        ) : null}
                        <Link className="table-link" to={`/packages/new?copyFrom=${item.id}`}>
                          复制
                        </Link>
                        <Link className="table-link" to={`/package-groups?package_id=${item.id}`}>
                          查看拼团
                        </Link>
                        <Link className="table-link" to={`/package-orders?package_id=${item.id}`}>
                          查看订单
                        </Link>
                        {item.status === 'active' ? (
                          <button className="table-link button-as-link" type="button" disabled={actioningId === item.id} onClick={() => void handleOffline(item)}>
                            {actioningId === item.id ? '下架中...' : '下架'}
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
              onPrev={() => applySearch(keyword, packageCategory, status, pagination.page - 1)}
              onNext={() => applySearch(keyword, packageCategory, status, pagination.page + 1)}
            />
          </>
        ) : null}
      </section>
    </section>
  )
}
