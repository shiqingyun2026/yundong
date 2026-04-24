const {
  formatDateTime,
  parseShanghaiDateTimeInput
} = require('../routes/_helpers')
const { ensureCondition, ensureFound } = require('./_guards')
const { COURSE_STATUS } = require('../../utils/courseLifecycle')
const { writeAdminLog } = require('../../utils/adminStore')
const { geocodeAddressWithTencentMap } = require('./tencentMapService')
const COURSE_CATEGORIES = ['体适能', '跳绳']

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
  category: item.course_category || '',
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
  category: item.course_category || '',
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

  if (!payload.title || !`${payload.title}`.trim()) return '课程名称不能为空'
  if (!payload.category || !COURSE_CATEGORIES.includes(`${payload.category}`.trim())) return '课程类别不合法'
  if (!payload.cover || !`${payload.cover}`.trim()) return '封面图不能为空'

  const groupPrice = Number(payload.group_price || 0)
  const originalPrice = Number(payload.original_price || 0)
  const targetCount = Number(payload.target_count || 0)
  const maxGroups = Number(payload.max_groups || 0)

  if (groupPrice <= 0 || originalPrice <= 0) return '价格必须大于 0'
  if (groupPrice > originalPrice) return '拼团价不能大于原价'
  if (targetCount <= 0) return '成团人数要求必须大于 0'
  if (maxGroups <= 0) return '最大成团数量必须大于 0'
  if (!payload.start_time || !parseShanghaiDateTimeInput(payload.start_time)) return '开课时间不能为空'
  if (!payload.end_time || !parseShanghaiDateTimeInput(payload.end_time)) return '下课时间不能为空'
  if (!payload.deadline || !parseShanghaiDateTimeInput(payload.deadline)) return '报名截止时间不能为空'
  if (!payload.publish_time || !parseShanghaiDateTimeInput(payload.publish_time)) return '上架时间不能为空'

  const startTime = new Date(parseShanghaiDateTimeInput(payload.start_time)).getTime()
  const endTime = new Date(parseShanghaiDateTimeInput(payload.end_time)).getTime()
  const deadline = new Date(parseShanghaiDateTimeInput(payload.deadline)).getTime()
  const publishTime = new Date(parseShanghaiDateTimeInput(payload.publish_time)).getTime()
  const unpublishTime = payload.unpublish_time ? new Date(parseShanghaiDateTimeInput(payload.unpublish_time)).getTime() : null
  const now = Date.now()

  if (!(deadline < startTime && startTime < endTime)) return '时间关系必须满足 报名截止 < 开课时间 < 结束时间'
  if (enforceFuturePublish && !(publishTime > now)) return '上架时间必须晚于当前时间'
  if (!(publishTime < deadline)) return '上架时间必须早于报名截止时间'
  if (unpublishTime !== null && Number.isFinite(unpublishTime) && unpublishTime <= publishTime) return '下架时间必须晚于上架时间'
  if (!buildAddress(payload)) return '上课地点不能为空'
  if (!payload.age_range || !`${payload.age_range}`.trim()) return '适龄范围不能为空'
  if (!payload.coach_name || !`${payload.coach_name}`.trim()) return '教练姓名不能为空'
  if (!payload.coach_intro || !`${payload.coach_intro}`.trim()) return '教练简介不能为空'
  if (!payload.description || !`${payload.description}`.trim()) return '课程介绍不能为空'

  return ''
}

const mapPayloadToCourse = payload => ({
  name: `${payload.title || ''}`.trim(),
  course_category: `${payload.category || ''}`.trim(),
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
  return geocodeAddressWithTencentMap({ district, detail })
}

module.exports = {
  COURSE_CATEGORIES,
  buildAddress,
  geocodeCourseAddress,
  mapCourseDetail,
  mapCourseListItem,
  mapPayloadToCourse,
  normalizeMinuteTimestamp,
  safeWriteAdminLog,
  validateCoursePayload
}
