import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PaginationBar } from '../components/PaginationBar'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<OrderListItem[]>([])
  const [orderNo, setOrderNo] = useState('')
  const [nickName, setNickName] = useState('')
  const [courseTitle, setCourseTitle] = useState('')
  const [status, setStatus] = useState('')
  const [refundType, setRefundType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dateField, setDateField] = useState('create_time')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1, page: 1, size: 10 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [refundSubmitting, setRefundSubmitting] = useState(false)

  const applySearch = (
    nextOrderNo = orderNo,
    nextNickName = nickName,
    nextCourseTitle = courseTitle,
    nextStatus = status,
    nextRefundType = refundType,
    nextStartDate = startDate,
    nextEndDate = endDate,
    nextDateField = dateField,
    nextPage = 1
  ) => {
    const params = new URLSearchParams()
    if (nextOrderNo) params.set('order_no', nextOrderNo)
    if (nextNickName) params.set('nick_name', nextNickName)
    if (nextCourseTitle) params.set('course_title', nextCourseTitle)
    if (nextStatus) params.set('status', nextStatus)
    if (nextRefundType) params.set('refund_type', nextRefundType)
    if (nextStartDate) params.set('start_date', nextStartDate)
    if (nextEndDate) params.set('end_date', nextEndDate)
    if (nextDateField) params.set('date_field', nextDateField)
    if (nextPage > 1) params.set('page', `${nextPage}`)
    setSearchParams(params)
  }

  const fetchOrders = async (
    nextOrderNo = orderNo,
    nextNickName = nickName,
    nextCourseTitle = courseTitle,
    nextStatus = status,
    nextRefundType = refundType,
    nextStartDate = startDate,
    nextEndDate = endDate,
    nextDateField = dateField,
    nextPage = page
  ) => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (nextOrderNo) params.set('order_no', nextOrderNo)
      if (nextNickName) params.set('nick_name', nextNickName)
      if (nextCourseTitle) params.set('course_title', nextCourseTitle)
      if (nextStatus) params.set('status', nextStatus)
      if (nextRefundType) params.set('refund_type', nextRefundType)
      if (nextStartDate) params.set('start_date', nextStartDate)
      if (nextEndDate) params.set('end_date', nextEndDate)
      if (nextDateField) params.set('date_field', nextDateField)
      params.set('page', `${nextPage}`)
      params.set('size', '10')

      const data = await api.get<{
        list: OrderListItem[]
        total: number
        total_pages: number
        page: number
        size: number
      }>(`/orders?${params.toString()}`)
      setItems(data.list || [])
      setPagination({
        total: data.total || 0,
        total_pages: data.total_pages || 1,
        page: data.page || nextPage,
        size: data.size || 10
      })
      setPage(data.page || nextPage)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取订单失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const nextOrderNo = searchParams.get('order_no') || ''
    const nextNickName = searchParams.get('nick_name') || ''
    const nextCourseTitle = searchParams.get('course_title') || ''
    const nextStatus = searchParams.get('status') || ''
    const nextRefundType = searchParams.get('refund_type') || ''
    const nextStartDate = searchParams.get('start_date') || ''
    const nextEndDate = searchParams.get('end_date') || ''
    const nextDateField = searchParams.get('date_field') || 'create_time'
    const nextPage = Number(searchParams.get('page') || '1') || 1

    setOrderNo(nextOrderNo)
    setNickName(nextNickName)
    setCourseTitle(nextCourseTitle)
    setStatus(nextStatus)
    setRefundType(nextRefundType)
    setStartDate(nextStartDate)
    setEndDate(nextEndDate)
    setDateField(nextDateField)
    void fetchOrders(nextOrderNo, nextNickName, nextCourseTitle, nextStatus, nextRefundType, nextStartDate, nextEndDate, nextDateField, nextPage)
  }, [searchParams])

  const viewDetail = async (id: string) => {
    setDetailLoading(true)
    setDetailError('')
    setRefundReason('')

    try {
      const data = await api.get<OrderDetail>(`/orders/${id}`)
      setSelectedOrder(data)
    } catch (fetchError) {
      setDetailError(fetchError instanceof Error ? fetchError.message : '获取订单详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleRefund = async () => {
    if (!selectedOrder) {
      return
    }

    const reason = refundReason.trim()
    if (!reason) {
      setDetailError('退款原因不能为空')
      return
    }

    if (!window.confirm('确认对该订单执行手动退款吗？')) {
      return
    }

    setRefundSubmitting(true)
    setDetailError('')

    try {
      await api.post(`/orders/${selectedOrder.id}/refund`, { reason })
      await fetchOrders(orderNo, nickName, courseTitle, status, refundType, startDate, endDate, dateField, page)
      await viewDetail(selectedOrder.id)
      setRefundReason('')
    } catch (refundError) {
      setDetailError(refundError instanceof Error ? refundError.message : '手动退款失败')
    } finally {
      setRefundSubmitting(false)
    }
  }

  return (
    <section className="stack">
      <section className="panel search-panel">
        <div className="filter-grid filter-grid-four">
          <label className="filter-field">
            <span>订单号</span>
            <input placeholder="订单号" value={orderNo} onChange={event => setOrderNo(event.target.value)} />
          </label>
          <label className="filter-field">
            <span>用户昵称</span>
            <input placeholder="用户昵称" value={nickName} onChange={event => setNickName(event.target.value)} />
          </label>
          <label className="filter-field">
            <span>课程名称</span>
            <input placeholder="课程名称" value={courseTitle} onChange={event => setCourseTitle(event.target.value)} />
          </label>
          <label className="filter-field">
            <span>订单状态</span>
            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              <option value="0">待支付</option>
              <option value="1">已支付</option>
              <option value="2">已退款</option>
            </select>
          </label>
          <label className="filter-field">
            <span>退款类型</span>
            <select value={refundType} onChange={event => setRefundType(event.target.value)}>
              <option value="">全部退款类型</option>
              <option value="system">系统自动退款</option>
              <option value="manual">手动退款</option>
            </select>
          </label>
          <label className="filter-field">
            <span>时间维度</span>
            <select value={dateField} onChange={event => setDateField(event.target.value)}>
              <option value="create_time">按下单时间</option>
              <option value="pay_time">按支付时间</option>
              <option value="refund_time">按退款时间</option>
            </select>
          </label>
          <label className="filter-field">
            <span>开始日期</span>
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
          </label>
          <label className="filter-field">
            <span>结束日期</span>
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
          </label>
        </div>

        <div className="filter-actions filter-actions-end">
          <button className="secondary-button compact-action-button query-button" type="button" onClick={() => applySearch(orderNo, nickName, courseTitle, status, refundType, startDate, endDate, dateField, 1)}>
            查询
          </button>
        </div>
      </section>

      <section className="panel">
        {loading ? <p className="muted-text">加载中...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading && !error ? (
          <>
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
                      <div className="button-row">
                        <button className="ghost-button compact-button" onClick={() => void viewDetail(item.id)}>
                          详情
                        </button>
                        {item.status === 1 ? (
                          <button className="secondary-button compact-button" onClick={() => void viewDetail(item.id)}>
                            退款
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar
              total={pagination.total}
              page={pagination.page}
              totalPages={pagination.total_pages}
              onPrev={() => applySearch(orderNo, nickName, courseTitle, status, refundType, startDate, endDate, dateField, pagination.page - 1)}
              onNext={() => applySearch(orderNo, nickName, courseTitle, status, refundType, startDate, endDate, dateField, pagination.page + 1)}
            />
          </>
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
          <>
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

            {selectedOrder.status === 1 ? (
              <div className="detail-card">
                <strong>手动退款</strong>
                <p className="muted-text">
                  退款成功后，会自动回滚该用户的参团记录，并同步回滚拼团人数与拼团状态。
                </p>
                <label>
                  退款原因
                  <textarea
                    rows={3}
                    value={refundReason}
                    placeholder="请输入本次手动退款原因"
                    onChange={event => setRefundReason(event.target.value)}
                  />
                </label>
                <div className="button-row">
                  <button className="primary-button" onClick={() => void handleRefund()} disabled={refundSubmitting}>
                    {refundSubmitting ? '退款中...' : '确认退款'}
                  </button>
                  <span className="muted-text">仅已支付订单允许退款，退款后会写入操作日志。</span>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </section>
  )
}
