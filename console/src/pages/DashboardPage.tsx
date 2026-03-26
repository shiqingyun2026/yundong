import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../lib/api'
import type { DashboardOverview } from '../types'

const rangeOptions = [
  { key: 'today', label: '今日' },
  { key: '7d', label: '近 7 天' },
  { key: '30d', label: '近 30 天' }
] as const

const formatTrend = (delta: number | null) => {
  if (delta === null) return '实时'
  if (delta === 0) return '与上一周期持平'
  return `${delta > 0 ? '+' : ''}${delta}`
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)

export function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [rangeKey, setRangeKey] = useState<'today' | '7d' | '30d'>('today')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    void (async () => {
      setLoading(true)
      setError('')

      try {
        const data = await api.get<DashboardOverview>(`/dashboard/overview?range=${rangeKey}`)
        if (requestId !== requestIdRef.current) {
          return
        }
        setOverview(data)
      } catch (fetchError) {
        if (requestId !== requestIdRef.current) {
          return
        }
        setError(fetchError instanceof Error ? fetchError.message : '获取数据概览失败')
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    })()
  }, [rangeKey])

  const buildCoursePath = (dateField?: string) => {
    const params = new URLSearchParams()
    if (dateField && overview) {
      params.set('date_field', dateField)
      params.set('start_date', overview.range.start_date)
      params.set('end_date', overview.range.end_date)
    }
    return `/courses${params.toString() ? `?${params.toString()}` : ''}`
  }

  const buildGroupPath = (status?: string, dateField?: string) => {
    const params = new URLSearchParams()
    if (status) {
      params.set('status', status)
    }
    if (overview) {
      params.set('start_date', overview.range.start_date)
      params.set('end_date', overview.range.end_date)
    }
    if (dateField) {
      params.set('date_field', dateField)
    }
    return `/groups?${params.toString()}`
  }

  const buildOrderPath = (extra: Record<string, string>) => {
    const params = new URLSearchParams(extra)
    if (overview) {
      params.set('start_date', overview.range.start_date)
      params.set('end_date', overview.range.end_date)
    }
    return `/orders?${params.toString()}`
  }

  return (
    <section className="stack">
      <div className="page-actions">
        <div className="segmented-control" role="tablist" aria-label="数据范围">
          {rangeOptions.map(item => (
            <button
              key={item.key}
              className={`segment-button${rangeKey === item.key ? ' active' : ''}`}
              type="button"
              onClick={() => setRangeKey(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className="panel stack">
        {loading ? <p className="muted-text">加载中...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading && !error && overview ? (
          <>
            <p className="muted-text">
              统计范围：{overview.range.display_text}
            </p>

            <section className="overview-section stack">
              <div>
                <p className="section-kicker">Summary</p>
                <h3>数据概括</h3>
              </div>
              <div className="stats-grid">
                <Link className="stat-card stat-link-card" to="/courses?status=1">
                  <span>当前拼团中的课程</span>
                  <strong>{overview.metrics.grouping_course_count.current}</strong>
                  <em className="metric-trend muted">实时快照</em>
                </Link>
                <Link className="stat-card stat-link-card" to={buildCoursePath('start_time')}>
                  <span>{overview.range.label}要上课的课程</span>
                  <strong>{overview.metrics.class_course_count.current}</strong>
                  <em className={`metric-trend ${overview.metrics.class_course_count.direction}`}>
                    {overview.range.compare_label} {formatTrend(overview.metrics.class_course_count.delta)}
                  </em>
                </Link>
                <Link className="stat-card stat-link-card" to={buildCoursePath('publish_time')}>
                  <span>{overview.range.label}上架课程</span>
                  <strong>{overview.metrics.publish_course_count.current}</strong>
                  <em className={`metric-trend ${overview.metrics.publish_course_count.direction}`}>
                    {overview.range.compare_label} {formatTrend(overview.metrics.publish_course_count.delta)}
                  </em>
                </Link>
                <Link className="stat-card stat-link-card" to={buildGroupPath('success', 'success_time')}>
                  <span>{overview.range.label}成功成团</span>
                  <strong>{overview.metrics.success_group_count.current}</strong>
                  <em className={`metric-trend ${overview.metrics.success_group_count.direction}`}>
                    {overview.range.compare_label} {formatTrend(overview.metrics.success_group_count.delta)}
                  </em>
                </Link>
                <Link className="stat-card stat-link-card" to={buildGroupPath(undefined, 'joined_at')}>
                  <span>{overview.range.label}参团人数</span>
                  <strong>{overview.metrics.group_member_count.current}</strong>
                  <em className={`metric-trend ${overview.metrics.group_member_count.direction}`}>
                    {overview.range.compare_label} {formatTrend(overview.metrics.group_member_count.delta)}
                  </em>
                </Link>
                <Link className="stat-card stat-link-card" to={buildOrderPath({ status: '1', date_field: 'pay_time' })}>
                  <span>{overview.range.label}成团金额</span>
                  <strong>¥{formatCurrency(overview.metrics.successful_group_amount.current)}</strong>
                  <em className={`metric-trend ${overview.metrics.successful_group_amount.direction}`}>
                    {overview.range.compare_label} {formatTrend(overview.metrics.successful_group_amount.delta)}
                  </em>
                </Link>
              </div>
            </section>

            <section className="overview-section stack">
              <div>
                <p className="section-kicker">Alerts</p>
                <h3>异常提示</h3>
              </div>
              <section className="anomaly-grid">
                <Link className="panel subtle-panel anomaly-card" to="/groups?status=failed">
                  <span className="anomaly-label">异常提醒</span>
                  <strong>{overview.anomalies.failed_group_pending_refund_count}</strong>
                  <p>失败团仍有未退款订单，建议优先排查。</p>
                </Link>
                <Link className="panel subtle-panel anomaly-card" to="/groups?status=active">
                  <span className="anomaly-label">异常提醒</span>
                  <strong>{overview.anomalies.expired_active_group_count}</strong>
                  <p>团已过期但仍显示进行中，建议核对状态同步。</p>
                </Link>
                <Link className="panel subtle-panel anomaly-card" to="/groups">
                  <span className="anomaly-label">异常提醒</span>
                  <strong>{overview.anomalies.member_mismatch_group_count}</strong>
                  <p>团人数与成员记录不一致，建议检查成员写入或退款回滚。</p>
                </Link>
                <Link
                  className="panel subtle-panel anomaly-card"
                  to={buildOrderPath({ status: '2', refund_type: 'system', date_field: 'refund_time' })}
                >
                  <span className="anomaly-label">自动退款</span>
                  <strong>{overview.anomalies.auto_refund_order_count}</strong>
                  <p>{overview.range.label}系统自动退款订单数，可直接下钻查看退款订单。</p>
                </Link>
              </section>
            </section>

            <p className="muted-text">{overview.note}</p>
          </>
        ) : null}
      </section>
    </section>
  )
}
