const {
  formatDateTime,
  getPagination,
  parseShanghaiDateTimeInput
} = require('../routes/_helpers')
const { createConsoleApiError } = require('./_errors')
const { ensureCondition, ensureFound } = require('./_guards')
const supabase = require('../../utils/supabase')
const { COURSE_STATUS, getCourseLifecycleMap, getSingleCourseLifecycle } = require('../../utils/courseLifecycle')
const { writeAdminLog } = require('../../utils/adminStore')

const GEOCODE_API_BASE_URL = process.env.GEOCODE_API_BASE_URL || 'https://nominatim.openstreetmap.org/search'

const normalizeStringArray = value => {
  if (Array.isArray(value)) {
    return value.map(item => `${item}`.trim()).filter(Boolean)
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean)
  }

  return []
}

const mapCourseListItem = (item, lifecycle = {}) => ({
  id: item.id,
  title: item.name || '',
  publish_time: formatDateTime(item.publish_time),
  unpublish_time: formatDateTime(item.unpublish_time),
  deadline: formatDateTime(item.deadline),
  start_time: formatDateTime(item.start_time),
  end_time: formatDateTime(item.end_time),
  location_district: item.location_district || '',
  location_detail: item.location_detail || item.address || '',
  group_price: Number(item.group_price || 0),
  original_price: Number(item.original_price || 0),
  target_count: Number(item.default_target_count || 0),
  max_groups: Number(item.max_groups || 0),
  status: typeof lifecycle.status === 'number' ? lifecycle.status : Number(item.status || 0),
  cover: item.cover || ''
})

const mapCourseDetail = (item, lifecycle = {}) => ({
  id: item.id,
  title: item.name || '',
  cover: item.cover || '',
  description: item.description || '',
  age_range: item.age_limit || '',
  original_price: Number(item.original_price || 0),
  group_price: Number(item.group_price || 0),
  target_count: Number(item.default_target_count || 0),
  max_groups: Number(item.max_groups || 0),
  publish_time: formatDateTime(item.publish_time),
  unpublish_time: formatDateTime(item.unpublish_time),
  start_time: formatDateTime(item.start_time),
  end_time: formatDateTime(item.end_time),
  location_district: item.location_district || '',
  location_detail: item.location_detail || item.address || '',
  longitude: item.longitude || null,
  latitude: item.latitude || null,
  deadline: formatDateTime(item.deadline),
  coach_name: item.coach_name || '',
  coach_intro: item.coach_intro || '',
  coach_cert: Array.isArray(item.coach_certificates) ? item.coach_certificates : [],
  rules: item.rules || '',
  status: typeof lifecycle.status === 'number' ? lifecycle.status : Number(item.status || 0)
})

const buildAddress = payload => payload.location_detail || payload.address || ''

const normalizeMinuteTimestamp = value => {
  if (!Number.isFinite(value)) {
    return null
  }

  return Math.floor(value / 60000)
}

const safeWriteAdminLog = async payload => {
  try {
    await writeAdminLog(payload)
  } catch (error) {
    console.error('[admin/courses] write admin log failed', error)
  }
}

const validateCoursePayload = (payload, options = {}) => {
  const enforceFuturePublish = options.enforceFuturePublish !== false

  if (!payload.title || !`${payload.title}`.trim()) {
    return '课程名称不能为空'
  }

  if (!payload.cover || !`${payload.cover}`.trim()) {
    return '封面图不能为空'
  }

  const groupPrice = Number(payload.group_price || 0)
  const originalPrice = Number(payload.original_price || 0)
  const targetCount = Number(payload.target_count || 0)
  const maxGroups = Number(payload.max_groups || 0)

  if (groupPrice <= 0 || originalPrice <= 0) {
    return '价格必须大于 0'
  }

  if (groupPrice > originalPrice) {
    return '拼团价不能大于原价'
  }

  if (targetCount <= 0) {
    return '成团人数要求必须大于 0'
  }

  if (maxGroups <= 0) {
    return '最大成团数量必须大于 0'
  }

  if (!payload.start_time || !parseShanghaiDateTimeInput(payload.start_time)) {
    return '开课时间不能为空'
  }

  if (!payload.end_time || !parseShanghaiDateTimeInput(payload.end_time)) {
    return '下课时间不能为空'
  }

  if (!payload.deadline || !parseShanghaiDateTimeInput(payload.deadline)) {
    return '报名截止时间不能为空'
  }

  if (!payload.publish_time || !parseShanghaiDateTimeInput(payload.publish_time)) {
    return '上架时间不能为空'
  }

  const startTime = new Date(parseShanghaiDateTimeInput(payload.start_time)).getTime()
  const endTime = new Date(parseShanghaiDateTimeInput(payload.end_time)).getTime()
  const deadline = new Date(parseShanghaiDateTimeInput(payload.deadline)).getTime()
  const publishTime = new Date(parseShanghaiDateTimeInput(payload.publish_time)).getTime()
  const unpublishTime = payload.unpublish_time ? new Date(parseShanghaiDateTimeInput(payload.unpublish_time)).getTime() : null
  const now = Date.now()

  if (!(deadline < startTime && startTime < endTime)) {
    return '时间关系必须满足 报名截止 < 开课时间 < 结束时间'
  }

  if (enforceFuturePublish && !(publishTime > now)) {
    return '上架时间必须晚于当前时间'
  }

  if (!(publishTime < deadline)) {
    return '上架时间必须早于报名截止时间'
  }

  if (unpublishTime !== null && Number.isFinite(unpublishTime) && unpublishTime <= publishTime) {
    return '下架时间必须晚于上架时间'
  }

  if (!buildAddress(payload)) {
    return '上课地点不能为空'
  }

  if (!payload.age_range || !`${payload.age_range}`.trim()) {
    return '适龄范围不能为空'
  }

  if (!payload.coach_name || !`${payload.coach_name}`.trim()) {
    return '教练姓名不能为空'
  }

  if (!payload.coach_intro || !`${payload.coach_intro}`.trim()) {
    return '教练简介不能为空'
  }

  if (!payload.description || !`${payload.description}`.trim()) {
    return '课程介绍不能为空'
  }

  return ''
}

const mapPayloadToCourse = payload => ({
  name: `${payload.title || ''}`.trim(),
  cover: `${payload.cover || ''}`.trim(),
  images: payload.cover ? [payload.cover] : [],
  description: payload.description || '',
  age_limit: `${payload.age_range || ''}`.trim(),
  original_price: Number(payload.original_price || 0),
  group_price: Number(payload.group_price || 0),
  publish_time: parseShanghaiDateTimeInput(payload.publish_time),
  unpublish_time: parseShanghaiDateTimeInput(payload.unpublish_time),
  start_time: parseShanghaiDateTimeInput(payload.start_time),
  end_time: parseShanghaiDateTimeInput(payload.end_time),
  deadline: parseShanghaiDateTimeInput(payload.deadline),
  address: buildAddress(payload),
  location_district: payload.location_district || '',
  location_community: '',
  location_detail: payload.location_detail || payload.address || '',
  longitude: payload.longitude === '' || payload.longitude === null ? null : Number(payload.longitude),
  latitude: payload.latitude === '' || payload.latitude === null ? null : Number(payload.latitude),
  default_target_count: payload.target_count === '' || payload.target_count === null ? null : Number(payload.target_count || 0),
  coach_name: payload.coach_name || '',
  coach_intro: payload.coach_intro || '',
  coach_certificates: normalizeStringArray(payload.coach_cert),
  rules: payload.rules || '',
  max_groups: Number(payload.max_groups || 0),
  status: COURSE_STATUS.PENDING_PUBLISH,
  updated_at: new Date().toISOString()
})

const geocodeCourseAddress = async ({ district, detail }) => {
  const normalizedDistrict = `${district || ''}`.trim()
  const normalizedDetail = `${detail || ''}`.trim()

  ensureCondition(!!normalizedDetail, {
    responseCode: 5000,
    statusCode: 400,
    message: '详细地点不能为空'
  })

  const query = [normalizedDistrict, normalizedDetail].filter(Boolean).join(' ')
  const url = new URL(GEOCODE_API_BASE_URL)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('q', query)

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'lindong-admin-console/1.0'
    }
  })

  if (!response.ok) {
    throw new Error(`地理编码服务调用失败: ${response.status}`)
  }

  const result = await response.json()
  const first = Array.isArray(result) ? result[0] : null

  ensureFound(first, {
    responseCode: 5000,
    message: '未查询到对应坐标'
  })

  return {
    formatted_address: first.display_name || query,
    longitude: Number(first.lon),
    latitude: Number(first.lat)
  }
}

const listCourses = async ({ query = {}, admin = {} }) => {
  const { page, size, from, to } = getPagination(query)
  const keyword = `${query.keyword || ''}`.trim()
  const startDate = `${query.start_date || ''}`.trim()
  const endDate = `${query.end_date || ''}`.trim()
  const status = `${query.status || ''}`.trim()
  const dateField = ['publish_time', 'start_time', 'deadline', 'unpublish_time'].includes(`${query.date_field || ''}`)
    ? `${query.date_field}`
    : 'start_time'

  let listQuery = supabase
    .from('courses')
    .select(
      'id, name, cover, address, location_district, location_detail, publish_time, unpublish_time, deadline, start_time, end_time, group_price, original_price, max_groups, default_target_count, status'
    )
    .order('start_time', { ascending: true })

  if (keyword) {
    listQuery = listQuery.ilike('name', `%${keyword}%`)
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
