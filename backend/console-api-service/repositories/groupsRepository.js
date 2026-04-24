const { execute, query } = require('../config/db')
const { buildInClause, createUuid, toDbDateTime } = require('./_helpers')

const GROUP_SELECT_FIELDS = `
  id,
  course_id,
  creator_id,
  status,
  current_count,
  target_count,
  expire_time,
  created_at,
  success_time
`

const normalizeGroup = row => {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    course_id: row.course_id,
    creator_id: row.creator_id || '',
    status: row.status || '',
    current_count: Number(row.current_count) || 0,
    target_count: Number(row.target_count) || 0,
    expire_time: row.expire_time || null,
    created_at: row.created_at || null,
    success_time: row.success_time || null
  }
}

const createGroup = async ({
  id = createUuid(),
  course_id,
  creator_id,
  status = 'active',
  current_count = 0,
  target_count = 0,
  expire_time,
  created_at = toDbDateTime(new Date()),
  success_time = null
}) => {
  await execute(
    `
      insert into \`groups\` (
        id, course_id, creator_id, status, current_count, target_count, expire_time, created_at, success_time
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [id, course_id, creator_id || null, status, Number(current_count) || 0, Number(target_count) || 0, expire_time, created_at, success_time]
  )

  return findGroupById(id)
}

const findGroupById = async id => {
  const rows = await query(
    `
      select ${GROUP_SELECT_FIELDS}
      from \`groups\`
      where id = ?
      limit 1
    `,
    [id]
  )

  return normalizeGroup(rows[0])
}

const findActiveGroupByCourseId = async (courseId, now = new Date()) => {
  const rows = await query(
    `
      select ${GROUP_SELECT_FIELDS}
      from \`groups\`
      where course_id = ?
        and status = 'active'
        and expire_time > ?
      order by expire_time asc
      limit 1
    `,
    [courseId, toDbDateTime(now)]
  )

  return normalizeGroup(rows[0])
}

const listGroups = async ({ courseIds = [], statuses = [], beforeExpireTime, afterExpireTime } = {}) => {
  const conditions = []
  const params = []

  const courseFilter = buildInClause(courseIds)
  if (courseFilter.items.length) {
    conditions.push(`course_id in (${courseFilter.placeholders})`)
    params.push(...courseFilter.items)
  }

  const statusFilter = buildInClause(statuses)
  if (statusFilter.items.length) {
    conditions.push(`status in (${statusFilter.placeholders})`)
    params.push(...statusFilter.items)
  }

  if (beforeExpireTime) {
    conditions.push('expire_time <= ?')
    params.push(toDbDateTime(beforeExpireTime))
  }

  if (afterExpireTime) {
    conditions.push('expire_time > ?')
    params.push(toDbDateTime(afterExpireTime))
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : ''
  const rows = await query(
    `
      select ${GROUP_SELECT_FIELDS}
      from \`groups\`
      ${where}
      order by expire_time desc
    `,
    params
  )

  return rows.map(normalizeGroup)
}

const listGroupsByCourseId = async courseId => {
  const rows = await query(
    `
      select ${GROUP_SELECT_FIELDS}
      from \`groups\`
      where course_id = ?
      order by expire_time desc
    `,
    [courseId]
  )

  return rows.map(normalizeGroup)
}

const updateGroup = async (id, payload = {}) => {
  const updates = []
  const params = []

  const assign = (field, value, transform = current => current) => {
    if (value === undefined) {
      return
    }

    updates.push(`${field} = ?`)
    params.push(transform(value))
  }

  assign('course_id', payload.course_id)
  assign('creator_id', payload.creator_id)
  assign('status', payload.status)
  assign('current_count', payload.current_count, value => Number(value) || 0)
  assign('target_count', payload.target_count, value => Number(value) || 0)
  assign('expire_time', payload.expire_time)
  assign('success_time', payload.success_time)

  if (!updates.length) {
    return findGroupById(id)
  }

  params.push(id)
  await execute(`update \`groups\` set ${updates.join(', ')} where id = ?`, params)
  return findGroupById(id)
}

const bulkUpdateGroupStatus = async ({ groupIds = [], status, successTime = undefined }) => {
  const { items, placeholders } = buildInClause(groupIds)
  if (!items.length) {
    return []
  }

  const updates = ['status = ?']
  const params = [status]

  if (successTime !== undefined) {
    updates.push('success_time = ?')
    params.push(successTime ? toDbDateTime(successTime) : null)
  }

  await execute(
    `
      update \`groups\`
      set ${updates.join(', ')}
      where id in (${placeholders})
    `,
    [...params, ...items]
  )

  const rows = await query(
    `
      select ${GROUP_SELECT_FIELDS}
      from \`groups\`
      where id in (${placeholders})
    `,
    items
  )

  return rows.map(normalizeGroup)
}

module.exports = {
  bulkUpdateGroupStatus,
  createGroup,
  findActiveGroupByCourseId,
  findGroupById,
  listGroups,
  listGroupsByCourseId,
  updateGroup
}
