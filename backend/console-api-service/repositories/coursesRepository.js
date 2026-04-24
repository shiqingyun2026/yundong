const { execute, query } = require('../config/db')
const { buildInClause, createUuid, parseJsonField, toDbDateTime } = require('./_helpers')

const COURSE_SELECT_FIELDS = `
  id,
  name,
  course_category,
  cover,
  images,
  description,
  age_limit,
  address,
  location_district,
  location_community,
  location_detail,
  longitude,
  latitude,
  group_price,
  original_price,
  publish_time,
  unpublish_time,
  deadline,
  start_time,
  end_time,
  default_target_count,
  max_groups,
  status,
  coach_name,
  coach_intro,
  coach_certificates,
  rules,
  created_at,
  updated_at,
  created_by,
  updated_by
`

const normalizeCourse = row => {
  if (!row) {
    return null
  }

  return {
    ...row,
    images: Array.isArray(row.images) ? row.images : parseJsonField(row.images) || [],
    coach_certificates: Array.isArray(row.coach_certificates)
      ? row.coach_certificates
      : parseJsonField(row.coach_certificates) || []
  }
}

const findCourseById = async id => {
  const rows = await query(
    `
      select ${COURSE_SELECT_FIELDS}
      from courses
      where id = ?
      limit 1
    `,
    [id]
  )

  return normalizeCourse(rows[0])
}

const findCoursesByIds = async courseIds => {
  const { items, placeholders } = buildInClause(courseIds)
  if (!items.length) {
    return []
  }

  const rows = await query(
    `
      select ${COURSE_SELECT_FIELDS}
      from courses
      where id in (${placeholders})
    `,
    items
  )

  return rows.map(normalizeCourse)
}

const listCourses = async ({ keyword = '', category = '', startDateField = '', startDate, endDate } = {}) => {
  const conditions = []
  const params = []

  if (keyword) {
    conditions.push('name like ?')
    params.push(`%${keyword}%`)
  }

  if (category) {
    conditions.push('course_category = ?')
    params.push(category)
  }

  if (startDateField && startDate) {
    conditions.push(`${startDateField} >= ?`)
    params.push(toDbDateTime(startDate))
  }

  if (startDateField && endDate) {
    conditions.push(`${startDateField} <= ?`)
    params.push(toDbDateTime(endDate))
  }

  const whereSql = conditions.length ? `where ${conditions.join(' and ')}` : ''
  const rows = await query(
    `
      select ${COURSE_SELECT_FIELDS}
      from courses
      ${whereSql}
      order by start_time asc
    `,
    params
  )

  return rows.map(normalizeCourse)
}

const createCourse = async payload => {
  const now = toDbDateTime(new Date())
  const data = {
    ...payload,
    id: payload.id || createUuid(),
    images: JSON.stringify(Array.isArray(payload.images) ? payload.images : []),
    coach_certificates: JSON.stringify(Array.isArray(payload.coach_certificates) ? payload.coach_certificates : []),
    publish_time: toDbDateTime(payload.publish_time),
    unpublish_time: toDbDateTime(payload.unpublish_time),
    deadline: toDbDateTime(payload.deadline),
    start_time: toDbDateTime(payload.start_time),
    end_time: toDbDateTime(payload.end_time),
    created_at: toDbDateTime(payload.created_at) || now,
    updated_at: toDbDateTime(payload.updated_at) || now
  }

  await execute(
    `
      insert into courses (
        id, name, course_category, cover, images, description, age_limit, address,
        location_district, location_community, location_detail, longitude, latitude,
        group_price, original_price, publish_time, unpublish_time, deadline, start_time, end_time,
        default_target_count, max_groups, status, coach_name, coach_intro, coach_certificates, rules,
        created_at, updated_at, created_by, updated_by
      ) values (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `,
    [
      data.id,
      data.name || '',
      data.course_category || '',
      data.cover || '',
      data.images,
      data.description || '',
      data.age_limit || '',
      data.address || '',
      data.location_district || '',
      data.location_community || '',
      data.location_detail || '',
      data.longitude ?? null,
      data.latitude ?? null,
      Number(data.group_price || 0),
      Number(data.original_price || 0),
      data.publish_time || null,
      data.unpublish_time || null,
      data.deadline || null,
      data.start_time || null,
      data.end_time || null,
      data.default_target_count ?? null,
      Number(data.max_groups || 0),
      data.status ?? null,
      data.coach_name || '',
      data.coach_intro || '',
      data.coach_certificates,
      data.rules || '',
      data.created_at,
      data.updated_at,
      data.created_by || null,
      data.updated_by || null
    ]
  )

  return findCourseById(data.id)
}

const updateCourse = async (id, payload = {}) => {
  const updates = []
  const params = []

  const assign = (field, value, transform = current => current) => {
    if (value === undefined) {
      return
    }

    updates.push(`${field} = ?`)
    params.push(transform(value))
  }

  assign('name', payload.name)
  assign('course_category', payload.course_category)
  assign('cover', payload.cover)
  assign('images', payload.images, value => JSON.stringify(Array.isArray(value) ? value : []))
  assign('description', payload.description)
  assign('age_limit', payload.age_limit)
  assign('address', payload.address)
  assign('location_district', payload.location_district)
  assign('location_community', payload.location_community)
  assign('location_detail', payload.location_detail)
  assign('longitude', payload.longitude, value => (value === '' ? null : value))
  assign('latitude', payload.latitude, value => (value === '' ? null : value))
  assign('group_price', payload.group_price, value => Number(value || 0))
  assign('original_price', payload.original_price, value => Number(value || 0))
  assign('publish_time', payload.publish_time, value => toDbDateTime(value))
  assign('unpublish_time', payload.unpublish_time, value => toDbDateTime(value))
  assign('deadline', payload.deadline, value => toDbDateTime(value))
  assign('start_time', payload.start_time, value => toDbDateTime(value))
  assign('end_time', payload.end_time, value => toDbDateTime(value))
  assign('default_target_count', payload.default_target_count)
  assign('max_groups', payload.max_groups, value => Number(value || 0))
  assign('status', payload.status)
  assign('coach_name', payload.coach_name)
  assign('coach_intro', payload.coach_intro)
  assign('coach_certificates', payload.coach_certificates, value => JSON.stringify(Array.isArray(value) ? value : []))
  assign('rules', payload.rules)
  assign('updated_by', payload.updated_by)

  if (!updates.length) {
    return findCourseById(id)
  }

  updates.push('updated_at = ?')
  params.push(toDbDateTime(new Date()))
  params.push(id)

  await execute(`update courses set ${updates.join(', ')} where id = ?`, params)
  return findCourseById(id)
}

const updateCourseStatus = async (id, status, updatedAt = new Date()) => {
  await execute(
    `
      update courses
      set status = ?, updated_at = ?
      where id = ?
    `,
    [status, toDbDateTime(updatedAt), id]
  )

  return findCourseById(id)
}

module.exports = {
  createCourse,
  findCourseById,
  findCoursesByIds,
  listCourses,
  updateCourse,
  updateCourseStatus
}
