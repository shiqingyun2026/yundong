const { execute, query } = require('../config/db')
const { buildInClause, toDbDateTime } = require('./_helpers')

const normalizeGroupMember = row => {
  if (!row) {
    return null
  }

  return {
    group_id: row.group_id,
    user_id: row.user_id,
    joined_at: row.joined_at || null
  }
}

const addMember = async ({ groupId, userId, joinedAt = new Date() }) => {
  await execute(
    `
      insert into group_members (group_id, user_id, joined_at)
      values (?, ?, ?)
    `,
    [groupId, userId, toDbDateTime(joinedAt)]
  )

  return findMembership({
    groupId,
    userId
  })
}

const findMembership = async ({ groupId, userId }) => {
  const rows = await query(
    `
      select group_id, user_id, joined_at
      from group_members
      where group_id = ?
        and user_id = ?
      limit 1
    `,
    [groupId, userId]
  )

  return normalizeGroupMember(rows[0])
}

const listGroupIdsByUserId = async userId => {
  const rows = await query(
    `
      select group_id
      from group_members
      where user_id = ?
      order by joined_at desc
    `,
    [userId]
  )

  return rows.map(item => item.group_id).filter(Boolean)
}

const listGroupMembers = async ({ groupId, userId, groupIds = [] } = {}) => {
  const conditions = []
  const params = []

  if (groupId) {
    conditions.push('group_id = ?')
    params.push(groupId)
  }

  if (userId) {
    conditions.push('user_id = ?')
    params.push(userId)
  }

  const groupFilter = buildInClause(groupIds)
  if (groupFilter.items.length) {
    conditions.push(`group_id in (${groupFilter.placeholders})`)
    params.push(...groupFilter.items)
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : ''
  const rows = await query(
    `
      select group_id, user_id, joined_at
      from group_members
      ${where}
      order by joined_at asc
    `,
    params
  )

  return rows.map(normalizeGroupMember)
}

const removeMember = async ({ groupId, userId }) => {
  const result = await execute(
    `
      delete from group_members
      where group_id = ?
        and user_id = ?
    `,
    [groupId, userId]
  )

  return Number(result.affectedRows || 0) > 0
}

module.exports = {
  addMember,
  findMembership,
  listGroupIdsByUserId,
  listGroupMembers,
  removeMember
}
