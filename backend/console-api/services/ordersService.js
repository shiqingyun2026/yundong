const { formatDateTime, getPagination } = require('../routes/_helpers')
const { createConsoleApiError } = require('./_errors')
const { ensureCondition, ensureFound } = require('./_guards')
const supabase = require('../../utils/supabase')
const { getCourseLifecycleMap, syncAllCourseLifecycles } = require('../../utils/courseLifecycle')
const { writeAdminLog } = require('../../utils/adminStore')
const { AUTO_REFUND_REASON } = require('../../shared/constants/refunds')
const { rollbackGroupParticipationForOrder } = require('../../shared/services/groupOrders')

const mapStatus = status => {
  if (status === 'success') {
    return 1
  }

  if (status === 'refunded') {
    return 2
  }

  return 0
}

const mapRefundType = reason => {
  if (!reason) {
    return ''
  }

  return reason === AUTO_REFUND_REASON ? 'system' : 'manual'
}

const safeWriteAdminLog = async payload => {
  try {
    await writeAdminLog(payload)
  } catch (error) {
    console.error('[admin/orders] write admin log failed', error)
  }
}

const matchesDateRange = ({ value, startDate = '', endDate = '' }) => {
  if (!startDate && !endDate) {
    return true
  }

  if (!value) {
    return false
  }

  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) {
    return false
  }

  if (startDate && timestamp < new Date(`${startDate}T00:00:00+08:00`).getTime()) {
    return false
  }

  if (endDate && timestamp > new Date(`${endDate}T23:59:59+08:00`).getTime()) {
    return false
  }

  return true
}

const listOrders = async ({ query = {}, admin = {} }) => {
  const { page, size, from, to } = getPagination(query)
  const orderNo = `${query.order_no || ''}`.trim()
  const nickName = `${query.nick_name || ''}`.trim()
  const courseTitle = `${query.course_title || ''}`.trim()
  const status = `${query.status || ''}`.trim()
  const refundType = `${query.refund_type || ''}`.trim()
  const startDate = `${query.start_date || ''}`.trim()
  const endDate = `${query.end_date || ''}`.trim()
  const dateField = ['create_time', 'pay_time', 'refund_time'].includes(`${query.date_field || ''}`)
    ? `${query.date_field}`
    : 'create_time'

  await syncAllCourseLifecycles({
    operatorId: admin && admin.id
  })

  const { data, error } = await supabase
    .from('orders')
    .select('id, order_no, user_id, course_id, group_id, amount, status, created_at, pay_time, refund_time, refund_reason')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const userIds = [...new Set((data || []).map(item => item.user_id).filter(Boolean))]
  const courseIds = [...new Set((data || []).map(item => item.course_id).filter(Boolean))]

  const [{ data: users }, { data: courses }] = await Promise.all([
    userIds.length
      ? supabase.from('users').select('id, nickname').in('id', userIds)
      : Promise.resolve({ data: [] }),
    courseIds.length
      ? supabase.from('courses').select('id, name').in('id', courseIds)
      : Promise.resolve({ data: [] })
  ])

  const usersById = (users || []).reduce((result, item) => {
    result[item.id] = item
    return result
  }, {})

  const coursesById = (courses || []).reduce((result, item) => {
    result[item.id] = item
    return result
  }, {})

  const list = (data || [])
    .map(item => {
      const user = usersById[item.user_id] || {}
      const course = coursesById[item.course_id] || {}

      return {
        id: item.id,
        order_no: item.order_no || item.id,
        user_nick_name: user.nickname || '',
        user_phone: '',
        course_title: course.name || '',
        amount: Number(item.amount || 0),
        status: mapStatus(item.status),
        create_time: formatDateTime(item.created_at),
        pay_time: formatDateTime(item.pay_time || (item.status === 'success' ? item.created_at : '')),
        refund_time: formatDateTime(item.refund_time),
        refund_reason: item.refund_reason || '',
        refund_type: mapRefundType(item.refund_reason)
      }
    })
    .filter(item => !orderNo || item.order_no.includes(orderNo))
    .filter(item => !nickName || item.user_nick_name.includes(nickName))
    .filter(item => !courseTitle || item.course_title.includes(courseTitle))
    .filter(item => !status || `${item.status}` === status)
    .filter(item => !refundType || item.refund_type === refundType)
    .filter(item => matchesDateRange({ value: item[dateField], startDate, endDate }))

  return {
    total: list.length,
    list: list.slice(from, to + 1),
    page,
    size,
    total_pages: Math.max(1, Math.ceil(list.length / size))
  }
}

const getOrderDetail = async ({ orderId, admin = {} }) => {
  await syncAllCourseLifecycles({
    operatorId: admin && admin.id
  })

  const { data, error } = await supabase
    .from('orders')
    .select('id, order_no, user_id, course_id, group_id, amount, status, created_at, pay_time, refund_time, refund_reason')
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    throw error
  }

  ensureFound(data, {
    responseCode: 2002,
    message: '订单不存在'
  })

  const [{ data: user }, { data: course }, { data: group }] = await Promise.all([
    supabase.from('users').select('id, nickname, avatar_url').eq('id', data.user_id).maybeSingle(),
    supabase.from('courses').select('id, name, start_time, address').eq('id', data.course_id).maybeSingle(),
    supabase.from('groups').select('id, current_count, target_count, status').eq('id', data.group_id).maybeSingle()
  ])

  return {
    id: data.id,
    order_no: data.order_no || data.id,
    user: {
      id: user && user.id,
      nick_name: (user && user.nickname) || '',
      phone: '',
      avatar_url: (user && user.avatar_url) || ''
    },
    course: {
      id: course && course.id,
      title: (course && course.name) || '',
      start_time: (course && course.start_time) || '',
      end_time: '',
      location_community: '',
      location_detail: (course && course.address) || ''
    },
    group: {
      id: group && group.id,
      current_count: Number(group && group.current_count) || 0,
      target_count: Number(group && group.target_count) || 0,
      status: mapStatus(group && group.status)
    },
    amount: Number(data.amount || 0),
    status: mapStatus(data.status),
    pay_time: formatDateTime(data.pay_time || (data.status === 'success' ? data.created_at : '')),
    refund_time: formatDateTime(data.refund_time),
    refund_reason: data.refund_reason || '',
    refund_type: mapRefundType(data.refund_reason),
    create_time: formatDateTime(data.created_at)
  }
}

const refundOrder = async ({ orderId, reason, admin = {}, ip = null }) => {
  const normalizedReason = `${reason || ''}`.trim()

  ensureCondition(!!normalizedReason, {
    responseCode: 2003,
    statusCode: 400,
    message: '退款原因不能为空'
  })

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_no, user_id, course_id, group_id, amount, status, refund_reason')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) {
    throw orderError
  }

  ensureFound(order, {
    responseCode: 2002,
    message: '订单不存在'
  })
  ensureCondition(order.status === 'success', {
    responseCode: 2003,
    statusCode: 400,
    message: '只有已支付订单才允许手动退款'
  })

  let rollbackDetail = {
    membership_removed: false,
    previous_group_status: '',
    next_group_status: '',
    previous_group_count: 0,
    next_group_count: 0
  }

  rollbackDetail = await rollbackGroupParticipationForOrder({
    supabase,
    order
  })

  const refundTime = new Date().toISOString()
  const { data: updatedOrder, error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'refunded',
      refund_time: refundTime,
      refund_reason: normalizedReason,
      refund_operator_id: admin.id,
      updated_at: refundTime
    })
    .eq('id', orderId)
    .select('id, order_no, course_id, group_id, amount, status, refund_time, refund_reason')
    .single()

  if (updateError) {
    throw updateError
  }

  await getCourseLifecycleMap([order.course_id], {
    operatorId: admin.id
  })

  await safeWriteAdminLog({
    adminId: admin.id,
    action: 'order_refund',
    targetType: 'order',
    targetId: updatedOrder.id,
    detail: {
      order_no: updatedOrder.order_no || updatedOrder.id,
      course_id: updatedOrder.course_id || '',
      group_id: updatedOrder.group_id || '',
      amount: Number(updatedOrder.amount || 0),
      previous_status: order.status,
      next_status: updatedOrder.status,
      refund_reason: normalizedReason,
      rollback_detail: rollbackDetail
    },
    ip
  })

  return {
    id: updatedOrder.id,
    refund_time: formatDateTime(updatedOrder.refund_time),
    refund_reason: updatedOrder.refund_reason || ''
  }
}

module.exports = {
  getOrderDetail,
  listOrders,
  refundOrder
}
