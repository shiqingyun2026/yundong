const express = require('express')

const supabase = require('../../utils/supabase')
const { ok, fail, getPagination, formatDateTime } = require('./_helpers')

const router = express.Router()
const AUTO_REFUND_REASON = '报名截止前未成团，系统自动退款'

const mapGroupStatus = status => {
  if (status === 'success') {
    return 'success'
  }

  if (status === 'failed') {
    return 'failed'
  }

  return 'active'
}

const mapRefundType = reason => {
  if (!reason) {
    return ''
  }

  return reason === AUTO_REFUND_REASON ? 'system' : 'manual'
}

const toMap = (list = [], key = 'id') =>
  list.reduce((result, item) => {
    result[item[key]] = item
    return result
  }, {})

router.get('/', async (req, res) => {
  const { page, size, from, to } = getPagination(req.query || {})
  const keyword = `${req.query.keyword || ''}`.trim()
  const status = `${req.query.status || ''}`.trim()
  const courseId = `${req.query.course_id || ''}`.trim()
  const startDate = `${req.query.start_date || ''}`.trim()
  const endDate = `${req.query.end_date || ''}`.trim()

  try {
    let query = supabase
      .from('groups')
      .select('id, course_id, creator_id, status, current_count, target_count, expire_time, created_at')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (courseId) {
      query = query.eq('course_id', courseId)
    }

    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00+08:00`)
    }

    if (endDate) {
      query = query.lte('expire_time', `${endDate}T23:59:59+08:00`)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    const courseIds = [...new Set((data || []).map(item => item.course_id).filter(Boolean))]
    const creatorIds = [...new Set((data || []).map(item => item.creator_id).filter(Boolean))]

    const [{ data: courses }, { data: creators }] = await Promise.all([
      courseIds.length
        ? supabase.from('courses').select('id, name').in('id', courseIds)
        : Promise.resolve({ data: [] }),
      creatorIds.length
        ? supabase.from('users').select('id, nickname').in('id', creatorIds)
        : Promise.resolve({ data: [] })
    ])

    const coursesById = toMap(courses || [])
    const creatorsById = toMap(creators || [])

    const filtered = (data || [])
      .map(item => ({
        id: item.id,
        course_id: item.course_id || '',
        course_title: (coursesById[item.course_id] && coursesById[item.course_id].name) || '',
        status: mapGroupStatus(item.status),
        current_count: Number(item.current_count || 0),
        target_count: Number(item.target_count || 0),
        creator_name: (creatorsById[item.creator_id] && creatorsById[item.creator_id].nickname) || '',
        expire_time: formatDateTime(item.expire_time),
        create_time: formatDateTime(item.created_at)
      }))
      .filter(item => !keyword || item.course_title.includes(keyword) || item.id.includes(keyword))

    return ok(res, {
      total: filtered.length,
      list: filtered.slice(from, to + 1),
      page,
      size
    })
  } catch (error) {
    return fail(res, 5000, error.message || '获取拼团列表失败', 500)
  }
})

router.get('/:id/orders', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_no, user_id, amount, status, created_at, pay_time, refund_time, refund_reason, group_id')
      .eq('group_id', req.params.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    const userIds = [...new Set((data || []).map(item => item.user_id).filter(Boolean))]
    const { data: users } = userIds.length
      ? await supabase.from('users').select('id, nickname').in('id', userIds)
      : { data: [] }

    const usersById = toMap(users || [])

    return ok(
      res,
      (data || []).map(item => ({
        id: item.id,
        order_no: item.order_no || item.id,
        user_nick_name: (usersById[item.user_id] && usersById[item.user_id].nickname) || '',
        amount: Number(item.amount || 0),
        status: item.status || 'pending',
        create_time: formatDateTime(item.created_at),
        pay_time: formatDateTime(item.pay_time),
        refund_time: formatDateTime(item.refund_time),
        refund_reason: item.refund_reason || '',
        refund_type: mapRefundType(item.refund_reason)
      }))
    )
  } catch (error) {
    return fail(res, 5000, error.message || '获取拼团关联订单失败', 500)
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { data: group, error } = await supabase
      .from('groups')
      .select('id, course_id, creator_id, status, current_count, target_count, expire_time, created_at')
      .eq('id', req.params.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!group) {
      return fail(res, 2003, '拼团不存在', 404)
    }

    const [{ data: course }, { data: creator }, { data: members }, { data: orders }] = await Promise.all([
      supabase
        .from('courses')
        .select('id, name, deadline, start_time, end_time')
        .eq('id', group.course_id)
        .maybeSingle(),
      group.creator_id
        ? supabase.from('users').select('id, nickname').eq('id', group.creator_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('group_members')
        .select('group_id, user_id, joined_at')
        .eq('group_id', group.id)
        .order('joined_at', { ascending: true }),
      supabase
        .from('orders')
        .select('id, order_no, user_id, amount, status, created_at, pay_time, refund_time, refund_reason, group_id')
        .eq('group_id', group.id)
        .order('created_at', { ascending: false })
    ])

    const memberUserIds = [...new Set((members || []).map(item => item.user_id).filter(Boolean))]
    const orderUserIds = [...new Set((orders || []).map(item => item.user_id).filter(Boolean))]
    const userIds = [...new Set([...memberUserIds, ...orderUserIds])]

    const { data: users } = userIds.length
      ? await supabase.from('users').select('id, nickname, avatar_url').in('id', userIds)
      : { data: [] }

    const usersById = toMap(users || [])
    const ordersByUserId = (orders || []).reduce((result, item) => {
      if (!result[item.user_id]) {
        result[item.user_id] = item
      }
      return result
    }, {})

    const memberList = (members || []).map(item => ({
      user_id: item.user_id,
      nick_name: (usersById[item.user_id] && usersById[item.user_id].nickname) || '',
      avatar_url: (usersById[item.user_id] && usersById[item.user_id].avatar_url) || '',
      joined_at: formatDateTime(item.joined_at),
      order_no: (ordersByUserId[item.user_id] && (ordersByUserId[item.user_id].order_no || ordersByUserId[item.user_id].id)) || '',
      order_status: (ordersByUserId[item.user_id] && ordersByUserId[item.user_id].status) || 'pending'
    }))

    const orderList = (orders || []).map(item => ({
      id: item.id,
      order_no: item.order_no || item.id,
      user_nick_name: (usersById[item.user_id] && usersById[item.user_id].nickname) || '',
      amount: Number(item.amount || 0),
      status: item.status || 'pending',
      create_time: formatDateTime(item.created_at),
      pay_time: formatDateTime(item.pay_time),
      refund_time: formatDateTime(item.refund_time),
      refund_reason: item.refund_reason || '',
      refund_type: mapRefundType(item.refund_reason)
    }))

    const anomalies = []
    if (group.status === 'failed' && orderList.some(item => item.status !== 'refunded')) {
      anomalies.push('失败团存在未退款订单')
    }
    if (Number(group.current_count || 0) !== memberList.length) {
      anomalies.push('团人数与成员数不一致')
    }

    return ok(res, {
      id: group.id,
      course_id: group.course_id || '',
      course_title: (course && course.name) || '',
      creator_name: (creator && creator.nickname) || '',
      status: mapGroupStatus(group.status),
      current_count: Number(group.current_count || 0),
      target_count: Number(group.target_count || 0),
      expire_time: formatDateTime(group.expire_time),
      create_time: formatDateTime(group.created_at),
      deadline: formatDateTime(course && course.deadline),
      start_time: formatDateTime(course && course.start_time),
      end_time: formatDateTime(course && course.end_time),
      rules: [
        '团截止时间等于课程报名截止时间',
        '课程成功定义为报名截止前至少一个团成功',
        '失败团自动退款后保留成员历史记录'
      ],
      members: memberList,
      orders: orderList,
      anomalies
    })
  } catch (error) {
    return fail(res, 5000, error.message || '获取拼团详情失败', 500)
  }
})

module.exports = router
