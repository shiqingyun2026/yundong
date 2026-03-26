const express = require('express')

const supabase = require('../../utils/supabase')
const { ok, fail, getPagination, formatDateTime } = require('./_helpers')
const { getCourseLifecycleMap, safeDate, syncAllCourseLifecycles } = require('../../utils/courseLifecycle')
const { writeAdminLog } = require('../../utils/adminStore')

const router = express.Router()
const AUTO_REFUND_REASON = '报名截止前未成团，系统自动退款'

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

const computeNextGroupStatus = group => {
  const targetCount = Number(group.target_count || 0)
  const currentCount = Number(group.current_count || 0)
  const expireAt = safeDate(group.expire_time)

  if (targetCount > 0 && currentCount >= targetCount) {
    return 'success'
  }

  if (expireAt && expireAt.getTime() <= Date.now()) {
    return 'failed'
  }

  return 'active'
}

router.get('/', async (req, res) => {
  const { page, size, from, to } = getPagination(req.query || {})
  const orderNo = `${req.query.order_no || ''}`.trim()
  const nickName = `${req.query.nick_name || ''}`.trim()
  const courseTitle = `${req.query.course_title || ''}`.trim()
  const status = `${req.query.status || ''}`.trim()
  const refundType = `${req.query.refund_type || ''}`.trim()
  const startDate = `${req.query.start_date || ''}`.trim()
  const endDate = `${req.query.end_date || ''}`.trim()
  const dateField = ['create_time', 'pay_time', 'refund_time'].includes(`${req.query.date_field || ''}`)
    ? `${req.query.date_field}`
    : 'create_time'

  const matchesDate = value => {
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

  try {
    await syncAllCourseLifecycles({
      operatorId: req.admin && req.admin.id
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
      .filter(item => matchesDate(item[dateField]))

    const pagedList = list.slice(from, to + 1)

    return ok(res, {
      total: list.length,
      list: pagedList,
      page,
      size,
      total_pages: Math.max(1, Math.ceil(list.length / size))
    })
  } catch (error) {
    return fail(res, 5000, error.message || '获取订单列表失败', 500)
  }
})

router.get('/:id', async (req, res) => {
  try {
    await syncAllCourseLifecycles({
      operatorId: req.admin && req.admin.id
    })

    const { data, error } = await supabase
      .from('orders')
      .select('id, order_no, user_id, course_id, group_id, amount, status, created_at, pay_time, refund_time, refund_reason')
      .eq('id', req.params.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return fail(res, 2002, '订单不存在', 404)
    }

    const [{ data: user }, { data: course }, { data: group }] = await Promise.all([
      supabase.from('users').select('id, nickname, avatar_url').eq('id', data.user_id).maybeSingle(),
      supabase
        .from('courses')
        .select('id, name, start_time, address')
        .eq('id', data.course_id)
        .maybeSingle(),
      supabase
        .from('groups')
        .select('id, current_count, target_count, status')
        .eq('id', data.group_id)
        .maybeSingle()
    ])

    return ok(res, {
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
    })
  } catch (error) {
    return fail(res, 5000, error.message || '获取订单详情失败', 500)
  }
})

router.post('/:id/refund', async (req, res) => {
  const reason = `${(req.body && req.body.reason) || ''}`.trim()

  if (!reason) {
    return fail(res, 2003, '退款原因不能为空')
  }

  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_no, user_id, course_id, group_id, amount, status, refund_reason')
      .eq('id', req.params.id)
      .maybeSingle()

    if (orderError) {
      throw orderError
    }

    if (!order) {
      return fail(res, 2002, '订单不存在', 404)
    }

    if (order.status !== 'success') {
      return fail(res, 2003, '只有已支付订单才允许手动退款')
    }

    let rollbackDetail = {
      membership_removed: false,
      previous_group_status: '',
      next_group_status: '',
      previous_group_count: 0,
      next_group_count: 0
    }

    if (order.group_id) {
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id, status, current_count, target_count, expire_time')
        .eq('id', order.group_id)
        .maybeSingle()

      if (groupError) {
        throw groupError
      }

      if (group) {
        rollbackDetail.previous_group_status = group.status || ''
        rollbackDetail.previous_group_count = Number(group.current_count || 0)

        const { data: membership, error: membershipError } = await supabase
          .from('group_members')
          .select('group_id, user_id')
          .eq('group_id', order.group_id)
          .eq('user_id', order.user_id)
          .maybeSingle()

        if (membershipError) {
          throw membershipError
        }

        let nextCount = Number(group.current_count || 0)

        if (membership) {
          const { error: deleteMembershipError } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', order.group_id)
            .eq('user_id', order.user_id)

          if (deleteMembershipError) {
            throw deleteMembershipError
          }

          nextCount = Math.max(0, nextCount - 1)
          rollbackDetail.membership_removed = true
        }

        const nextStatus = computeNextGroupStatus({
          ...group,
          current_count: nextCount
        })

        const { error: updateGroupError } = await supabase
          .from('groups')
          .update({
            current_count: nextCount,
            status: nextStatus
          })
          .eq('id', order.group_id)

        if (updateGroupError) {
          throw updateGroupError
        }

        rollbackDetail.next_group_count = nextCount
        rollbackDetail.next_group_status = nextStatus
      }
    }

    const refundTime = new Date().toISOString()
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'refunded',
        refund_time: refundTime,
        refund_reason: reason,
        refund_operator_id: req.admin.id,
        updated_at: refundTime
      })
      .eq('id', req.params.id)
      .select('id, order_no, course_id, group_id, amount, status, refund_time, refund_reason')
      .single()

    if (updateError) {
      throw updateError
    }

    await getCourseLifecycleMap([order.course_id], {
      operatorId: req.admin.id
    })

    await safeWriteAdminLog({
      adminId: req.admin.id,
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
        refund_reason: reason,
        rollback_detail: rollbackDetail
      },
      ip: req.ip || null
    })

    return ok(res, {
      id: updatedOrder.id,
      refund_time: formatDateTime(updatedOrder.refund_time),
      refund_reason: updatedOrder.refund_reason || ''
    })
  } catch (error) {
    return fail(res, 5000, error.message || '手动退款失败', 500)
  }
})

module.exports = router
