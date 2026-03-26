import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PaginationBar } from '../components/PaginationBar'
import { api } from '../lib/api'
import type { CourseListItem } from '../types'

const getStatusText = (status: number) => {
  if (status === 0) return '待上架'
  if (status === 1) return '拼团中'
  if (status === 2) return '拼团失败'
  if (status === 3) return '等待上课'
  if (status === 4) return '上课中'
  if (status === 5) return '已结课'
  if (status === 6) return '已下架'
  return '未知'
}

export function CourseListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dateField, setDateField] = useState('start_time')
  const [items, setItems] = useState<CourseListItem[]>([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1, page: 1, size: 10 })
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
      if (nextKeyword) {
        params.set('keyword', nextKeyword)
      }
      if (nextStatus) {
        params.set('status', nextStatus)
      }
      if (nextStartDate) {
        params.set('start_date', nextStartDate)
      }
      if (nextEndDate) {
        params.set('end_date', nextEndDate)
      }
      if (nextDateField) {
        params.set('date_field', nextDateField)
      }
      params.set('page', `${nextPage}`)
      params.set('size', '10')
      const result = await api.get<{
        list: CourseListItem[]
        total: number
        total_pages: number
        page: number
        size: number
      }>(`/courses?${params.toString()}`)
      setItems(result.list || [])
      setPagination({
        total: result.total || 0,
        total_pages: result.total_pages || 1,
        page: result.page || nextPage,
        size: result.size || 10
      })
      setPage(result.page || nextPage)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取课程失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const nextKeyword = searchParams.get('keyword') || ''
    const nextStatus = searchParams.get('status') || ''
    const nextStartDate = searchParams.get('start_date') || ''
    const nextEndDate = searchParams.get('end_date') || ''
    const nextDateField = searchParams.get('date_field') || 'start_time'
    const nextPage = Number(searchParams.get('page') || '1') || 1

    setKeyword(nextKeyword)
    setStatus(nextStatus)
    setStartDate(nextStartDate)
    setEndDate(nextEndDate)
    setDateField(nextDateField)
    void fetchList(nextKeyword, nextStatus, nextStartDate, nextEndDate, nextDateField, nextPage)
  }, [searchParams])

  const offlineCourse = async (id: string) => {
    if (!window.confirm('确认下架该课程吗？')) {
      return
    }

    setError('')

    try {
      await api.put(`/courses/${id}/offline`)
      await fetchList(keyword, status, startDate, endDate, dateField, page)
    } catch (offlineError) {
      setError(offlineError instanceof Error ? offlineError.message : '下架课程失败')
    }
  }

  return (
    <section className="stack">
      <section className="panel search-panel">
        <div className="filter-grid">
          <label className="filter-field">
            <span>课程名称</span>
            <input
              placeholder="按课程名称搜索"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>课程状态</span>
            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              <option value="0">待上架</option>
              <option value="1">拼团中</option>
              <option value="2">拼团失败</option>
              <option value="3">等待上课</option>
              <option value="4">上课中</option>
              <option value="5">已结课</option>
              <option value="6">已下架</option>
            </select>
          </label>
          <label className="filter-field">
            <span>时间维度</span>
            <select value={dateField} onChange={event => setDateField(event.target.value)}>
              <option value="start_time">按上课时间</option>
              <option value="publish_time">按上架时间</option>
              <option value="deadline">按报名截止</option>
              <option value="unpublish_time">按下架时间</option>
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

        <div className="page-actions">
          <button
            className="secondary-button compact-action-button query-button"
            type="button"
            onClick={() => applySearch(keyword, status, startDate, endDate, dateField, 1)}
          >
            查询
          </button>
          <Link className="primary-button link-button compact-action-button" to="/courses/new">
            新建课程
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
                      <th>课程名称</th>
                      <th>报名截止</th>
                      <th>上课时间</th>
                      <th>所在区域</th>
                      <th>详细地点</th>
                      <th>拼团价</th>
                      <th>成团人数要求</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.deadline || '-'}</td>
                    <td>{item.start_time || '-'}</td>
                    <td>{item.location_district || '-'}</td>
                    <td>{item.location_detail || '-'}</td>
                    <td>{item.group_price}</td>
                    <td>{item.target_count || '-'}</td>
                    <td>{getStatusText(item.status)}</td>
                    <td>
                      <div className="button-row">
                        <Link className="table-link" to={`/courses/${item.id}`}>
                          查看
                        </Link>
                        {item.status === 0 || item.status === 2 ? (
                          <Link className="table-link" to={`/courses/${item.id}/edit`}>
                            编辑
                          </Link>
                        ) : null}
                        <Link className="table-link" to={`/groups?course_id=${item.id}`}>
                          查看拼团
                        </Link>
                        {item.status === 0 || item.status === 2 || item.status === 5 ? (
                          <button className="table-link danger-link-button" onClick={() => void offlineCourse(item.id)}>
                            下架
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
              onPrev={() => applySearch(keyword, status, startDate, endDate, dateField, pagination.page - 1)}
              onNext={() => applySearch(keyword, status, startDate, endDate, dateField, pagination.page + 1)}
            />
          </>
        ) : null}
      </section>
    </section>
  )
}
