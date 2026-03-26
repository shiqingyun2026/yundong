const express = require('express')

const supabase = require('../../utils/supabase')
const { ok, fail, getPagination, formatDateTime } = require('./_helpers')
const { syncAllCourseLifecycles } = require('../../utils/courseLifecycle')

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

router.get('/', async (req, res) => {
  const { page, size, from, to } = getPagination(req.query || {})
  const orderNo = `${req.query.order_no || ''}`.trim()
  const nickName = `${req.query.nick_name || ''}`.trim()
  const courseTitle = `${req.query.course_title || ''}`.trim()
  const status = `${req.query.status || ''}`.trim()

  try {
    await syncAllCourseLifecycles({
      operatorId: req.admin && req.admin.id
    })

    const { data, count, error } = await supabase
      .from('orders')
      .select('id, order_no, user_id, course_id, group_id, amount, status, created_at, pay_time, refund_time, refund_reason', {
        count: 'exact'
      })
      .order('created_at', { ascending: false })
      .range(from, to)

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

    return ok(res, {
      total: count || list.length,
      list
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
  return fail(res, 3001, '当前数据库尚未补齐退款字段与回滚规则，暂不支持后台退款', 501)
})

module.exports = router
