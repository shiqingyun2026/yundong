import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { api } from '../lib/api'
import type { OrderDetail, OrderListItem } from '../types'

const getStatusText = (status: number) => {
  if (status === 1) return '已支付'
  if (status === 2) return '已退款'
  return '待支付'
}

const getRefundTypeText = (refundType: OrderListItem['refund_type']) => {
  if (refundType === 'system') return '系统自动退款'
  if (refundType === 'manual') return '手动退款'
  return '-'
}

export function OrderListPage() {
  const [searchParams] = useSearchParams()
  const initialOrderNo = searchParams.get('order_no') || ''
  const [items, setItems] = useState<OrderListItem[]>([])
  const [orderNo, setOrderNo] = useState(initialOrderNo)
  const [nickName, setNickName] = useState('')
  const [courseTitle, setCourseTitle] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)

  const fetchOrders = async (
    nextOrderNo = orderNo,
    nextNickName = nickName,
    nextCourseTitle = courseTitle,
    nextStatus = status
  ) => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (nextOrderNo) params.set('order_no', nextOrderNo)
      if (nextNickName) params.set('nick_name', nextNickName)
      if (nextCourseTitle) params.set('course_title', nextCourseTitle)
      if (nextStatus) params.set('status', nextStatus)

      const data = await api.get<{ list: OrderListItem[] }>(`/orders?${params.toString()}`)
      setItems(data.list || [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取订单失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchOrders(initialOrderNo, '', '', '')
  }, [])

  const viewDetail = async (id: string) => {
    setDetailLoading(true)
    setDetailError('')

    try {
      const data = await api.get<OrderDetail>(`/orders/${id}`)
      setSelectedOrder(data)
    } catch (fetchError) {
      setDetailError(fetchError instanceof Error ? fetchError.message : '获取订单详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <section className="stack">
      <div>
        <p className="section-kicker">Orders</p>
        <h3>订单管理</h3>
      </div>

      <div className="panel filter-bar">
        <input placeholder="订单号" value={orderNo} onChange={event => setOrderNo(event.target.value)} />
        <input placeholder="用户昵称" value={nickName} onChange={event => setNickName(event.target.value)} />
        <input placeholder="课程名称" value={courseTitle} onChange={event => setCourseTitle(event.target.value)} />
        <select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">全部状态</option>
          <option value="0">待支付</option>
          <option value="1">已支付</option>
          <option value="2">已退款</option>
        </select>
        <button className="secondary-button" onClick={() => void fetchOrders()}>
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
                <th>订单号</th>
                <th>用户昵称</th>
                <th>课程名称</th>
                <th>金额</th>
                <th>状态</th>
                <th>支付时间</th>
                <th>退款时间</th>
                <th>退款类型</th>
                <th>退款结果</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.order_no}</td>
                  <td>{item.user_nick_name || '-'}</td>
                  <td>{item.course_title || '-'}</td>
                  <td>{item.amount}</td>
                  <td>{getStatusText(item.status)}</td>
                  <td>{item.pay_time || '-'}</td>
                  <td>{item.refund_time || '-'}</td>
                  <td>{getRefundTypeText(item.refund_type)}</td>
                  <td>{item.refund_reason || '-'}</td>
                  <td>
                    <button className="ghost-button compact-button" onClick={() => void viewDetail(item.id)}>
                      详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="panel subtle-panel stack">
        <div>
          <p className="section-kicker">Order Detail</p>
          <h3>订单详情</h3>
        </div>

        {detailLoading ? <p className="muted-text">加载详情中...</p> : null}
        {detailError ? <p className="error-text">{detailError}</p> : null}
        {!detailLoading && !detailError && !selectedOrder ? (
          <p className="muted-text">点击订单列表中的“详情”查看退款原因、课程信息和拼团信息。</p>
        ) : null}

        {!detailLoading && !detailError && selectedOrder ? (
          <div className="detail-grid">
            <div className="detail-card">
              <strong>订单信息</strong>
              <p>订单号：{selectedOrder.order_no}</p>
              <p>状态：{getStatusText(selectedOrder.status)}</p>
              <p>下单时间：{selectedOrder.create_time || '-'}</p>
              <p>支付时间：{selectedOrder.pay_time || '-'}</p>
              <p>退款时间：{selectedOrder.refund_time || '-'}</p>
              <p>退款类型：{getRefundTypeText(selectedOrder.refund_type)}</p>
              <p>退款原因：{selectedOrder.refund_reason || '-'}</p>
            </div>

            <div className="detail-card">
              <strong>用户与课程</strong>
              <p>用户昵称：{selectedOrder.user.nick_name || '-'}</p>
              <p>课程名称：{selectedOrder.course.title || '-'}</p>
              <p>上课时间：{selectedOrder.course.start_time || '-'}</p>
              <p>结束时间：{selectedOrder.course.end_time || '-'}</p>
              <p>上课地点：{selectedOrder.course.location_detail || '-'}</p>
              <p>支付金额：{selectedOrder.amount}</p>
            </div>

            <div className="detail-card">
              <strong>拼团信息</strong>
              <p>拼团 ID：{selectedOrder.group.id || '-'}</p>
              <p>当前人数：{selectedOrder.group.current_count}</p>
              <p>成团人数：{selectedOrder.group.target_count}</p>
              <p>拼团状态：{selectedOrder.group.status === 1 ? '成功' : selectedOrder.group.status === 2 ? '失败' : '进行中'}</p>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  )
}
