import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PageBackButton } from '../components/PageBackButton'
import { PaginationBar } from '../components/PaginationBar'
import { api } from '../lib/api'
import type { PackageGroupLessonItem, PackageGroupListItem, PackageGroupListResponse } from '../types'

const getStatusText = (status: PackageGroupListItem['status']) => {
  if (status === 'success') return '已成团'
  if (status === 'failed') return '已失败'
  if (status === 'refund_pending') return '退款中'
  if (status === 'refund_failed') return '退款失败'
  if (status === 'canceled') return '已取消'
  return '进行中'
}

const formatRemainingTime = (seconds: number) => {
  if (seconds <= 0) {
    return '已截止'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours} 小时 ${minutes} 分钟`
}

const getCoachNameText = (value: string) => value.trim() || '教练待定'

const formatScheduleList = (scheduleList: PackageGroupLessonItem[]) =>
  scheduleList.map(item => `第${item.index}节 ${item.display_text || item.class_time} ${getCoachNameText(item.coach_name)}`)

export function PackageGroupListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const packageIdFromQuery = searchParams.get('package_id') || ''
  const [packageId, setPackageId] = useState(packageIdFromQuery)
  const [status, setStatus] = useState('')
  const [items, setItems] = useState<PackageGroupListItem[]>([])
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1, page: 1, size: 10 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editingGroupId, setEditingGroupId] = useState('')
  const [savingGroupId, setSavingGroupId] = useState('')
  const [refundingGroupId, setRefundingGroupId] = useState('')
  const [refundTarget, setRefundTarget] = useState<PackageGroupListItem | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [coachForm, setCoachForm] = useState<{
    defaultCoachName: string
    lessons: Array<{ index: number; class_time: string; coach_name: string }>
  }>({
    defaultCoachName: '',
    lessons: []
  })

  const applySearch = (nextPackageId = packageId, nextStatus = status, nextPage = 1) => {
    const params = new URLSearchParams()
    if (nextPackageId) params.set('package_id', nextPackageId)
    if (nextStatus) params.set('status', nextStatus)
    if (nextPage > 1) params.set('page', `${nextPage}`)
    setSearchParams(params)
  }

  const fetchList = async (nextPackageId = packageId, nextStatus = status, nextPage = 1) => {
    setLoading(true)
    setError('')
    setNotice('')

    try {
      const params = new URLSearchParams()
      if (nextPackageId) params.set('package_id', nextPackageId)
      if (nextStatus) params.set('status', nextStatus)
      params.set('page', `${nextPage}`)
      params.set('size', '10')

      const data = await api.get<PackageGroupListResponse>(`/package-groups?${params.toString()}`)
      setItems(data.list || [])
      setPagination({
        total: data.total || 0,
        total_pages: data.total_pages || 1,
        page: data.page || nextPage,
        size: data.size || 10
      })
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取课包拼团列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const nextPackageId = searchParams.get('package_id') || ''
    const nextStatus = searchParams.get('status') || ''
    const nextPage = Number(searchParams.get('page') || '1') || 1

    setPackageId(nextPackageId)
    setStatus(nextStatus)
    void fetchList(nextPackageId, nextStatus, nextPage)
  }, [searchParams])

  const editingItem = useMemo(() => items.find(item => item.id === editingGroupId) || null, [editingGroupId, items])

  const startEditCoach = (item: PackageGroupListItem) => {
    setEditingGroupId(item.id)
    setCoachForm({
      defaultCoachName: item.coach_assignment?.default_coach_name || '',
      lessons: (item.schedule_list || []).map(lesson => ({
        index: lesson.index,
        class_time: lesson.class_time,
        coach_name: lesson.coach_name || ''
      }))
    })
  }

  const cancelEditCoach = () => {
    setEditingGroupId('')
    setSavingGroupId('')
    setCoachForm({
      defaultCoachName: '',
      lessons: []
    })
  }

  const closeRefundDialog = () => {
    setRefundTarget(null)
    setRefundReason('')
    setRefundingGroupId('')
  }

  const updateLessonCoach = (index: number, coachName: string) => {
    setCoachForm(current => ({
      ...current,
      lessons: current.lessons.map(item => (item.index === index ? { ...item, coach_name: coachName } : item))
    }))
  }

  const applyDefaultCoachToAll = () => {
    setCoachForm(current => ({
      ...current,
      lessons: current.lessons.map(item => ({
        ...item,
        coach_name: current.defaultCoachName
      }))
    }))
  }

  const handleSaveCoach = async () => {
    if (!editingItem) {
      return
    }

    setSavingGroupId(editingItem.id)
    setError('')

    try {
      const updated = await api.put<PackageGroupListItem | { id: string; schedule_list: PackageGroupLessonItem[]; coach_assignment: PackageGroupListItem['coach_assignment'] }>(
        `/package-groups/${editingItem.id}/coach-assignment`,
        {
          default_coach_name: coachForm.defaultCoachName,
          lessons: coachForm.lessons.map(item => ({
            index: item.index,
            coach_name: item.coach_name
          }))
        }
      )

      setItems(current =>
        current.map(item =>
          item.id === editingItem.id
            ? {
                ...item,
                schedule_list: (updated as PackageGroupListItem).schedule_list || item.schedule_list,
                coach_assignment: (updated as PackageGroupListItem).coach_assignment || item.coach_assignment
              }
            : item
        )
      )
      cancelEditCoach()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '更新教练安排失败')
      setSavingGroupId('')
    }
  }

  const handleRefundGroup = async () => {
    if (!refundTarget) {
      return
    }

    const reason = refundReason.trim()
    if (!reason) {
      setError('退款原因不能为空')
      setNotice('')
      return
    }

    if (!window.confirm(`确认对拼团「${refundTarget.id}」执行整团退款吗？`)) {
      return
    }

    setRefundingGroupId(refundTarget.id)
    setError('')
    setNotice('')

    try {
      await api.post(`/package-groups/${refundTarget.id}/refund`, { reason })
      await fetchList(packageId, status, pagination.page)
      setNotice(`拼团 ${refundTarget.id} 已发起整团退款，团内订单已进入退款流程。`)
      closeRefundDialog()
    } catch (refundError) {
      setError(refundError instanceof Error ? refundError.message : '整团退款失败')
      setRefundingGroupId('')
    }
  }

  return (
    <section className="stack">
      {packageIdFromQuery ? <PageBackButton fallback="/packages" /> : null}

      <section className="panel search-panel">
        <div className="filter-grid">
          <label className="filter-field">
            <span>课包编号</span>
            <input placeholder="按课包编号过滤" value={packageId} onChange={event => setPackageId(event.target.value)} />
          </label>
          <label className="filter-field">
            <span>拼团状态</span>
            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              <option value="active">进行中</option>
              <option value="success">已成团</option>
              <option value="failed">已失败</option>
              <option value="refund_pending">退款中</option>
              <option value="refund_failed">退款失败</option>
              <option value="canceled">已取消</option>
            </select>
          </label>
        </div>

        <div className="filter-actions">
          <button
            className="secondary-button compact-action-button query-button"
            type="button"
            onClick={() => applySearch(packageId, status, 1)}
          >
            查询
          </button>
        </div>
      </section>

      <section className="panel">
        {loading ? <p className="muted-text">加载中...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {notice ? <p className="muted-text">{notice}</p> : null}

        {!loading && !error ? (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>拼团编号</th>
                  <th>所属课包</th>
                  <th>状态</th>
                  <th>拼团进度</th>
                  <th>单人金额</th>
                  <th>排课信息</th>
                  <th>截止时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <Fragment key={item.id}>
                    <tr>
                      <td>{item.id}</td>
                      <td>
                        <div>
                          <strong>{item.package_name || '-'}</strong>
                          <p className="table-subtext">课包编号：{item.package_id || '-'}</p>
                        </div>
                      </td>
                      <td>{getStatusText(item.status)}</td>
                      <td>
                        {item.current_count}/{item.target_count}
                        <p className="table-subtext">最低成团：{item.min_success_count || item.target_count}人</p>
                        <p className="table-subtext">创建人：{item.creator_id || '-'}</p>
                      </td>
                      <td>{item.member_amount_text || '-'}</td>
                      <td>
                        <div>
                          <span>{item.schedule_text || '-'}</span>
                          {item.schedule_list.length ? (
                            <p className="table-subtext">{formatScheduleList(item.schedule_list).join(' / ')}</p>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div>
                          <span>{item.deadline || '-'}</span>
                          <p className="table-subtext">剩余：{formatRemainingTime(item.remaining_seconds)}</p>
                        </div>
                      </td>
                      <td>
                        <div className="button-row">
                          <Link className="table-link" to={`/package-groups/${item.id}`}>
                            查看详情
                          </Link>
                          <Link className="table-link" to={`/packages/${item.package_id}`}>
                            查看课包
                          </Link>
                          <Link className="table-link" to={`/package-orders?package_group_id=${item.id}`}>
                            查看订单
                          </Link>
                          {item.status === 'success' ? (
                            <button className="table-link button-as-link" type="button" onClick={() => startEditCoach(item)}>
                              {item.coach_assignment?.lessons?.some(lesson => lesson.coach_name.trim()) ? '编辑教练' : '安排教练'}
                            </button>
                          ) : null}
                          {item.status === 'success' ? (
                            <button
                              className="table-link button-as-link"
                              type="button"
                              onClick={() => {
                                setRefundTarget(item)
                                setRefundReason('')
                                setError('')
                                setNotice('')
                              }}
                            >
                              整团退款
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {editingGroupId === item.id ? (
                      <tr>
                        <td colSpan={8}>
                          <div className="inline-editor-panel stack">
                            <div className="filter-grid">
                              <label className="filter-field">
                                <span>默认教练</span>
                                <input
                                  placeholder="输入默认教练名称"
                                  value={coachForm.defaultCoachName}
                                  onChange={event => setCoachForm(current => ({ ...current, defaultCoachName: event.target.value }))}
                                />
                              </label>
                            </div>
                            <div className="filter-actions">
                              <button className="secondary-button compact-button" type="button" onClick={applyDefaultCoachToAll}>
                                应用到全部课次
                              </button>
                            </div>
                            <div className="lesson-coach-grid">
                              {coachForm.lessons.map(lesson => (
                                <div key={lesson.index} className="lesson-coach-card">
                                  <strong>第{lesson.index}节</strong>
                                  <p className="table-subtext">{lesson.class_time || '-'}</p>
                                  <input
                                    placeholder="输入教练名称"
                                    value={lesson.coach_name}
                                    onChange={event => updateLessonCoach(lesson.index, event.target.value)}
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="filter-actions">
                              <button className="primary-button compact-button" type="button" disabled={savingGroupId === item.id} onClick={() => void handleSaveCoach()}>
                                {savingGroupId === item.id ? '保存中...' : '保存'}
                              </button>
                              <button className="ghost-button compact-button" type="button" onClick={cancelEditCoach}>
                                取消
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <PaginationBar
              total={pagination.total}
              page={pagination.page}
              totalPages={pagination.total_pages}
              onPrev={() => applySearch(packageId, status, pagination.page - 1)}
              onNext={() => applySearch(packageId, status, pagination.page + 1)}
            />
          </>
        ) : null}
      </section>

      {refundTarget ? (
        <div className="modal-backdrop" role="presentation" onClick={event => (event.target === event.currentTarget ? closeRefundDialog() : undefined)}>
          <section className="modal-panel stack" role="dialog" aria-modal="true" aria-labelledby="package-group-refund-title">
            <div>
              <p className="section-kicker">Refund Confirmation</p>
              <h3 id="package-group-refund-title">确认整团退款</h3>
            </div>
            <p className="muted-text">
              拼团编号：{refundTarget.id}，课包：{refundTarget.package_name || refundTarget.package_id || '-'}
            </p>
            <label className="filter-field">
              <span>退款原因</span>
              <textarea rows={4} value={refundReason} onChange={event => setRefundReason(event.target.value)} />
            </label>
            <div className="button-row">
              <button
                className="primary-button compact-button"
                type="button"
                disabled={refundingGroupId === refundTarget.id}
                onClick={() => void handleRefundGroup()}
              >
                {refundingGroupId === refundTarget.id ? '退款中...' : '确认退款'}
              </button>
              <button className="ghost-button compact-button" type="button" onClick={closeRefundDialog} disabled={refundingGroupId === refundTarget.id}>
                取消
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
