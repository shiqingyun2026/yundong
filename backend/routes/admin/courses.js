const express = require('express')

const supabase = require('../../utils/supabase')
const {
  ok,
  fail,
  getPagination,
  formatDateTime,
  mapCourseStatus,
  parseShanghaiDateTimeInput
} = require('./_helpers')

const router = express.Router()

const mapCourseListItem = item => ({
  id: item.id,
  title: item.name || '',
  start_time: formatDateTime(item.start_time),
  end_time: '',
  location_community: '',
  location_detail: item.address || '',
  group_price: Number(item.group_price || 0),
  original_price: Number(item.original_price || 0),
  target_count: Number(item.default_target_count || 0),
  max_groups: Number(item.max_groups || 0),
  status: mapCourseStatus(item.start_time),
  cover: item.cover || ''
})

const mapCourseDetail = item => ({
  id: item.id,
  title: item.name || '',
  cover: item.cover || '',
  images: Array.isArray(item.images) ? item.images : [],
  description: item.description || '',
  age_range: item.age_limit || '',
  original_price: Number(item.original_price || 0),
  group_price: Number(item.group_price || 0),
  target_count: Number(item.default_target_count || 0),
  max_groups: Number(item.max_groups || 0),
  start_time: item.start_time || '',
  end_time: item.end_time || '',
  location_district: item.location_district || '',
  location_community: item.location_community || '',
  location_detail: item.location_detail || item.address || '',
  longitude: item.longitude || null,
  latitude: item.latitude || null,
  deadline: item.deadline || '',
  coach_name: item.coach_name || '',
  coach_intro: item.coach_intro || '',
  coach_cert: Array.isArray(item.coach_certificates) ? item.coach_certificates : [],
  rules: item.rules || '',
  status: item.status ?? mapCourseStatus(item.start_time)
})

const mapPayloadToCourse = payload => ({
  name: payload.title,
  cover: payload.cover,
  images: Array.isArray(payload.images) ? payload.images : [],
  description: payload.description,
  age_limit: payload.age_range,
  original_price: Number(payload.original_price || 0),
  group_price: Number(payload.group_price || 0),
  start_time: parseShanghaiDateTimeInput(payload.start_time),
  end_time: parseShanghaiDateTimeInput(payload.end_time),
  deadline: parseShanghaiDateTimeInput(payload.deadline),
  address:
    payload.location_community && payload.location_detail
      ? `${payload.location_community} ${payload.location_detail}`.trim()
      : payload.location_detail || payload.address || '',
  location_district: payload.location_district || '',
  location_community: payload.location_community || '',
  location_detail: payload.location_detail || payload.address || '',
  longitude: payload.longitude === '' || payload.longitude === null ? null : Number(payload.longitude),
  latitude: payload.latitude === '' || payload.latitude === null ? null : Number(payload.latitude),
  default_target_count:
    payload.target_count === '' || payload.target_count === null ? null : Number(payload.target_count || 0),
  coach_name: payload.coach_name || '',
  coach_intro: payload.coach_intro || '',
  coach_certificates: Array.isArray(payload.coach_cert) ? payload.coach_cert : [],
  rules: payload.rules || '',
  max_groups: Number(payload.max_groups || 0)
})

router.get('/', async (req, res) => {
  const { page, size, from, to } = getPagination(req.query || {})
  const keyword = `${req.query.keyword || ''}`.trim()

  try {
    let query = supabase
      .from('courses')
      .select('id, name, cover, address, start_time, group_price, original_price, max_groups', { count: 'exact' })
      .order('start_time', { ascending: true })
      .range(from, to)

    if (keyword) {
      query = query.ilike('name', `%${keyword}%`)
    }

    const { data, count, error } = await query

    if (error) {
      throw error
    }

    return ok(res, {
      total: count || 0,
      list: (data || []).map(mapCourseListItem),
      page,
      size
    })
  } catch (error) {
    return fail(res, 5000, error.message || '获取课程列表失败', 500)
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return fail(res, 2001, '课程不存在', 404)
    }

    return ok(res, mapCourseDetail(data))
  } catch (error) {
    return fail(res, 5000, error.message || '获取课程详情失败', 500)
  }
})

router.post('/', async (req, res) => {
  const payload = req.body || {}

  if (!payload.title) {
    return fail(res, 2001, '课程名称不能为空')
  }

  try {
    const { data, error } = await supabase
      .from('courses')
      .insert(mapPayloadToCourse(payload))
      .select('id')
      .single()

    if (error) {
      throw error
    }

    return ok(res, { id: data.id })
  } catch (error) {
    return fail(res, 5000, error.message || '创建课程失败', 500)
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('courses')
      .update(mapPayloadToCourse(req.body || {}))
      .eq('id', req.params.id)
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return fail(res, 2001, '课程不存在', 404)
    }

    return ok(res, { id: data.id })
  } catch (error) {
    return fail(res, 5000, error.message || '更新课程失败', 500)
  }
})

router.put('/:id/offline', async (req, res) => {
  return fail(res, 5000, '当前数据库尚未补齐课程状态字段，暂不支持下架操作', 501)
})

module.exports = router
