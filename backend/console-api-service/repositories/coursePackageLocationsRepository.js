const { execute, query } = require('../config/db')
const { buildInClause, toDbDateTime } = require('./_helpers')

const LOCATION_SELECT_FIELDS = `
  id,
  package_id,
  location_district,
  location_community,
  location_detail,
  longitude,
  latitude,
  sort_order,
  status,
  created_at,
  updated_at
`

const normalizePackageLocation = row => {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    package_id: row.package_id,
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

const listLocationsByPackageId = async packageId => {
  const rows = await query(
    `
      select ${LOCATION_SELECT_FIELDS}
      from course_package_locations
      where package_id = ?
      order by sort_order asc, created_at asc, id asc
    `,
    [packageId]
  )

  return rows.map(normalizePackageLocation)
}

const listLocationsByPackageIds = async packageIds => {
  const { items, placeholders } = buildInClause(packageIds)
  if (!items.length) {
    return []
  }

  const rows = await query(
    `
      select ${LOCATION_SELECT_FIELDS}
      from course_package_locations
      where package_id in (${placeholders})
      order by package_id asc, sort_order asc, created_at asc, id asc
    `,
    items
  )

  return rows.map(normalizePackageLocation)
}

const findLocationById = async id => {
  const rows = await query(
    `
      select ${LOCATION_SELECT_FIELDS}
      from course_package_locations
      where id = ?
      limit 1
    `,
    [id]
  )

  return normalizePackageLocation(rows[0])
}

const hasPackageGroupsUsingLocation = async locationId => {
  const rows = await query(
    `
      select id
      from package_groups
      where location_id = ?
      limit 1
    `,
    [locationId]
  )

  return rows.length > 0
}

const buildLocationId = ({ packageId, index }) => `${packageId}-loc-${String(index + 1).padStart(3, '0')}`

const replaceLocationsForPackage = async ({ packageId, locations = [], now = new Date() }) => {
  const existingLocations = await listLocationsByPackageId(packageId)
  const existingById = existingLocations.reduce((result, item) => {
    result[item.id] = item
    return result
  }, {})
  const nextIds = new Set()

  for (let index = 0; index < locations.length; index += 1) {
    const item = locations[index] || {}
    const locationId = `${item.id || ''}`.trim() || buildLocationId({ packageId, index })
    nextIds.add(locationId)

    const values = [
      locationId,
      packageId,
      item.location_district || '',
      item.location_community || '',
      item.location_detail || '',
      item.longitude === '' || item.longitude === undefined ? null : item.longitude,
      item.latitude === '' || item.latitude === undefined ? null : item.latitude,
      Number(item.sort_order) || index,
      Number(item.status) === 0 ? 0 : 1,
      toDbDateTime(now),
      toDbDateTime(now)
    ]

    if (existingById[locationId]) {
      await execute(
        `
          update course_package_locations
          set location_district = ?, location_community = ?, location_detail = ?,
              longitude = ?, latitude = ?, sort_order = ?, status = ?, updated_at = ?
          where id = ?
        `,
        [values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[10], locationId]
      )
      continue
    }

    await execute(
      `
        insert into course_package_locations (
          id, package_id, location_district, location_community, location_detail,
          longitude, latitude, sort_order, status, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      values
    )
  }

  for (const existing of existingLocations) {
    if (nextIds.has(existing.id)) {
      continue
    }

    if (await hasPackageGroupsUsingLocation(existing.id)) {
      await execute(
        `
          update course_package_locations
          set status = 0, updated_at = ?
          where id = ?
        `,
        [toDbDateTime(now), existing.id]
      )
      continue
    }

    await execute('delete from course_package_locations where id = ?', [existing.id])
  }

  return listLocationsByPackageId(packageId)
}

module.exports = {
  findLocationById,
  hasPackageGroupsUsingLocation,
  listLocationsByPackageId,
  listLocationsByPackageIds,
  normalizePackageLocation,
  replaceLocationsForPackage
}
