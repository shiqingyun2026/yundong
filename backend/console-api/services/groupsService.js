const { formatDateTime, getPagination } = require('../routes/_helpers')
const { ensureFound } = require('./_guards')
const supabase = require('../../utils/supabase')
const { env } = require('../../config/env')
const { COURSE_STATUS, getSingleCourseLifecycle } = require('../../utils/courseLifecycle')
const { AUTO_REFUND_REASON } = require('../../shared/constants/refunds')
const { coursesRepository, groupMembersRepository, groupsRepository, ordersRepository, usersRepository } = require('../../repositories')

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

const buildDateRange = (startDate = '', endDate = '') => ({
  start: startDate ? `${startDate}T00:00:00+08:00` : '',
  end: endDate ? `${endDate}T23:59:59+08:00` : ''
})

const withinRange = (value, { start = '', end = '' } = {}) => {
  if (!start && !end) {
    return true
  }

  if (!value) {
    return false
  }

  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) {
    return false
  }

  if (start && timestamp < new Date(start).getTime()) {
    return false
  }

  if (end && timestamp > new Date(end).getTime()) {
    return false
  }

  return true
}

const listGroupsViaMySql = async ({ keyword = '', status = '', courseId = '', startDate = '', endDate = '', dateField = 'created_at' }) => {
  const courses = keyword ? await coursesRepository.listCourses({ keyword }) : []
  const matchedCourseIds = keyword ? courses.map(item => item.id).filter(Boolean) : []
  const users = keyword ? await usersRepository.listUsers({ keyword }) : []
  const matchedCreatorIds = keyword ? users.map(item => item.id).filter(Boolean) : []
  const range = buildDateRange(startDate, endDate)

  const allGroups = await groupsRepository.listGroups({
    courseIds: courseId ? [courseId] : [],
    statuses: status ? [status] : []
  })

  let filteredData = (allGroups || []).filter(item => {
    if (!keyword) {
      return true
    }

    return item.id.includes(keyword) || matchedCourseIds.includes(item.course_id) || matchedCreatorIds.includes(item.creator_id)
  })

  if (dateField === 'created_at' || dateField === 'expire_time') {
    filteredData = filteredData.filter(item => withinRange(item[dateField], range))
  }

  if (dateField === 'success_time') {
    filteredData = filteredData.filter(item => withinRange(item.success_time, range))
  }

  if (dateField === 'joined_at') {
    const memberships = await groupMembersRepository.listGroupMembers()
    const joinedGroupIds = new Set(
      memberships.filter(item => withinRange(item.joined_at, range)).map(item => item.group_id).filter(Boolean)
    )
    filteredData = filteredData.filter(item => joinedGroupIds.has(item.id))
  }

  filteredData.sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())

  const courseIds = [...new Set(filteredData.map(item => item.course_id).filter(Boolean))]
  const creatorIds = [...new Set(filteredData.map(item => item.creator_id).filter(Boolean))]
  const [courseRows, creatorRows] = await Promise.all([
    courseIds.length ? coursesRepository.findCoursesByIds(courseIds) : Promise.resolve([]),
    creatorIds.length ? usersRepository.listUsersByIds(creatorIds) : Promise.resolve([])
  ])

  const coursesById = toMap(courseRows || [])
  const creatorsById = toMap(creatorRows || [])
  const summary = {
    total: filteredData.length,
    active: filteredData.filter(item => item.status === 'active').length,
    success: filteredData.filter(item => item.status === 'success').length,
    failed: filteredData.filter(item => item.status === 'failed').length
  }

  return {
    matchedCourseIds,
    list: filteredData.map(item => ({
      id: item.id,
      course_id: item.course_id || '',
      course_title: (coursesById[item.course_id] && coursesById[item.course_id].name) || '',
      status: mapGroupStatus(item.status),
      current_count: Number(item.current_count || 0),
      target_count: Number(item.target_count || 0),
      creator_name: (creatorsById[item.creator_id] && creatorsById[item.creator_id].nickname) || '',
      expire_time: formatDateTime(item.expire_time),
      create_time: formatDateTime(item.created_at)
    })),
    summary
  }
}

const listGroups = async ({ query = {} }) => {
  const { page, size, from, to } = getPagination(query)
  const keyword = `${query.keyword || ''}`.trim()
  const status = `${query.status || ''}`.trim()
  const courseId = `${query.course_id || ''}`.trim()
  const startDate = `${query.start_date || ''}`.trim()
  const endDate = `${query.end_date || ''}`.trim()
  const dateField = ['created_at', 'expire_time', 'success_time', 'joined_at'].includes(`${query.date_field || ''}`)
    ? `${query.date_field}`
    : 'created_at'

  if (env.useMySqlRepositories) {
    const result = await listGroupsViaMySql({
      keyword,
      status,
      courseId,
      startDate,
      endDate,
      dateField
    })

    return {
      total: result.list.length,
      list: result.list.slice(from, to + 1),
      page,
      size,
      total_pages: Math.max(1, Math.ceil(result.list.length / size)),
      summary: result.summary
    }
  }

  const buildKeywordOrClause = (value, courseIds = []) => {
    const clauses = []

    if (value) {
      clauses.push(`id.ilike.%${value}%`)
    }

    if (courseIds.length) {
      clauses.push(`course_id.in.(${courseIds.join(',')})`)
    }

    return clauses.join(',')
  }

  const applyGroupFilters = (queryBuilder, { status: statusFilter = '', courseId: courseIdFilter = '', startDate: startDateFilter = '', endDate: endDateFilter = '', dateField: field = 'created_at' }) => {
    if (statusFilter) {
      queryBuilder = queryBuilder.eq('status', statusFilter)
    }

    if (courseIdFilter) {
      queryBuilder = queryBuilder.eq('course_id', courseIdFilter)
    }

    if (field !== 'success_time' && field !== 'joined_at') {
      if (startDateFilter) {
        queryBuilder = queryBuilder.gte(field, `${startDateFilter}T00:00:00+08:00`)
      }

      if (endDateFilter) {
        queryBuilder = queryBuilder.lte(field, `${endDateFilter}T23:59:59+08:00`)
      }
    }

    return queryBuilder
  }

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
  const range = buildDateRange(startDate, endDate)

  if (dateField === 'success_time') {
    const { data: successOrders, error: successOrdersError } = await supabase
      .from('orders')
      .select('group_id, pay_time, created_at, status')
      .in('group_id', filteredData.map(item => item.id).filter(Boolean))
      .eq('status', 'success')

    if (successOrdersError) {
      throw successOrdersError
    }

    const successTimeMap = (successOrders || []).reduce((result, item) => {
      const candidate = item.pay_time || item.created_at || ''
      if (!item.group_id) {
        return result
      }

      if (!result[item.group_id] || candidate > result[item.group_id]) {
        result[item.group_id] = candidate
      }
      return result
    }, {})

    filteredData = filteredData.filter(item => successTimeMap[item.id] && withinRange(successTimeMap[item.id], range))
  }

  if (dateField === 'joined_at') {
    let queryBuilder = supabase.from('group_members').select('group_id')
    if (range.start) {
      queryBuilder = queryBuilder.gte('joined_at', range.start)
    }
    if (range.end) {
      queryBuilder = queryBuilder.lte('joined_at', range.end)
    }

    const { data: joinedMembers, error: joinedMembersError } = await queryBuilder
    if (joinedMembersError) {
      throw joinedMembersError
    }

    const joinedGroupIds = new Set((joinedMembers || []).map(item => item.group_id).filter(Boolean))
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

  const summary = {
    total: count,
    active: filteredData.filter(item => item.status === 'active').length,
    success: filteredData.filter(item => item.status === 'success').length,
    failed: filteredData.filter(item => item.status === 'failed').length
  }

  return {
    total: Number(count || 0),
    list,
    page,
    size,
    total_pages: Math.max(1, Math.ceil(Number(count || 0) / size)),
    summary
  }
}

const listGroupOrders = async ({ groupId }) => {
  const data = env.useMySqlRepositories
    ? await ordersRepository.listOrdersByGroupId({ groupId })
    : await (async () => {
        const { data: rows, error } = await supabase
          .from('orders')
          .select('id, order_no, user_id, amount, status, created_at, pay_time, refund_time, refund_reason, group_id')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false })

        if (error) {
          throw error
        }

        return rows || []
      })()

  const userIds = [...new Set((data || []).map(item => item.user_id).filter(Boolean))]
  const users = env.useMySqlRepositories
    ? await usersRepository.listUsersByIds(userIds)
    : (
        userIds.length
          ? await supabase.from('users').select('id, nickname').in('id', userIds)
          : { data: [] }
      ).data || []

  const usersById = toMap(users || [])

  return (data || []).map(item => ({
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
}

const getGroupDetail = async ({ groupId }) => {
  const group = env.useMySqlRepositories
    ? await groupsRepository.findGroupById(groupId)
    : await (async () => {
        const { data, error } = await supabase
          .from('groups')
          .select('id, course_id, creator_id, status, current_count, target_count, expire_time, created_at')
          .eq('id', groupId)
          .maybeSingle()

        if (error) {
          throw error
        }

        return data
      })()

  ensureFound(group, {
    responseCode: 2003,
    message: '拼团不存在'
  })

  const [course, creator, members, orders] = env.useMySqlRepositories
    ? await Promise.all([
        group.course_id ? coursesRepository.findCourseById(group.course_id) : Promise.resolve(null),
        group.creator_id ? usersRepository.findUserById(group.creator_id) : Promise.resolve(null),
        groupMembersRepository.listGroupMembers({ groupId: group.id }),
        ordersRepository.listOrdersByGroupId({ groupId: group.id })
      ])
    : await Promise.all([
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
      ]).then(([courseResult, creatorResult, membersResult, ordersResult]) => [
        courseResult.data,
        creatorResult.data,
        membersResult.data || [],
        ordersResult.data || []
      ])

  const memberUserIds = [...new Set((members || []).map(item => item.user_id).filter(Boolean))]
  const orderUserIds = [...new Set((orders || []).map(item => item.user_id).filter(Boolean))]
  const userIds = [...new Set([...memberUserIds, ...orderUserIds])]
  const users = env.useMySqlRepositories
    ? await usersRepository.listUsersByIds(userIds)
    : (
        userIds.length
          ? await supabase.from('users').select('id, nickname, avatar_url').in('id', userIds)
          : { data: [] }
      ).data || []

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

  return {
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
  }
}

module.exports = {
  getGroupDetail,
  listGroupOrders,
  listGroups
}
