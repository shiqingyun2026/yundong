import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageBackButton } from '../components/PageBackButton'
import { api } from '../lib/api'
import type { PackageGroupDetail } from '../types'

const getGroupStatusText = (status: PackageGroupDetail['status']) => {
  if (status === 'success') return '已成团'
  if (status === 'failed') return '已失败'
  return '进行中'
}

const getOrderStatusText = (status: string) => {
  if (status === 'success') return '已支付'
  if (status === 'refunded') return '已退款'
  if (status === 'closed') return '已关闭'
  return '待支付'
}

const getRefundTypeText = (refundType: '' | 'system' | 'manual') => {
  if (refundType === 'system') return '系统自动退款'
  if (refundType === 'manual') return '手动退款'
  return '-'
}

const getActionText = (action: '' | 'start' | 'join') => {
  if (action === 'start') return '开团'
  if (action === 'join') return '参团'
  return '-'
}

const getRoleText = (role: 'leader' | 'member') => (role === 'leader' ? '团长' : '参团')

export function PackageGroupDetailPage() {
  const { id } = useParams()
  const [detail, setDetail] = useState<PackageGroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) {
      return
    }

    void (async () => {
      setLoading(true)
      setError('')

      try {
        const data = await api.get<PackageGroupDetail>(`/package-groups/${id}`)
        setDetail(data)
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : '获取课包拼团详情失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  return (
    <section className="stack">
      <div className="stack compact-stack">
        <PageBackButton fallback="/package-groups" />
        <div>
          <p className="section-kicker">Package Group Detail</p>
          <h3>课包拼团详情</h3>
        </div>
      </div>

      <section className="panel">
        {loading ? <p className="muted-text">加载中...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading && !error && detail ? (
          <div className="detail-grid">
            <div className="detail-card">
              <strong>拼团基础信息</strong>
              <p>拼团 ID：{detail.id}</p>
              <p>所属课包：{detail.package_name || '-'}</p>
              <p>课包 ID：{detail.package_id || '-'}</p>
              <p>拼团状态：{getGroupStatusText(detail.status)}</p>
              <p>课包状态：{detail.package_status_text || '-'}</p>
              <p>
                拼团进度：{detail.current_count}/{detail.target_count}
              </p>
              <p>单人金额：{detail.member_amount_text || '-'}</p>
            </div>

            <div className="detail-card">
              <strong>排课与时间</strong>
              <p>排课规则：{detail.schedule_text || '-'}</p>
              <p>开团时间：{detail.create_time || '-'}</p>
              <p>截止时间：{detail.deadline || '-'}</p>
              <p>成团时间：{detail.success_time || '-'}</p>
              <p>首课时间：{detail.first_class_time || '-'}</p>
              <p>固定上课：周{detail.weekday || '-'} {detail.hour ? `${detail.hour}:00` : '-'}</p>
            </div>

            <div className="detail-card">
              <strong>订单概况</strong>
              <p>已支付订单：{detail.summary.paid_order_count}</p>
              <p>已退款订单：{detail.summary.refunded_order_count}</p>
              <p>待支付订单：{detail.summary.pending_order_count}</p>
              <p>创建人 ID：{detail.creator_id || '-'}</p>
              <p>成员记录数：{detail.members.length}</p>
              <p>关联订单数：{detail.orders.length}</p>
            </div>
          </div>
        ) : null}
      </section>

      {detail ? (
        <section className="panel stack">
          <div>
            <p className="section-kicker">Leader</p>
            <h3>团长信息</h3>
          </div>

          {detail.leader ? (
            <div className="detail-grid">
              <div className="detail-card">
                <strong>报名信息</strong>
                <p>孩子昵称：{detail.leader.child_nickname || '-'}</p>
                <p>孩子年龄：{detail.leader.child_age ?? '-'}</p>
                <p>家长手机号：{detail.leader.parent_mobile || '未补录'}</p>
                <p>报名时间：{detail.leader.joined_at || '-'}</p>
                <p>动作：{getActionText(detail.leader.action)}</p>
              </div>
              <div className="detail-card">
                <strong>关联订单</strong>
                <p>订单号：{detail.leader.order_no || '-'}</p>
                <p>订单 ID：{detail.leader.order_id || '-'}</p>
                <div className="button-row">
                  <Link className="secondary-button" to={`/package-orders?package_group_id=${detail.id}&keyword=${encodeURIComponent(detail.leader.order_no)}`}>
                    查看订单
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <p className="muted-text">当前未找到团长订单信息。</p>
          )}
        </section>
      ) : null}

      {detail && detail.anomalies.length ? (
        <section className="panel subtle-panel stack">
          <div>
            <p className="section-kicker">Anomalies</p>
            <h3>异常排查提示</h3>
          </div>
          {detail.anomalies.map(item => (
            <p key={item} className="error-text">
              {item}
            </p>
          ))}
        </section>
      ) : detail ? (
        <section className="panel subtle-panel stack">
          <div>
            <p className="section-kicker">Anomalies</p>
            <h3>异常排查提示</h3>
          </div>
          <p className="muted-text">当前未发现明显异常。</p>
        </section>
      ) : null}

      {detail ? (
        <section className="panel stack">
          <div>
            <p className="section-kicker">Members</p>
            <h3>成员信息</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>成员类型</th>
                <th>孩子信息</th>
                <th>家长手机号</th>
                <th>入团时间</th>
                <th>关联订单</th>
                <th>订单状态</th>
              </tr>
            </thead>
            <tbody>
              {detail.members.map(item => (
                <tr key={item.order_id}>
                  <td>
                    <div>
                      <strong>{getRoleText(item.role)}</strong>
                      <p className="table-subtext">{getActionText(item.action)}</p>
                    </div>
                  </td>
                  <td>
                    <div>
                      <strong>{item.child_nickname || '-'}</strong>
                      <p className="table-subtext">年龄：{item.child_age ?? '未补录'}</p>
                      <p className="table-subtext">用户昵称：{item.user_nickname || '-'}</p>
                    </div>
                  </td>
                  <td>{item.parent_mobile || '未补录'}</td>
                  <td>{item.joined_at || '-'}</td>
                  <td>
                    <Link className="table-link" to={`/package-orders?package_group_id=${detail.id}&keyword=${encodeURIComponent(item.order_no)}`}>
                      {item.order_no || '-'}
                    </Link>
                  </td>
                  <td>{getOrderStatusText(item.order_status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {detail ? (
        <section className="panel stack">
          <div>
            <p className="section-kicker">Orders</p>
            <h3>关联订单</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>报名信息</th>
                <th>支付金额</th>
                <th>订单状态</th>
                <th>支付时间</th>
                <th>退款信息</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {detail.orders.map(item => (
                <tr key={item.id}>
                  <td>
                    <div>
                      <strong>{item.order_no}</strong>
                      <p className="table-subtext">{item.create_time || '-'}</p>
                    </div>
                  </td>
                  <td>
                    <div>
                      <strong>{item.child_nickname || '-'}</strong>
                      <p className="table-subtext">年龄：{item.child_age ?? '未补录'}</p>
                      <p className="table-subtext">手机号：{item.phone || '未补录'}</p>
                      <p className="table-subtext">
                        用户：{item.nickname || '-'} / {getActionText(item.action)}
                      </p>
                    </div>
                  </td>
                  <td>{item.amount_text || `¥${(item.amount_fen / 100).toFixed(2)}`}</td>
                  <td>{getOrderStatusText(item.status)}</td>
                  <td>{item.pay_time || '-'}</td>
                  <td>
                    <div>
                      <span>{getRefundTypeText(item.refund_type)}</span>
                      <p className="table-subtext">{item.refund_reason || '无'}</p>
                      <p className="table-subtext">退款时间：{item.refund_time || '-'}</p>
                    </div>
                  </td>
                  <td>
                    <Link className="table-link" to={`/package-orders?package_group_id=${detail.id}&keyword=${encodeURIComponent(item.order_no)}`}>
                      查看订单
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </section>
  )
}
