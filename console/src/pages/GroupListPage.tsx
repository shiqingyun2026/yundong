import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { api } from '../lib/api'
import type { GroupListItem } from '../types'

const getStatusText = (status: GroupListItem['status']) => {
  if (status === 'success') return '已成团'
  if (status === 'failed') return '已失败'
  return '进行中'
}

export function GroupListPage() {
  const [searchParams] = useSearchParams()
  const initialCourseId = searchParams.get('course_id') || ''
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [courseId] = useState(initialCourseId)
  const [items, setItems] = useState<GroupListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchList = async (
    nextKeyword = keyword,
    nextStatus = status,
    nextStartDate = startDate,
    nextEndDate = endDate
  ) => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (nextKeyword) params.set('keyword', nextKeyword)
      if (nextStatus) params.set('status', nextStatus)
      if (nextStartDate) params.set('start_date', nextStartDate)
      if (nextEndDate) params.set('end_date', nextEndDate)
      if (courseId) params.set('course_id', courseId)

      const result = await api.get<{ list: GroupListItem[] }>(`/groups?${params.toString()}`)
      setItems(result.list || [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取拼团列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchList(keyword, status, startDate, endDate)
  }, [courseId])

  const summary = items.reduce(
    (result, item) => {
      result.total += 1
      if (item.status === 'active') result.active += 1
      if (item.status === 'success') result.success += 1
      if (item.status === 'failed') result.failed += 1
      return result
    },
    { total: 0, active: 0, success: 0, failed: 0 }
  )

  return (
    <section className="stack">
      <div>
        <p className="section-kicker">Groups</p>
        <h3>{courseId ? '课程下拼团记录' : '拼团管理'}</h3>
      </div>

      <div className="panel filter-bar">
        <input placeholder="课程名称或拼团ID" value={keyword} onChange={event => setKeyword(event.target.value)} />
        <select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">全部状态</option>
          <option value="active">进行中</option>
          <option value="success">已成团</option>
          <option value="failed">已失败</option>
        </select>
        <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
        <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
        <button className="secondary-button" onClick={() => void fetchList()}>
          搜索
        </button>
      </div>

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
          <table className="data-table">
            <thead>
              <tr>
                <th>拼团ID</th>
                <th>所属课程</th>
                <th>状态</th>
                <th>当前人数</th>
                <th>成团人数</th>
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
        ) : null}
      </section>
    </section>
  )
}
