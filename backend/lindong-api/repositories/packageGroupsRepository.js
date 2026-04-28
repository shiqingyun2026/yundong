const { execute, query } = require('../config/db')
const { buildInClause, createUuid, toDbDateTime } = require('./_helpers')
const { buildPackageGroupId } = require('./bizSerialCountersRepository')

const PACKAGE_GROUP_SELECT_FIELDS = `
  id,
  package_id,
  creator_id,
  target_count,
  current_count,
  status,
  weekday,
  hour,
  first_class_time,
  deadline,
  created_at,
  success_time
`

const normalizePackageGroup = row => {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    package_id: row.package_id,
    creator_id: row.creator_id || '',
    target_count: Number(row.target_count) || 0,
    current_count: Number(row.current_count) || 0,
    status: row.status || 'active',
    weekday: Number(row.weekday) || 0,
    hour: Number(row.hour) || 0,
    first_class_time: row.first_class_time || null,
    deadline: row.deadline || null,
    created_at: row.created_at || null,
    success_time: row.success_time || null
  }
}

const createPackageGroup = async ({
  id,
  package_id,
  creator_id,
  target_count = 0,
  current_count = 0,
  status = 'active',
  weekday,
  hour,
  first_class_time = null,
  deadline,
  created_at = new Date(),
  success_time = null
}) => {
  const resolvedId = id || (await buildPackageGroupId(created_at || deadline || new Date()))

  await execute(
    `
      insert into package_groups (
        id, package_id, creator_id, target_count, current_count, status,
        weekday, hour, first_class_time, deadline, created_at, success_time
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      resolvedId,
      package_id,
      creator_id || null,
      Number(target_count) || 0,
      Number(current_count) || 0,
      status,
      Number(weekday) || 0,
      Number(hour) || 0,
      first_class_time ? toDbDateTime(first_class_time) : null,
      toDbDateTime(deadline),
      toDbDateTime(created_at) || toDbDateTime(new Date()),
      success_time ? toDbDateTime(success_time) : null
    ]
  )

  return findPackageGroupById(resolvedId)
}

const findPackageGroupById = async id => {
  const rows = await query(
    `
      select ${PACKAGE_GROUP_SELECT_FIELDS}
      from package_groups
      where id = ?
      limit 1
    `,
    [id]
  )

  return normalizePackageGroup(rows[0])
}

const findPackageGroupsByIds = async packageGroupIds => {
  const { items, placeholders } = buildInClause(packageGroupIds)
  if (!items.length) {
    return []
  }

  const rows = await query(
    `
      select ${PACKAGE_GROUP_SELECT_FIELDS}
      from package_groups
      where id in (${placeholders})
    `,
    items
  )

  return rows.map(normalizePackageGroup)
}

const findActivePackageGroupByPackageId = async (packageId, now = new Date()) => {
  const rows = await query(
    `
      select ${PACKAGE_GROUP_SELECT_FIELDS}
      from package_groups
      where package_id = ?
        and status = 'active'
        and deadline > ?
      order by deadline asc
      limit 1
    `,
    [packageId, toDbDateTime(now)]
  )

  return normalizePackageGroup(rows[0])
}

const listPackageGroups = async ({
  packageId,
  packageIds = [],
  creatorId,
  status,
  statuses = [],
  beforeDeadline,
  afterDeadline
} = {}) => {
  const conditions = []
  const params = []

  if (packageId) {
    conditions.push('package_id = ?')
    params.push(packageId)
  }

  const packageFilter = buildInClause(packageIds)
  if (packageFilter.items.length) {
    conditions.push(`package_id in (${packageFilter.placeholders})`)
    params.push(...packageFilter.items)
  }

  if (creatorId) {
    conditions.push('creator_id = ?')
    params.push(creatorId)
  }

  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  const statusFilter = buildInClause(statuses)
  if (statusFilter.items.length) {
    conditions.push(`status in (${statusFilter.placeholders})`)
    params.push(...statusFilter.items)
  }

  if (beforeDeadline) {
    conditions.push('deadline <= ?')
    params.push(toDbDateTime(beforeDeadline))
  }

  if (afterDeadline) {
    conditions.push('deadline > ?')
    params.push(toDbDateTime(afterDeadline))
  }

  const whereSql = conditions.length ? `where ${conditions.join(' and ')}` : ''
  const rows = await query(
    `
      select ${PACKAGE_GROUP_SELECT_FIELDS}
      from package_groups
      ${whereSql}
      order by deadline desc, created_at desc
    `,
    params
  )

  return rows.map(normalizePackageGroup)
}

const listPackageGroupsByPackageId = async packageId => {
  return listPackageGroups({ packageId })
}

const updatePackageGroup = async (id, payload = {}) => {
  const updates = []
  const params = []

  const assign = (field, value, transform = current => current) => {
    if (value === undefined) {
      return
    }

    updates.push(`${field} = ?`)
    params.push(transform(value))
  }

  assign('package_id', payload.package_id)
  assign('creator_id', payload.creator_id)
  assign('target_count', payload.target_count, value => Number(value) || 0)
  assign('current_count', payload.current_count, value => Number(value) || 0)
  assign('status', payload.status)
  assign('weekday', payload.weekday, value => Number(value) || 0)
  assign('hour', payload.hour, value => Number(value) || 0)
  assign('first_class_time', payload.first_class_time, value => (value ? toDbDateTime(value) : null))
  assign('deadline', payload.deadline, value => (value ? toDbDateTime(value) : null))
  assign('created_at', payload.created_at, value => (value ? toDbDateTime(value) : null))
  assign('success_time', payload.success_time, value => (value ? toDbDateTime(value) : null))

  if (!updates.length) {
    return findPackageGroupById(id)
  }

  params.push(id)
  await execute(`update package_groups set ${updates.join(', ')} where id = ?`, params)
  return findPackageGroupById(id)
}

const bulkUpdatePackageGroupStatus = async ({
  packageGroupIds = [],
  status,
  successTime = undefined,
  firstClassTime = undefined
}) => {
  const { items, placeholders } = buildInClause(packageGroupIds)
  if (!items.length) {
    return []
  }

  const updates = ['status = ?']
  const params = [status]

  if (successTime !== undefined) {
    updates.push('success_time = ?')
    params.push(successTime ? toDbDateTime(successTime) : null)
  }

  if (firstClassTime !== undefined) {
    updates.push('first_class_time = ?')
    params.push(firstClassTime ? toDbDateTime(firstClassTime) : null)
  }

  await execute(
    `
      update package_groups
      set ${updates.join(', ')}
      where id in (${placeholders})
    `,
    [...params, ...items]
  )

  const rows = await query(
    `
      select ${PACKAGE_GROUP_SELECT_FIELDS}
      from package_groups
      where id in (${placeholders})
    `,
    items
  )

  return rows.map(normalizePackageGroup)
}

module.exports = {
  bulkUpdatePackageGroupStatus,
  createPackageGroup,
  findActivePackageGroupByPackageId,
  findPackageGroupById,
  findPackageGroupsByIds,
  listPackageGroups,
  listPackageGroupsByPackageId,
  updatePackageGroup
}
