import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../lib/api'
import type { CourseListItem } from '../types'

export function CourseListPage() {
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<CourseListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchList = async (nextKeyword = '') => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (nextKeyword) {
        params.set('keyword', nextKeyword)
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
        <button className="secondary-button" onClick={() => void fetchList(keyword)}>
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
                <th>上课时间</th>
                <th>地点</th>
                <th>拼团价</th>
                <th>原价</th>
                <th>最大成团次数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.start_time || '-'}</td>
                  <td>{item.location_detail || '-'}</td>
                  <td>{item.group_price}</td>
                  <td>{item.original_price}</td>
                  <td>{item.max_groups || '-'}</td>
                  <td>
                    <Link className="table-link" to={`/courses/${item.id}/edit`}>
                      编辑
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
