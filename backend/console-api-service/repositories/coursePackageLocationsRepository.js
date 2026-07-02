const { execute, query } = require('../config/db')
const { toDbDateTime } = require('./_helpers')

const normalizePackageLocation = row => {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    package_id: row.package_id || '',
    location_district: row.location_district || '',
    location_community: row.location_community || '',
    location_detail: row.location_detail || '',
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    sort_order: Number(row.sort_order) || 0,
    status: Number(row.status) === 0 ? 0 : 1,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  }
}

const findLocationById = async id => {
  const rows = await query(
    `
      select
        id, package_id, location_district, location_community, location_detail,
        longitude, latitude, sort_order, status, created_at, updated_at
      from course_package_locations
      where id = ?
      limit 1
    `,
    [id]
  )

  return normalizePackageLocation(rows[0])
}

const updateLocation = async (id, payload = {}) => {
  const updates = []
  const params = []

  const assign = (field, value, transform = current => current) => {
    if (value === undefined) {
      return
    }
    updates.push(`${field} = ?`)
    params.push(transform(value))
  }

  assign('location_district', payload.location_district)
  assign('location_community', payload.location_community)
  assign('location_detail', payload.location_detail)
  assign('longitude', payload.longitude, value => (value === '' ? null : value))
  assign('latitude', payload.latitude, value => (value === '' ? null : value))
  assign('sort_order', payload.sort_order, value => Number(value) || 0)
  assign('status', payload.status, value => (Number(value) === 0 ? 0 : 1))
  assign('updated_at', payload.updated_at || new Date(), value => toDbDateTime(value))

  if (!updates.length) {
    return findLocationById(id)
  }

  params.push(id)
  await execute(`update course_package_locations set ${updates.join(', ')} where id = ?`, params)
  return findLocationById(id)
}

module.exports = {
  findLocationById,
  normalizePackageLocation,
  updateLocation
}
