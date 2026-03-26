import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../lib/api'
import type { CourseListItem } from '../types'

const getStatusText = (status: number) => {
  if (status === 0) return '待上架'
  if (status === 1) return '拼团中'
  if (status === 2) return '拼团失败'
  if (status === 3) return '等待上课'
  if (status === 4) return '上课中'
  if (status === 5) return '已结课'
  return '未知'
}

export function CourseListPage() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [items, setItems] = useState<CourseListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchList = async (nextKeyword = '', nextStatus = '') => {
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
      const result = await api.get<{ list: CourseListItem[] }>(`/courses?${params.toString()}`)
      setItems(result.list || [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取课程失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchList()
  }, [])

  const offlineCourse = async (id: string) => {
    if (!window.confirm('确认下架该课程吗？')) {
      return
    }

    setError('')

    try {
      await api.put(`/courses/${id}/offline`)
      await fetchList(keyword, status)
    } catch (offlineError) {
      setError(offlineError instanceof Error ? offlineError.message : '下架课程失败')
    }
  }

  return (
    <section className="stack">
      <div className="page-actions">
        <div>
          <p className="section-kicker">Courses</p>
          <h3>课程管理</h3>
        </div>
        <Link className="primary-button link-button" to="/courses/new">
          新建课程
        </Link>
      </div>

      <div className="panel filter-bar">
        <input
          placeholder="按课程名称搜索"
          value={keyword}
          onChange={event => setKeyword(event.target.value)}
        />
        <select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">全部状态</option>
          <option value="0">待上架</option>
          <option value="1">拼团中</option>
          <option value="2">拼团失败</option>
          <option value="3">等待上课</option>
          <option value="4">上课中</option>
          <option value="5">已结课</option>
        </select>
        <button className="secondary-button" onClick={() => void fetchList(keyword, status)}>
          搜索
        </button>
      </div>

      <section className="panel">
        {loading ? <p className="muted-text">加载中...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading && !error ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>课程名称</th>
                <th>上架时间</th>
                <th>下架时间</th>
                <th>报名截止</th>
                <th>上课时间</th>
                <th>结束时间</th>
                <th>地点</th>
                <th>拼团价</th>
                <th>原价</th>
                <th>成团人数</th>
                <th>最大成团次数</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.publish_time || '-'}</td>
                  <td>{item.unpublish_time || '-'}</td>
                  <td>{item.deadline || '-'}</td>
                  <td>{item.start_time || '-'}</td>
                  <td>{item.end_time || '-'}</td>
                  <td>{item.location_detail || '-'}</td>
                  <td>{item.group_price}</td>
                  <td>{item.original_price}</td>
                  <td>{item.target_count || '-'}</td>
                  <td>{item.max_groups || '-'}</td>
                  <td>{getStatusText(item.status)}</td>
                  <td>
                    <div className="button-row">
                      <Link className="table-link" to={`/courses/${item.id}/edit`}>
                        编辑
                      </Link>
                      <Link className="table-link" to={`/groups?course_id=${item.id}`}>
                        查看拼团
                      </Link>
                      {item.status !== 5 ? (
                        <button className="ghost-button compact-button" onClick={() => void offlineCourse(item.id)}>
                          下架
                        </button>
                      ) : null}
                    </div>
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
