import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PaginationBar } from '../components/PaginationBar'
import { api } from '../lib/api'
import type { PackageOrderListItem, PackageOrderListResponse } from '../types'

const getStatusText = (status: string) => {
  if (status === 'success') return '已支付'
  if (status === 'refund_pending') return '退款中'
  if (status === 'refunded') return '已退款'
  if (status === 'refund_failed') return '退款失败'
  if (status === 'closed') return '已关闭'
  return '待支付'
}

const canSyncRefundStatus = (status: string) => ['refund_pending', 'refund_failed', 'refunded'].includes(status)

const getRefundTypeText = (refundType: PackageOrderListItem['refund_type']) => {
  if (refundType === 'system') return '系统自动退款'
  if (refundType === 'manual') return '手动退款'
  return '-'
}

const getActionText = (action: PackageOrderListItem['action']) => {
  if (action === 'start') return '开团'
  if (action === 'join') return '参团'
  return '-'
}

const getGroupStatusText = (status: PackageOrderListItem['package_group_status']) => {
  if (status === 'success') return '已成团'
  if (status === 'failed') return '已失败'
  if (status === 'active') return '进行中'
  return '-'
}

export function PackageOrderListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [packageId, setPackageId] = useState(searchParams.get('package_id') || '')
  const [packageGroupId, setPackageGroupId] = useState(searchParams.get('package_group_id') || '')
  const [items, setItems] = useState<PackageOrderListItem[]>([])
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1, page: 1, size: 10 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<PackageOrderListItem | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const [refundSyncingOrderId, setRefundSyncingOrderId] = useState('')
  const [detailError, setDetailError] = useState('')
  const [detailNotice, setDetailNotice] = useState('')

  const applySearch = (
    nextKeyword = keyword,
    nextStatus = status,
    nextPackageId = packageId,
    nextPackageGroupId = packageGroupId,
    nextPage = 1
  ) => {
    const params = new URLSearchParams()
    if (nextKeyword) params.set('keyword', nextKeyword)
    if (nextStatus) params.set('status', nextStatus)
    if (nextPackageId) params.set('package_id', nextPackageId)
    if (nextPackageGroupId) params.set('package_group_id', nextPackageGroupId)
    if (nextPage > 1) params.set('page', `${nextPage}`)
    setSearchParams(params)
  }

  const fetchOrders = async (
    nextKeyword = keyword,
    nextStatus = status,
    nextPackageId = packageId,
    nextPackageGroupId = packageGroupId,
    nextPage = 1
  ) => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (nextKeyword) params.set('keyword', nextKeyword)
      if (nextStatus) params.set('status', nextStatus)
      if (nextPackageId) params.set('package_id', nextPackageId)
      if (nextPackageGroupId) params.set('package_group_id', nextPackageGroupId)
      params.set('page', `${nextPage}`)
      params.set('size', '10')

      const data = await api.get<PackageOrderListResponse>(`/package-orders?${params.toString()}`)
      setItems(data.list || [])
      setPagination({
        total: data.total || 0,
        total_pages: data.total_pages || 1,
        page: data.page || nextPage,
        size: data.size || 10
      })
      if (selectedOrder) {
        const nextSelectedOrder = (data.list || []).find(item => item.id === selectedOrder.id) || null
        setSelectedOrder(nextSelectedOrder)
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取课包订单失败')
    } finally {
      setLoading(false)
    }
  }

  const refreshCurrentPage = () => fetchOrders(keyword, status, packageId, packageGroupId, pagination.page)

  useEffect(() => {
    const nextKeyword = searchParams.get('keyword') || ''
    const nextStatus = searchParams.get('status') || ''
    const nextPackageId = searchParams.get('package_id') || ''
    const nextPackageGroupId = searchParams.get('package_group_id') || ''
    const nextPage = Number(searchParams.get('page') || '1') || 1

    setKeyword(nextKeyword)
    setStatus(nextStatus)
    setPackageId(nextPackageId)
    setPackageGroupId(nextPackageGroupId)
    void fetchOrders(nextKeyword, nextStatus, nextPackageId, nextPackageGroupId, nextPage)
  }, [searchParams])

  const handleRefund = async () => {
    if (!selectedOrder) {
      return
    }

    const reason = refundReason.trim()
    if (!reason) {
      setDetailError('退款原因不能为空')
      setDetailNotice('')
      return
    }

    if (!window.confirm('确认对该课包订单执行手动退款吗？')) {
      return
    }

    setRefundSubmitting(true)
    setDetailError('')
    setDetailNotice('')

    try {
      await api.post(`/package-orders/${selectedOrder.id}/refund`, { reason })
      await refreshCurrentPage()
      setRefundReason('')
    } catch (refundError) {
      setDetailError(refundError instanceof Error ? refundError.message : '手动退款失败')
    } finally {
      setRefundSubmitting(false)
    }
  }

  const handleSyncRefund = async (order: PackageOrderListItem) => {
    setRefundSyncingOrderId(order.id)
    setDetailError('')
    setDetailNotice('')

    try {
      const result = await api.post<{
        status: string
        refund_query_status: string
        refund_query_final_status: string
      }>(`/package-orders/${order.id}/refund/sync`)
      setDetailNotice(
        `退款同步完成：${getStatusText(result.status)}（微信状态：${result.refund_query_status || result.refund_query_final_status || '-'}）`
      )
      await refreshCurrentPage()
    } catch (syncError) {
      setDetailError(syncError instanceof Error ? syncError.message : '同步退款状态失败')
    } finally {
      setRefundSyncingOrderId('')
    }
  }

  return (
    <section className="stack">
      <section className="panel search-panel">
        <div className="filter-grid">
          <label className="filter-field">
            <span>关键词</span>
            <input
              placeholder="订单号 / 用户昵称 / 孩子昵称 / 家长手机号 / 课包名 / 拼团编号"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>订单状态</span>
            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              <option value="pending">待支付</option>
              <option value="success">已支付</option>
              <option value="refund_pending">退款中</option>
              <option value="refunded">已退款</option>
              <option value="refund_failed">退款失败</option>
              <option value="closed">已关闭</option>
            </select>
          </label>
          <label className="filter-field">
            <span>课包编号</span>
            <input value={packageId} onChange={event => setPackageId(event.target.value)} placeholder="按课包编号过滤" />
          </label>
          <label className="filter-field">
            <span>拼团编号</span>
            <input
              value={packageGroupId}
              onChange={event => setPackageGroupId(event.target.value)}
              placeholder="按拼团编号过滤"
            />
          </label>
        </div>

        <div className="filter-actions filter-actions-end">
          <button
            className="secondary-button compact-action-button query-button"
            type="button"
            onClick={() => applySearch(keyword, status, packageId, packageGroupId, 1)}
          >
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
                  <th>用户</th>
                  <th>课包信息</th>
                  <th>拼团信息</th>
                  <th>金额</th>
                  <th>状态</th>
                  <th>退款信息</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div>
                        <strong>{item.order_no}</strong>
                        <p className="table-subtext">{item.create_time || '-'}</p>
                      </div>
                    </td>
                    <td>
                      <div className="table-title-cell">
                        {item.avatar_url ? <img className="table-avatar" src={item.avatar_url} alt={item.nickname} /> : null}
                        <div>
                          <strong>{item.nickname || '-'}</strong>
                          <p className="table-subtext">孩子：{item.child_nickname || '未补录'}</p>
                          <p className="table-subtext">{item.phone || '未补录手机号'}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{item.package_name || '-'}</strong>
                        <p className="table-subtext">课包编号：{item.package_id || '-'}</p>
                        <p className="table-subtext">动作: {getActionText(item.action)}</p>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span>{item.package_group_id || '-'}</span>
                        <p className="table-subtext">{getGroupStatusText(item.package_group_status)}</p>
                      </div>
                    </td>
                    <td>{item.amount_text || `¥${(item.amount_fen / 100).toFixed(2)}`}</td>
                    <td>
                      <div>
                        <span>{getStatusText(item.status)}</span>
                        <p className="table-subtext">支付时间：{item.pay_time || '-'}</p>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span>{getRefundTypeText(item.refund_type)}</span>
                        <p className="table-subtext">{item.refund_reason || '无'}</p>
                      </div>
                    </td>
                    <td>
                      <div className="button-row">
                        <button
                          className="ghost-button compact-button"
                          type="button"
                          onClick={() => {
                            setSelectedOrder(item)
                            setDetailError('')
                            setRefundReason(item.refund_reason || '')
                          }}
                        >
                          详情
                        </button>
                        {item.status === 'success' ? (
                          <button
                            className="secondary-button compact-button"
                            type="button"
                            onClick={() => {
                              setSelectedOrder(item)
                              setDetailError('')
                              setRefundReason('')
                            }}
                          >
                            退款
                          </button>
                        ) : null}
                        {canSyncRefundStatus(item.status) ? (
                          <button
                            className="secondary-button compact-button"
                            type="button"
                            disabled={refundSyncingOrderId === item.id}
                            onClick={() => {
                              setSelectedOrder(item)
                              setRefundReason(item.refund_reason || '')
                              void handleSyncRefund(item)
                            }}
                          >
                            {refundSyncingOrderId === item.id ? '同步中...' : '同步退款'}
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
              onPrev={() => applySearch(keyword, status, packageId, packageGroupId, pagination.page - 1)}
              onNext={() => applySearch(keyword, status, packageId, packageGroupId, pagination.page + 1)}
            />
          </>
        ) : null}
      </section>

      <section className="panel subtle-panel stack">
        <div>
          <p className="section-kicker">Order Detail</p>
          <h3>订单详情</h3>
        </div>

        {detailError ? <p className="error-text">{detailError}</p> : null}
        {detailNotice ? <p className="muted-text">{detailNotice}</p> : null}
        {!selectedOrder ? <p className="muted-text">点击订单列表中的“详情”查看订单与退款信息。</p> : null}

        {selectedOrder ? (
          <>
            <div className="detail-grid">
              <div className="detail-card">
                <strong>订单信息</strong>
                <p>订单号：{selectedOrder.order_no}</p>
                <p>订单状态：{getStatusText(selectedOrder.status)}</p>
                <p>下单时间：{selectedOrder.create_time || '-'}</p>
                <p>支付时间：{selectedOrder.pay_time || '-'}</p>
                <p>退款时间：{selectedOrder.refund_time || '-'}</p>
                <p>退款类型：{getRefundTypeText(selectedOrder.refund_type)}</p>
              </div>
              <div className="detail-card">
                <strong>用户与课包</strong>
                <p>用户昵称：{selectedOrder.nickname || '-'}</p>
                <p>用户 ID：{selectedOrder.user_id || '-'}</p>
                <p>孩子昵称：{selectedOrder.child_nickname || '-'}</p>
                <p>孩子年龄：{selectedOrder.child_age ?? '-'}</p>
                <p>家长手机号：{selectedOrder.phone || '未补录'}</p>
                <p>课包名称：{selectedOrder.package_name || '-'}</p>
                <p>课包编号：{selectedOrder.package_id || '-'}</p>
                <p>动作：{getActionText(selectedOrder.action)}</p>
                <p>支付金额：{selectedOrder.amount_text || '-'}</p>
              </div>
              <div className="detail-card">
                <strong>拼团信息</strong>
                <p>拼团编号：{selectedOrder.package_group_id || '-'}</p>
                <p>拼团状态：{getGroupStatusText(selectedOrder.package_group_status)}</p>
                <p>退款原因：{selectedOrder.refund_reason || '-'}</p>
                <p>更新时间：{selectedOrder.update_time || '-'}</p>
              </div>
            </div>

            <div className="button-row">
              <Link className="secondary-button" to={`/packages/${selectedOrder.package_id}`}>
                查看课包
              </Link>
              <Link className="secondary-button" to={`/package-groups?package_id=${selectedOrder.package_id}`}>
                查看该课包拼团
              </Link>
              {selectedOrder.package_group_id ? (
                <Link className="secondary-button" to={`/package-groups/${selectedOrder.package_group_id}`}>
                  查看拼团详情
                </Link>
              ) : null}
              {canSyncRefundStatus(selectedOrder.status) ? (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={refundSyncingOrderId === selectedOrder.id}
                  onClick={() => void handleSyncRefund(selectedOrder)}
                >
                  {refundSyncingOrderId === selectedOrder.id ? '同步中...' : '同步退款状态'}
                </button>
              ) : null}
            </div>

            {selectedOrder.status === 'success' ? (
              <div className="stack">
                <label>
                  <span>退款原因</span>
                  <textarea rows={3} value={refundReason} onChange={event => setRefundReason(event.target.value)} />
                </label>
                <div className="button-row">
                  <button className="primary-button" type="button" disabled={refundSubmitting} onClick={() => void handleRefund()}>
                    {refundSubmitting ? '退款中...' : '执行手动退款'}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </section>
  )
}
