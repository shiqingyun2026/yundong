import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../lib/api'
import type { DashboardMetric, DashboardOverview } from '../types'

const rangeOptions = [
  { key: 'today', label: '今日' },
  { key: '7d', label: '近 7 天' },
  { key: '30d', label: '近 30 天' }
] as const

const formatTrend = (delta: number | null) => {
  if (delta === null) return '实时'
  if (delta === 0) return '持平'
  return `${delta > 0 ? '+' : ''}${delta}`
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100)

const emptyMetric: DashboardMetric = {
  current: 0,
  previous: null,
  delta: null,
  direction: 'none'
}

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
        setError(fetchError instanceof Error ? fetchError.message : '获取课包概览失败')
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    })()
  }, [rangeKey])

  const packageMetrics = overview?.package_metrics
  const packageAnomalies = overview?.package_anomalies
  const activePackageMetric = packageMetrics?.active_package_count || emptyMetric
  const createdPackageMetric = packageMetrics?.created_package_count || emptyMetric
  const successGroupMetric = packageMetrics?.success_group_count || emptyMetric
  const paidMemberMetric = packageMetrics?.paid_member_count || emptyMetric
  const paidAmountMetric = packageMetrics?.paid_amount || emptyMetric
  const refundedOrderMetric = packageMetrics?.refunded_order_count || emptyMetric

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
            <div>
              <p className="section-kicker">Package Group V2.2</p>
              <h3>课包拼团概览</h3>
            </div>

            <p className="muted-text">统计范围：{overview.range.display_text}</p>

            <section className="overview-section stack">
              <div>
                <p className="section-kicker">Summary</p>
                <h3>课包经营数据</h3>
              </div>
              <div className="stats-grid">
                <Link className="stat-card stat-link-card" to="/packages?status=active">
                  <span>当前上架课包</span>
                  <strong>{activePackageMetric.current}</strong>
                  <em className="metric-trend muted">实时快照</em>
                </Link>
                <Link className="stat-card stat-link-card" to="/packages">
                  <span>{overview.range.label}新增课包</span>
                  <strong>{createdPackageMetric.current}</strong>
                  <em className={`metric-trend ${createdPackageMetric.direction}`}>
                    {overview.range.compare_label} {formatTrend(createdPackageMetric.delta)}
                  </em>
                </Link>
                <Link className="stat-card stat-link-card" to="/package-groups?status=success">
                  <span>{overview.range.label}成功成团</span>
                  <strong>{successGroupMetric.current}</strong>
                  <em className={`metric-trend ${successGroupMetric.direction}`}>
                    {overview.range.compare_label} {formatTrend(successGroupMetric.delta)}
                  </em>
                </Link>
                <Link className="stat-card stat-link-card" to="/package-orders?status=success">
                  <span>{overview.range.label}支付人数</span>
                  <strong>{paidMemberMetric.current}</strong>
                  <em className={`metric-trend ${paidMemberMetric.direction}`}>
                    {overview.range.compare_label} {formatTrend(paidMemberMetric.delta)}
                  </em>
                </Link>
                <Link className="stat-card stat-link-card" to="/package-orders?status=success">
                  <span>{overview.range.label}支付金额</span>
                  <strong>¥{formatCurrency(paidAmountMetric.current)}</strong>
                  <em className={`metric-trend ${paidAmountMetric.direction}`}>
                    {overview.range.compare_label} {formatTrend(paidAmountMetric.delta)}
                  </em>
                </Link>
                <Link className="stat-card stat-link-card" to="/package-orders?status=refunded">
                  <span>{overview.range.label}退款订单</span>
                  <strong>{refundedOrderMetric.current}</strong>
                  <em className={`metric-trend ${refundedOrderMetric.direction}`}>
                    {overview.range.compare_label} {formatTrend(refundedOrderMetric.delta)}
                  </em>
                </Link>
              </div>
            </section>

            <section className="overview-section stack">
              <div>
                <p className="section-kicker">Alerts</p>
                <h3>异常提醒</h3>
              </div>
              <section className="anomaly-grid">
                <Link className="panel subtle-panel anomaly-card" to="/package-groups?status=failed">
                  <span className="anomaly-label">异常提醒</span>
                  <strong>{packageAnomalies?.failed_group_pending_refund_count || 0}</strong>
                  <p>失败团仍有未处理成功订单，建议优先核对退款状态。</p>
                </Link>
                <Link className="panel subtle-panel anomaly-card" to="/package-groups?status=active">
                  <span className="anomaly-label">异常提醒</span>
                  <strong>{packageAnomalies?.expired_active_group_count || 0}</strong>
                  <p>团已过截止时间但仍显示进行中，建议检查状态清理任务。</p>
                </Link>
                <Link className="panel subtle-panel anomaly-card" to="/package-groups">
                  <span className="anomaly-label">异常提醒</span>
                  <strong>{packageAnomalies?.member_mismatch_group_count || 0}</strong>
                  <p>团人数与成功订单人数不一致，建议排查支付回调或退款回滚。</p>
                </Link>
                <Link className="panel subtle-panel anomaly-card" to="/package-orders?status=refunded">
                  <span className="anomaly-label">自动退款</span>
                  <strong>{packageAnomalies?.auto_refund_order_count || 0}</strong>
                  <p>{overview.range.label}系统自动退款订单数，可直接下钻查看退款订单。</p>
                </Link>
              </section>
            </section>

            <section className="panel subtle-panel stack">
              <div>
                <p className="section-kicker">Quick Access</p>
                <h3>快捷入口</h3>
              </div>
              <div className="stats-grid">
                <Link className="stat-card stat-link-card" to="/packages/new">
                  <span>课包管理</span>
                  <strong>新建课包</strong>
                  <em className="metric-trend muted">维护基础配置与教练信息</em>
                </Link>
                <Link className="stat-card stat-link-card" to="/package-groups">
                  <span>课包拼团</span>
                  <strong>查看开团状态</strong>
                  <em className="metric-trend muted">支持按状态与课包筛选</em>
                </Link>
                <Link className="stat-card stat-link-card" to="/package-orders">
                  <span>课包订单</span>
                  <strong>处理退款</strong>
                  <em className="metric-trend muted">支持手动退款与订单排查</em>
                </Link>
                <Link className="stat-card stat-link-card" to="/logs">
                  <span>操作日志</span>
                  <strong>核对后台动作</strong>
                  <em className="metric-trend muted">查看新增、编辑、退款记录</em>
                </Link>
              </div>
            </section>

            <p className="muted-text">{overview.note}</p>
          </>
        ) : null}
      </section>
    </section>
  )
}
