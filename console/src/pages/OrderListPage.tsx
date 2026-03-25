import { useEffect, useState } from 'react'

import { api } from '../lib/api'
import type { OrderListItem } from '../types'

export function OrderListPage() {
  const [items, setItems] = useState<OrderListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.get<{ list: OrderListItem[] }>('/orders')
        setItems(data.list || [])
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : '获取订单失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <section className="stack">
      <div>
        <p className="section-kicker">Orders</p>
        <h3>订单管理</h3>
      </div>

      <section className="panel">
        {loading ? <p className="muted-text">加载中...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading && !error ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>用户昵称</th>
                <th>课程名称</th>
                <th>金额</th>
                <th>状态</th>
                <th>下单时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.order_no}</td>
                  <td>{item.user_nick_name || '-'}</td>
                  <td>{item.course_title || '-'}</td>
                  <td>{item.amount}</td>
                  <td>{item.status === 1 ? '已支付' : item.status === 2 ? '已退款' : '待支付'}</td>
                  <td>{item.create_time || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </section>
  )
}
