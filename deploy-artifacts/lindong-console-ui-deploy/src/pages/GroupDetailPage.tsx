import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageBackButton } from '../components/PageBackButton'
import { api } from '../lib/api'
import type { GroupDetail } from '../types'

const getStatusText = (status: GroupDetail['status']) => {
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

export function GroupDetailPage() {
  const { id } = useParams()
  const [detail, setDetail] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) {
      return
    }

    void (async () => {
      try {
        const data = await api.get<GroupDetail>(`/groups/${id}`)
        setDetail(data)
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : '获取拼团详情失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  return (
    <section className="stack">
      <div className="stack compact-stack">
        <PageBackButton fallback="/groups" />
        <div>
          <p className="section-kicker">Group Detail</p>
          <h3>拼团详情</h3>
        </div>
      </div>

      <section className="panel">
        {loading ? <p className="muted-text">加载中...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading && !error && detail ? (
          <div className="detail-grid">
            <div className="detail-card">
              <strong>基础信息</strong>
              <p>拼团 ID：{detail.id}</p>
              <p>所属课程：{detail.course_title || '-'}</p>
              <p>状态：{getStatusText(detail.status)}</p>
              <p>课程当前状态：{detail.course_status_text || '-'}</p>
              <p>当前人数：{detail.current_count}</p>
              <p>成团人数要求：{detail.target_count}</p>
              <p>开团人：{detail.creator_name || '-'}</p>
              <p>团截止时间：{detail.expire_time || '-'}</p>
              <p>创建时间：{detail.create_time || '-'}</p>
            </div>

            <div className="detail-card">
              <strong>课程时间</strong>
              <p>上架时间：{detail.publish_time || '-'}</p>
              <p>下架时间：{detail.unpublish_time || '-'}</p>
              <p>报名截止：{detail.deadline || '-'}</p>
              <p>开课时间：{detail.start_time || '-'}</p>
              <p>结束时间：{detail.end_time || '-'}</p>
            </div>

            <div className="detail-card">
              <strong>规则与订单概况</strong>
              <p>已支付订单：{detail.paid_order_count}</p>
              <p>已退款订单：{detail.refund_order_count}</p>
              {detail.rules.map(item => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>
        ) : null}
      </section>

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
          <p className="muted-text">当前未发现明显异常，拼团、成员和退款数据看起来一致。</p>
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
                <th>昵称</th>
                <th>入团时间</th>
                <th>关联订单号</th>
                <th>订单状态</th>
              </tr>
            </thead>
            <tbody>
              {detail.members.map(item => (
                <tr key={`${item.user_id}-${item.order_no}`}>
                  <td>{item.nick_name || '-'}</td>
                  <td>{item.joined_at || '-'}</td>
                  <td>
                    {item.order_no ? (
                      <Link className="table-link" to={`/orders?order_no=${item.order_no}`}>
                        {item.order_no}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{getOrderStatusText(item.order_status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {detail ? (
        <p className="muted-text">入团时间表示该成员支付成功后被写入拼团成员记录的时间。</p>
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
                <th>用户昵称</th>
                <th>金额</th>
                <th>订单状态</th>
                <th>支付时间</th>
                <th>退款时间</th>
                <th>退款原因</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {detail.orders.map(item => (
                <tr key={item.id}>
                  <td>{item.order_no}</td>
                  <td>{item.user_nick_name || '-'}</td>
                  <td>{item.amount}</td>
                  <td>{getOrderStatusText(item.status)}</td>
                  <td>{item.pay_time || '-'}</td>
                  <td>{item.refund_time || '-'}</td>
                  <td>{item.refund_reason || '-'}</td>
                  <td>
                    <Link className="table-link" to={`/orders?order_no=${item.order_no}`}>
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
