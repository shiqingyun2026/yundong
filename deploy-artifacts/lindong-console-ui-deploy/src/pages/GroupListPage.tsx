import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PageBackButton } from '../components/PageBackButton'
import { PaginationBar } from '../components/PaginationBar'
import { api } from '../lib/api'
import type { GroupListItem, GroupListResponse } from '../types'

const getStatusText = (status: GroupListItem['status']) => {
  if (status === 'success') return '已成团'
  if (status === 'failed') return '已失败'
  return '进行中'
}

export function GroupListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const courseId = searchParams.get('course_id') || ''
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dateField, setDateField] = useState('created_at')
  const [items, setItems] = useState<GroupListItem[]>([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1, page: 1, size: 10 })
  const [summary, setSummary] = useState({ total: 0, active: 0, success: 0, failed: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const applySearch = (
    nextKeyword = keyword,
    nextStatus = status,
    nextStartDate = startDate,
    nextEndDate = endDate,
    nextDateField = dateField,
    nextPage = 1
  ) => {
    const params = new URLSearchParams()
    if (courseId) params.set('course_id', courseId)
    if (nextKeyword) params.set('keyword', nextKeyword)
    if (nextStatus) params.set('status', nextStatus)
    if (nextStartDate) params.set('start_date', nextStartDate)
    if (nextEndDate) params.set('end_date', nextEndDate)
    if (nextDateField) params.set('date_field', nextDateField)
    if (nextPage > 1) params.set('page', `${nextPage}`)
    setSearchParams(params)
  }

  const fetchList = async (
    nextKeyword = keyword,
    nextStatus = status,
    nextStartDate = startDate,
    nextEndDate = endDate,
    nextDateField = dateField,
    nextPage = page
  ) => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (nextKeyword) params.set('keyword', nextKeyword)
      if (nextStatus) params.set('status', nextStatus)
      if (nextStartDate) params.set('start_date', nextStartDate)
      if (nextEndDate) params.set('end_date', nextEndDate)
      if (nextDateField) params.set('date_field', nextDateField)
      if (courseId) params.set('course_id', courseId)
      params.set('page', `${nextPage}`)
      params.set('size', '10')

      const result = await api.get<GroupListResponse>(`/groups?${params.toString()}`)
      setItems(result.list || [])
      setPagination({
        total: result.total || 0,
        total_pages: result.total_pages || 1,
        page: result.page || nextPage,
        size: result.size || 10
      })
      setSummary(result.summary || { total: 0, active: 0, success: 0, failed: 0 })
      setPage(result.page || nextPage)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取拼团列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const nextKeyword = searchParams.get('keyword') || ''
    const nextStatus = searchParams.get('status') || ''
    const nextStartDate = searchParams.get('start_date') || ''
    const nextEndDate = searchParams.get('end_date') || ''
    const nextDateField = searchParams.get('date_field') || 'created_at'
    const nextPage = Number(searchParams.get('page') || '1') || 1

    setKeyword(nextKeyword)
    setStatus(nextStatus)
    setStartDate(nextStartDate)
    setEndDate(nextEndDate)
    setDateField(nextDateField)
    void fetchList(nextKeyword, nextStatus, nextStartDate, nextEndDate, nextDateField, nextPage)
  }, [searchParams])

  return (
    <section className="stack">
      <div className="stack compact-stack">
        {courseId ? <PageBackButton fallback="/courses" /> : null}
      </div>

      <section className="panel search-panel">
        <div className="filter-grid">
          <label className="filter-field">
            <span>关键词</span>
            <input placeholder="课程名称或拼团ID" value={keyword} onChange={event => setKeyword(event.target.value)} />
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
          <label className="filter-field">
            <span>时间维度</span>
            <select value={dateField} onChange={event => setDateField(event.target.value)}>
              <option value="created_at">按创建时间</option>
              <option value="expire_time">按截止时间</option>
              <option value="success_time">按成团时间</option>
              <option value="joined_at">按入团时间</option>
            </select>
          </label>
          <label className="filter-field">
            <span>开始日期</span>
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
          </label>
          <label className="filter-field">
            <span>结束日期</span>
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
          </label>
        </div>

        <div className="filter-actions">
          <button
            className="secondary-button compact-action-button query-button"
            type="button"
            onClick={() => applySearch(keyword, status, startDate, endDate, dateField, 1)}
          >
            查询
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span>拼团总数</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="stat-card">
          <span>进行中</span>
          <strong>{summary.active}</strong>
        </article>
        <article className="stat-card">
          <span>已成团</span>
          <strong>{summary.success}</strong>
        </article>
        <article className="stat-card">
          <span>已失败</span>
          <strong>{summary.failed}</strong>
        </article>
      </section>

      <section className="panel">
        {loading ? <p className="muted-text">加载中...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading && !error ? (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>拼团ID</th>
                  <th>所属课程</th>
                  <th>状态</th>
                  <th>当前人数</th>
                  <th>成团人数要求</th>
                  <th>开团人</th>
                  <th>团截止时间</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.course_title || '-'}</td>
                    <td>{getStatusText(item.status)}</td>
                    <td>{item.current_count}</td>
                    <td>{item.target_count}</td>
                    <td>{item.creator_name || '-'}</td>
                    <td>{item.expire_time || '-'}</td>
                    <td>{item.create_time || '-'}</td>
                    <td>
                      <Link className="table-link" to={`/groups/${item.id}`}>
                        详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar
              total={pagination.total}
              page={pagination.page}
              totalPages={pagination.total_pages}
              onPrev={() => applySearch(keyword, status, startDate, endDate, dateField, pagination.page - 1)}
              onNext={() => applySearch(keyword, status, startDate, endDate, dateField, pagination.page + 1)}
            />
          </>
        ) : null}
      </section>
    </section>
  )
}
