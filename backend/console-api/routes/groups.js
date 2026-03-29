const express = require('../../lib/mini-express')

const supabase = require('../../utils/supabase')
const { ok, fail, getPagination, formatDateTime } = require('./_helpers')
const { COURSE_STATUS, getSingleCourseLifecycle } = require('../../utils/courseLifecycle')
const { AUTO_REFUND_REASON } = require('../../shared/constants/refunds')

const router = express.Router()
const COURSE_STATUS_TEXT = {
  [COURSE_STATUS.PENDING_PUBLISH]: '待上架',
  [COURSE_STATUS.GROUPING]: '拼团中',
  [COURSE_STATUS.GROUP_FAILED]: '拼团失败',
  [COURSE_STATUS.WAITING_CLASS]: '等待上课',
  [COURSE_STATUS.IN_CLASS]: '上课中',
  [COURSE_STATUS.FINISHED]: '已结课',
  [COURSE_STATUS.UNPUBLISHED]: '已下架'
}

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

const applyGroupFilters = (query, { status = '', courseId = '', startDate = '', endDate = '', dateField = 'created_at' }) => {
  if (status) {
    query = query.eq('status', status)
  }

  if (courseId) {
    query = query.eq('course_id', courseId)
  }

  if (dateField !== 'success_time' && dateField !== 'joined_at') {
    if (startDate) {
      query = query.gte(dateField, `${startDate}T00:00:00+08:00`)
    }

    if (endDate) {
      query = query.lte(dateField, `${endDate}T23:59:59+08:00`)
    }
  }

  return query
}

const buildDateRange = (startDate = '', endDate = '') => ({
  start: startDate ? `${startDate}T00:00:00+08:00` : '',
  end: endDate ? `${endDate}T23:59:59+08:00` : ''
})

const buildSuccessTimeMap = async (groupIds = [], { startDate = '', endDate = '' } = {}) => {
  if (!groupIds.length) {
    return {}
  }

  let query = supabase
    .from('orders')
    .select('group_id, pay_time, created_at, status')
    .in('group_id', groupIds)
    .eq('status', 'success')

  const range = buildDateRange(startDate, endDate)
  if (range.start) {
    query = query.gte('pay_time', range.start)
  }
  if (range.end) {
    query = query.lte('pay_time', range.end)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data || []).reduce((result, item) => {
    const candidate = item.pay_time || item.created_at || ''
    if (!item.group_id) {
      return result
    }

    if (!result[item.group_id] || candidate > result[item.group_id]) {
      result[item.group_id] = candidate
    }
    return result
  }, {})
}

const buildJoinedGroupIdSet = async ({ startDate = '', endDate = '' } = {}) => {
  let query = supabase.from('group_members').select('group_id')

  const range = buildDateRange(startDate, endDate)
  if (range.start) {
    query = query.gte('joined_at', range.start)
  }
  if (range.end) {
    query = query.lte('joined_at', range.end)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return new Set((data || []).map(item => item.group_id).filter(Boolean))
}

const buildKeywordOrClause = (keyword, courseIds = []) => {
  const clauses = []

  if (keyword) {
    clauses.push(`id.ilike.%${keyword}%`)
  }

  if (courseIds.length) {
    clauses.push(`course_id.in.(${courseIds.join(',')})`)
  }

  return clauses.join(',')
}

const getListSummary = async (filters, matchedCourseIds = []) => {
  const statuses = ['active', 'success', 'failed']
  const results = await Promise.all(
    statuses.map(async status => {
      const keyword = filters.keyword || ''
      let countQuery = supabase.from('groups').select('id', { count: 'exact', head: true })
      countQuery = applyGroupFilters(countQuery, { ...filters, status })

      if (keyword) {
        const keywordOrClause = buildKeywordOrClause(keyword, matchedCourseIds)

        if (keywordOrClause) {
          countQuery = countQuery.or(keywordOrClause)
        }
      }

      if (filters.dateField === 'success_time') {
        const { data: groups, error: groupsError } = await supabase
          .from('groups')
          .select('id')
          .eq('status', status)

        if (groupsError) {
          throw groupsError
        }

        const successTimeMap = await buildSuccessTimeMap(
          (groups || []).map(item => item.id).filter(Boolean),
          filters
        )

        return [status, Object.keys(successTimeMap).length]
      }

      if (filters.dateField === 'joined_at') {
        let joinedGroupIds = await buildJoinedGroupIdSet(filters)

        if (status) {
          const { data: groups, error: groupsError } = await supabase
            .from('groups')
            .select('id')
            .eq('status', status)

          if (groupsError) {
            throw groupsError
          }

          const allowedGroupIds = new Set((groups || []).map(item => item.id).filter(Boolean))
          joinedGroupIds = new Set([...joinedGroupIds].filter(groupId => allowedGroupIds.has(groupId)))
        }

        return [status, joinedGroupIds.size]
      }

      const { count, error } = await countQuery

      if (error) {
        throw error
      }

      return [status, Number(count || 0)]
    })
  )

  const summary = results.reduce(
    (result, [status, count]) => {
      result.total += count
      result[status] = count
      return result
    },
    { total: 0, active: 0, success: 0, failed: 0 }
  )

  return summary
}

router.get('/', async (req, res) => {
  const { page, size, from, to } = getPagination(req.query || {})
  const keyword = `${req.query.keyword || ''}`.trim()
  const status = `${req.query.status || ''}`.trim()
  const courseId = `${req.query.course_id || ''}`.trim()
  const startDate = `${req.query.start_date || ''}`.trim()
  const endDate = `${req.query.end_date || ''}`.trim()
  const dateField = ['created_at', 'expire_time', 'success_time', 'joined_at'].includes(`${req.query.date_field || ''}`)
    ? `${req.query.date_field}`
    : 'created_at'

  try {
    let matchedCourseIds = []
    if (keyword) {
      const { data: matchedCourses, error: courseKeywordError } = await supabase
        .from('courses')
        .select('id')
        .ilike('name', `%${keyword}%`)

      if (courseKeywordError) {
        throw courseKeywordError
      }

      matchedCourseIds = (matchedCourses || []).map(item => item.id).filter(Boolean)
    }

    let listQuery = supabase
      .from('groups')
      .select('id, course_id, creator_id, status, current_count, target_count, expire_time, created_at', {
        count: 'exact'
      })
      .order('created_at', { ascending: false })
    listQuery = applyGroupFilters(listQuery, { status, courseId, startDate, endDate, dateField })

    const keywordOrClause = buildKeywordOrClause(keyword, matchedCourseIds)
    if (keywordOrClause) {
      listQuery = listQuery.or(keywordOrClause)
    }

    const { data, error } = await listQuery

    if (error) {
      throw error
    }

    let filteredData = data || []

    if (dateField === 'success_time') {
      const successTimeMap = await buildSuccessTimeMap(
        filteredData.map(item => item.id).filter(Boolean),
        { startDate, endDate }
      )

      filteredData = filteredData.filter(item => successTimeMap[item.id])
    }

    if (dateField === 'joined_at') {
      const joinedGroupIds = await buildJoinedGroupIdSet({ startDate, endDate })
      filteredData = filteredData.filter(item => joinedGroupIds.has(item.id))
    }

    const count = filteredData.length
    const pagedData = filteredData.slice(from, to + 1)

    const courseIds = [...new Set(pagedData.map(item => item.course_id).filter(Boolean))]
    const creatorIds = [...new Set(pagedData.map(item => item.creator_id).filter(Boolean))]

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

    const list = pagedData.map(item => ({
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

    const summary = await getListSummary(
      {
        keyword,
        courseId,
        startDate,
        endDate,
        dateField
      },
      matchedCourseIds
    )

    return ok(res, {
      total: Number(count || 0),
      list,
      page,
      size,
      total_pages: Math.max(1, Math.ceil(Number(count || 0) / size)),
      summary
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
        .select('id, name, publish_time, unpublish_time, deadline, start_time, end_time, status')
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

    const lifecycle = course ? await getSingleCourseLifecycle(course.id) : null
    const courseStatus = lifecycle ? lifecycle.status : Number((course && course.status) || COURSE_STATUS.PENDING_PUBLISH)
    const anomalies = []

    if (group.status === 'failed' && orderList.some(item => item.status !== 'refunded')) {
      anomalies.push('失败团存在未退款订单')
    }
    if (Number(group.current_count || 0) !== memberList.length) {
      anomalies.push('团人数与成员数不一致')
    }
    if (group.status === 'success' && Number(group.current_count || 0) < Number(group.target_count || 0)) {
      anomalies.push('已成团状态但当前人数未达到成团门槛')
    }
    if (group.status === 'active' && courseStatus === COURSE_STATUS.GROUP_FAILED) {
      anomalies.push('课程已进入拼团失败，但当前团仍显示进行中')
    }
    if (group.status === 'success' && courseStatus === COURSE_STATUS.GROUP_FAILED) {
      anomalies.push('课程状态为拼团失败，但当前团已标记成功，请核对课程状态同步')
    }
    if (
      course &&
      group.expire_time &&
      course.deadline &&
      new Date(group.expire_time).getTime() !== new Date(course.deadline).getTime()
    ) {
      anomalies.push('团截止时间与课程报名截止时间不一致')
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
      course_status: courseStatus,
      course_status_text: COURSE_STATUS_TEXT[courseStatus] || '未知',
      publish_time: formatDateTime(course && course.publish_time),
      unpublish_time: formatDateTime(course && course.unpublish_time),
      deadline: formatDateTime(course && course.deadline),
      start_time: formatDateTime(course && course.start_time),
      end_time: formatDateTime(course && course.end_time),
      refund_order_count: orderList.filter(item => item.status === 'refunded').length,
      paid_order_count: orderList.filter(item => item.status === 'success').length,
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
