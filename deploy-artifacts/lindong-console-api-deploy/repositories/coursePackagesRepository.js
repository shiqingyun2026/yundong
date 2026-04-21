const { execute, query } = require('../config/db')
const { buildInClause, createUuid, parseJsonField, stringifyJsonField, toDbDateTime } = require('./_helpers')

const PACKAGE_CATEGORIES = ['体适能', '跳绳']

const PACKAGE_SELECT_FIELDS = `
  id,
  name,
  cover,
  images,
  total_price,
  package_category,
  class_count,
  class_duration_minutes,
  supported_people,
  group_price_config,
  location_district,
  location_community,
  location_detail,
  longitude,
  latitude,
  coach_name,
  coach_intro,
  coach_certificates,
  description,
  deadline_hours,
  publish_time,
  unpublish_time,
  status,
  created_at,
  updated_at,
  created_by,
  updated_by
`

const normalizeSupportedPeople = value => {
  const rawItems = Array.isArray(value)
    ? value
    : `${value || ''}`
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)

  const normalized = rawItems
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item > 0)

  return [...new Set(normalized)]
}

const stringifySupportedPeople = value => normalizeSupportedPeople(value).join(',')

const normalizeGroupPriceConfig = value => {
  const rawItems = Array.isArray(value) ? value : parseJsonField(value)
  const items = Array.isArray(rawItems) ? rawItems : []

  const normalized = items
    .map(item => ({
      target_count: Number(item && item.target_count) || 0,
      price_fen: Number(item && item.price_fen) || 0
    }))
    .filter(item => item.target_count > 0 && item.price_fen > 0)
    .sort((left, right) => left.target_count - right.target_count)

  const deduped = []
  const seen = new Set()

  normalized.forEach(item => {
    if (seen.has(item.target_count)) {
      return
    }

    seen.add(item.target_count)
    deduped.push(item)
  })

  return deduped
}

const normalizePackageCategory = value => {
  const normalized = `${value || ''}`.trim()
  return PACKAGE_CATEGORIES.includes(normalized) ? normalized : '体适能'
}

const normalizePackage = row => {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    name: row.name || '',
    cover: row.cover || '',
    images: Array.isArray(row.images) ? row.images : parseJsonField(row.images) || [],
    total_price: Number(row.total_price) || 0,
    package_category: normalizePackageCategory(row.package_category),
    class_count: Number(row.class_count) || 0,
    class_duration_minutes: Number(row.class_duration_minutes) || 0,
    supported_people: normalizeSupportedPeople(row.supported_people),
    group_price_config: normalizeGroupPriceConfig(row.group_price_config),
    location_district: row.location_district || '',
    location_community: row.location_community || '',
    location_detail: row.location_detail || '',
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    coach_name: row.coach_name || '',
    coach_intro: row.coach_intro || '',
    coach_certificates: Array.isArray(row.coach_certificates)
      ? row.coach_certificates
      : parseJsonField(row.coach_certificates) || [],
    description: row.description || '',
    deadline_hours: Number(row.deadline_hours) || 48,
    publish_time: row.publish_time || null,
    unpublish_time: row.unpublish_time || null,
    status: Number(row.status) || 0,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    created_by: row.created_by || null,
    updated_by: row.updated_by || null
  }
}

const findPackageById = async id => {
  const rows = await query(
    `
      select ${PACKAGE_SELECT_FIELDS}
      from course_packages
      where id = ?
      limit 1
    `,
    [id]
  )

  return normalizePackage(rows[0])
}

const findPackagesByIds = async packageIds => {
  const { items, placeholders } = buildInClause(packageIds)
  if (!items.length) {
    return []
  }

  const rows = await query(
    `
      select ${PACKAGE_SELECT_FIELDS}
      from course_packages
      where id in (${placeholders})
    `,
    items
  )

  return rows.map(normalizePackage)
}

const listPackages = async ({ keyword = '', district = '', category = '', status, statuses = [] } = {}) => {
  const conditions = []
  const params = []

  if (keyword) {
    conditions.push('name like ?')
    params.push(`%${keyword}%`)
  }

  if (district) {
    conditions.push('location_district = ?')
    params.push(district)
  }

  if (category) {
    conditions.push('package_category = ?')
    params.push(normalizePackageCategory(category))
  }

  if (status !== undefined && status !== null && status !== '') {
    conditions.push('status = ?')
    params.push(Number(status))
  }

  const statusFilter = buildInClause((statuses || []).map(item => Number(item)))
  if (statusFilter.items.length) {
    conditions.push(`status in (${statusFilter.placeholders})`)
    params.push(...statusFilter.items)
  }

  const whereSql = conditions.length ? `where ${conditions.join(' and ')}` : ''
  const rows = await query(
    `
      select ${PACKAGE_SELECT_FIELDS}
      from course_packages
      ${whereSql}
      order by created_at desc, id desc
    `,
    params
  )

  return rows.map(normalizePackage)
}

const createPackage = async payload => {
  const now = toDbDateTime(new Date())
  const data = {
    ...payload,
    id: payload.id || createUuid(),
    images: JSON.stringify(Array.isArray(payload.images) ? payload.images : []),
    total_price: Number(payload.total_price || 0),
    package_category: normalizePackageCategory(payload.package_category),
    class_count: Number(payload.class_count || 0),
    class_duration_minutes: Number(payload.class_duration_minutes || 0),
    supported_people: stringifySupportedPeople(payload.supported_people),
    group_price_config: stringifyJsonField(normalizeGroupPriceConfig(payload.group_price_config)),
    coach_certificates: JSON.stringify(Array.isArray(payload.coach_certificates) ? payload.coach_certificates : []),
    longitude: payload.longitude === '' ? null : payload.longitude ?? null,
    latitude: payload.latitude === '' ? null : payload.latitude ?? null,
    deadline_hours: Number(payload.deadline_hours || 48),
    publish_time: toDbDateTime(payload.publish_time),
    unpublish_time: toDbDateTime(payload.unpublish_time),
    status: Number(payload.status || 0),
    created_at: toDbDateTime(payload.created_at) || now,
    updated_at: toDbDateTime(payload.updated_at) || now
  }

  await execute(
    `
      insert into course_packages (
        id, name, cover, images, total_price, package_category, class_count, class_duration_minutes, supported_people, group_price_config,
        location_district, location_community, location_detail,
        longitude, latitude, coach_name, coach_intro, coach_certificates,
        description, deadline_hours, publish_time, unpublish_time, status, created_at, updated_at,
        created_by, updated_by
      ) values (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?
      )
    `,
    [
      data.id,
      data.name || '',
      data.cover || '',
      data.images,
      data.total_price,
      data.package_category,
      data.class_count,
      data.class_duration_minutes,
      data.supported_people,
      data.group_price_config,
      data.location_district || '',
      data.location_community || '',
      data.location_detail || '',
      data.longitude,
      data.latitude,
      data.coach_name || '',
      data.coach_intro || '',
      data.coach_certificates,
      data.description || '',
      data.deadline_hours,
      data.publish_time,
      data.unpublish_time,
      data.status,
      data.created_at,
      data.updated_at,
      data.created_by || null,
      data.updated_by || null
    ]
  )

  return findPackageById(data.id)
}

const updatePackage = async (id, payload = {}) => {
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
  assign('cover', payload.cover)
  assign('images', payload.images, value => JSON.stringify(Array.isArray(value) ? value : []))
  assign('total_price', payload.total_price, value => Number(value || 0))
  assign('package_category', payload.package_category, normalizePackageCategory)
  assign('class_count', payload.class_count, value => Number(value || 0))
  assign('class_duration_minutes', payload.class_duration_minutes, value => Number(value || 0))
  assign('supported_people', payload.supported_people, stringifySupportedPeople)
  assign('group_price_config', payload.group_price_config, value => stringifyJsonField(normalizeGroupPriceConfig(value)))
  assign('location_district', payload.location_district)
  assign('location_community', payload.location_community)
  assign('location_detail', payload.location_detail)
  assign('longitude', payload.longitude, value => (value === '' ? null : value))
  assign('latitude', payload.latitude, value => (value === '' ? null : value))
  assign('coach_name', payload.coach_name)
  assign('coach_intro', payload.coach_intro)
  assign('coach_certificates', payload.coach_certificates, value => JSON.stringify(Array.isArray(value) ? value : []))
  assign('description', payload.description)
  assign('deadline_hours', payload.deadline_hours, value => Number(value || 48))
  assign('publish_time', payload.publish_time, value => toDbDateTime(value))
  assign('unpublish_time', payload.unpublish_time, value => toDbDateTime(value))
  assign('status', payload.status, value => Number(value || 0))
  assign('created_by', payload.created_by)
  assign('updated_by', payload.updated_by)

  if (payload.updated_at !== undefined) {
    assign('updated_at', payload.updated_at, value => (value ? toDbDateTime(value) : toDbDateTime(new Date())))
  } else {
    updates.push('updated_at = ?')
    params.push(toDbDateTime(new Date()))
  }

  if (!updates.length) {
    return findPackageById(id)
  }

  params.push(id)
  await execute(`update course_packages set ${updates.join(', ')} where id = ?`, params)
  return findPackageById(id)
}

const updatePackageStatus = async (id, status, updatedAt = new Date()) => {
  await execute(
    `
      update course_packages
      set status = ?, updated_at = ?
      where id = ?
    `,
    [Number(status || 0), toDbDateTime(updatedAt), id]
  )

  return findPackageById(id)
}

module.exports = {
  createPackage,
  findPackageById,
  findPackagesByIds,
  listPackages,
  normalizePackageCategory,
  normalizeGroupPriceConfig,
  normalizeSupportedPeople,
  PACKAGE_CATEGORIES,
  stringifySupportedPeople,
  updatePackage,
  updatePackageStatus
}
