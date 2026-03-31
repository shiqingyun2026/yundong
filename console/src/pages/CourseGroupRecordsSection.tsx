import { Link } from 'react-router-dom'

import type { CourseGroupRecord } from '../types'
import { getGroupStatusText } from './courseFormHelpers'

export function CourseGroupRecordsSection({
  id,
  groupsLoading,
  groupsError,
  groupItems,
  groupSummary
}: {
  id: string
  groupsLoading: boolean
  groupsError: string
  groupItems: CourseGroupRecord[]
  groupSummary: { total: number; active: number; success: number; failed: number }
}) {
  return (
    <section className="panel subtle-panel stack">
      <div>
        <p className="section-kicker">Course Groups</p>
        <h3>拼团记录</h3>
      </div>

      {groupsLoading ? <p className="muted-text">加载拼团记录中...</p> : null}
      {groupsError ? <p className="error-text">{groupsError}</p> : null}

      {!groupsLoading && !groupsError ? (
        <>
          <section className="stats-grid">
            <article className="stat-card">
              <span>累计开团</span>
              <strong>{groupSummary.total}</strong>
            </article>
            <article className="stat-card">
              <span>进行中</span>
              <strong>{groupSummary.active}</strong>
            </article>
            <article className="stat-card">
              <span>已成团</span>
              <strong>{groupSummary.success}</strong>
            </article>
            <article className="stat-card">
              <span>已失败</span>
              <strong>{groupSummary.failed}</strong>
            </article>
          </section>

          {groupItems.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>拼团ID</th>
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
                {groupItems.map(item => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{getGroupStatusText(item.status)}</td>
                    <td>{item.current_count}</td>
                    <td>{item.target_count}</td>
                    <td>{item.creator_name || '-'}</td>
                    <td>{item.expire_time || '-'}</td>
                    <td>{item.create_time || '-'}</td>
                    <td>
                      <Link className="table-link" to={`/groups/${item.id}`}>
                        查看详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted-text">当前课程还没有产生拼团记录，后续开团后会在这里展示历史团和进行中团。</p>
          )}
        </>
      ) : null}
    </section>
  )
}
