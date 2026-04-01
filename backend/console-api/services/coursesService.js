const {
  getPagination,
  parseShanghaiDateTimeInput
} = require('../routes/_helpers')
const { ensureCondition, ensureFound } = require('./_guards')
const supabase = require('../../utils/supabase')
const { COURSE_STATUS, getCourseLifecycleMap, getSingleCourseLifecycle } = require('../../utils/courseLifecycle')
const {
  geocodeCourseAddress,
  mapCourseDetail,
  mapCourseListItem,
  mapPayloadToCourse,
  normalizeMinuteTimestamp,
  safeWriteAdminLog,
  validateCoursePayload
} = require('./courseServiceHelpers')

const listCourses = async ({ query = {}, admin = {} }) => {
  const { page, size, from, to } = getPagination(query)
  const keyword = `${query.keyword || ''}`.trim()
  const category = `${query.category || ''}`.trim()
  const startDate = `${query.start_date || ''}`.trim()
  const endDate = `${query.end_date || ''}`.trim()
  const status = `${query.status || ''}`.trim()
  const dateField = ['publish_time', 'start_time', 'deadline', 'unpublish_time'].includes(`${query.date_field || ''}`)
    ? `${query.date_field}`
    : 'start_time'

  let listQuery = supabase
    .from('courses')
    .select(
      'id, name, course_category, cover, address, location_district, location_detail, publish_time, unpublish_time, deadline, start_time, end_time, group_price, original_price, max_groups, default_target_count, status'
    )
    .order('start_time', { ascending: true })

  if (keyword) {
    listQuery = listQuery.ilike('name', `%${keyword}%`)
  }

  if (category) {
    listQuery = listQuery.eq('course_category', category)
  }

  if (startDate) {
    listQuery = listQuery.gte(dateField, parseShanghaiDateTimeInput(`${startDate} 00:00:00`))
  }

  if (endDate) {
    listQuery = listQuery.lte(dateField, parseShanghaiDateTimeInput(`${endDate} 23:59:59`))
  }

  const { data, error } = await listQuery

  if (error) {
    throw error
  }

  const courseIds = (data || []).map(item => item.id)
  const lifecycleMap = await getCourseLifecycleMap(courseIds, {
    operatorId: admin && admin.id
  })

  const filteredList = (data || [])
    .map(item => mapCourseListItem(item, lifecycleMap[item.id]))
    .filter(item => !status || `${item.status}` === status)

  return {
    total: filteredList.length,
    list: filteredList.slice(from, to + 1),
    page,
    size,
    total_pages: Math.max(1, Math.ceil(filteredList.length / size))
  }
}

const getCourseDetail = async ({ courseId, admin = {} }) => {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .maybeSingle()

  if (error) {
    throw error
  }

  ensureFound(data, {
    responseCode: 2001,
    message: '课程不存在'
  })

  const lifecycle = await getSingleCourseLifecycle(data.id, {
    operatorId: admin && admin.id
  })

  return mapCourseDetail(data, lifecycle)
}

const listCourseGroups = async ({ courseId }) => {
  const { data, error } = await supabase
    .from('groups')
    .select('id, course_id, creator_id, status, current_count, target_count, expire_time, created_at')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const creatorIds = [...new Set((data || []).map(item => item.creator_id).filter(Boolean))]
  const { data: creators } = creatorIds.length
    ? await supabase.from('users').select('id, nickname').in('id', creatorIds)
    : { data: [] }

  const creatorsById = (creators || []).reduce((result, item) => {
    result[item.id] = item
    return result
  }, {})

  return (data || []).map(item => ({
    id: item.id,
    course_id: item.course_id || '',
    status: item.status || 'active',
    current_count: Number(item.current_count || 0),
    target_count: Number(item.target_count || 0),
    creator_name: (creatorsById[item.creator_id] && creatorsById[item.creator_id].nickname) || '',
    expire_time: formatDateTime(item.expire_time),
    create_time: formatDateTime(item.created_at)
  }))
}

const createCourse = async ({ payload = {}, admin = {}, ip = null }) => {
  const validationMessage = validateCoursePayload(payload)
  ensureCondition(!validationMessage, {
    responseCode: 2001,
    statusCode: 400,
    message: validationMessage || '课程参数不合法'
  })

  const { data, error } = await supabase
    .from('courses')
    .insert({
      ...mapPayloadToCourse(payload),
      created_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error) {
    throw error
  }

  await safeWriteAdminLog({
    adminId: admin.id,
    action: 'course_create',
    targetType: 'course',
    targetId: data.id,
    detail: {
      title: `${payload.title || ''}`.trim(),
      category: `${payload.category || ''}`.trim(),
      publish_time: parseShanghaiDateTimeInput(payload.publish_time),
      deadline: parseShanghaiDateTimeInput(payload.deadline),
      start_time: parseShanghaiDateTimeInput(payload.start_time)
    },
    ip
  })

  return { id: data.id }
}

const updateCourse = async ({ courseId, payload = {}, admin = {}, ip = null }) => {
  const { data: existing, error: existingError } = await supabase
    .from('courses')
    .select('id, publish_time')
    .eq('id', courseId)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  ensureFound(existing, {
    responseCode: 2001,
    message: '课程不存在'
  })

  const nextPublishTime = parseShanghaiDateTimeInput(payload.publish_time)
  const existingPublishTime = existing.publish_time ? new Date(existing.publish_time).getTime() : null
  const nextPublishTimestamp = nextPublishTime ? new Date(nextPublishTime).getTime() : null
  const isEditingPublishedCourse =
    existingPublishTime !== null &&
    existingPublishTime <= Date.now() &&
    normalizeMinuteTimestamp(nextPublishTimestamp) === normalizeMinuteTimestamp(existingPublishTime)

  const validationMessage = validateCoursePayload(payload, {
    enforceFuturePublish: !isEditingPublishedCourse
  })

  ensureCondition(!validationMessage, {
    responseCode: 2001,
    statusCode: 400,
    message: validationMessage || '课程参数不合法'
  })

  const { data, error } = await supabase
    .from('courses')
    .update(mapPayloadToCourse(payload))
    .eq('id', courseId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw error
  }

  await safeWriteAdminLog({
    adminId: admin.id,
    action: 'course_update',
    targetType: 'course',
    targetId: data.id,
    detail: {
      title: `${payload.title || ''}`.trim(),
      category: `${payload.category || ''}`.trim(),
      publish_time: parseShanghaiDateTimeInput(payload.publish_time),
      deadline: parseShanghaiDateTimeInput(payload.deadline),
      start_time: parseShanghaiDateTimeInput(payload.start_time),
      end_time: parseShanghaiDateTimeInput(payload.end_time)
    },
    ip
  })

  return { id: data.id }
}

const offlineCourse = async ({ courseId, admin = {}, ip = null }) => {
  const { data: existing, error: existingError } = await supabase
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  ensureFound(existing, {
    responseCode: 2001,
    message: '课程不存在'
  })

  const lifecycle = await getSingleCourseLifecycle(courseId, {
    operatorId: admin && admin.id
  })

  ensureCondition(
    [COURSE_STATUS.PENDING_PUBLISH, COURSE_STATUS.GROUP_FAILED, COURSE_STATUS.FINISHED].includes(lifecycle.status),
    {
      responseCode: 2001,
      statusCode: 400,
      message: '只有待上架、拼团失败或已结课的课程才允许下架'
    }
  )

  const offlineAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('courses')
    .update({
      unpublish_time: offlineAt,
      updated_at: offlineAt
    })
    .eq('id', courseId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw error
  }

  await safeWriteAdminLog({
    adminId: admin.id,
    action: 'course_offline',
    targetType: 'course',
    targetId: data.id,
    detail: {
      previous_status: lifecycle.status,
      offline_at: offlineAt
    },
    ip
  })

  return { id: data.id }
}

module.exports = {
  createCourse,
  geocodeCourseAddress,
  getCourseDetail,
  listCourseGroups,
  listCourses,
  offlineCourse,
  updateCourse
}
