const crypto = require('crypto')

const { query, execute } = require('../config/db')

const normalizeUser = row => {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    openid: row.openid,
    nickname: row.nickname || '',
    avatar_url: row.avatar_url || '',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  }
}

const createUser = async ({ id = crypto.randomUUID(), openid, nickname = '微信用户', avatarUrl = '' }) => {
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ')

  await execute(
    `
      insert into users (
        id,
        openid,
        nickname,
        avatar_url,
        created_at
      ) values (?, ?, ?, ?, ?)
    `,
    [id, openid, nickname, avatarUrl, timestamp]
  )

  return findUserById(id)
}

const findUserById = async id => {
  const rows = await query(
    `
      select id, openid, nickname, avatar_url, created_at, updated_at
      from users
      where id = ?
      limit 1
    `,
    [id]
  )

  return normalizeUser(rows[0])
}

const findUserByOpenId = async openid => {
  const rows = await query(
    `
      select id, openid, nickname, avatar_url, created_at, updated_at
      from users
      where openid = ?
      limit 1
    `,
    [openid]
  )

  return normalizeUser(rows[0])
}

const listUsersByIds = async userIds => {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!ids.length) {
    return []
  }

  const placeholders = ids.map(() => '?').join(', ')
  const rows = await query(
    `
      select id, openid, nickname, avatar_url, created_at, updated_at
      from users
      where id in (${placeholders})
    `,
    ids
  )

  return rows.map(normalizeUser)
}

const listUsers = async ({ keyword = '' } = {}) => {
  const conditions = []
  const params = []

  if (keyword) {
    conditions.push('(id like ? or nickname like ?)')
    params.push(`%${keyword}%`, `%${keyword}%`)
  }

  const whereSql = conditions.length ? `where ${conditions.join(' and ')}` : ''
  const rows = await query(
    `
      select id, openid, nickname, avatar_url, created_at, updated_at
      from users
      ${whereSql}
      order by created_at desc
    `,
    params
  )

  return rows.map(normalizeUser)
}

const updateUserProfile = async ({ id, nickname, avatarUrl }) => {
  const updates = []
  const params = []

  if (nickname !== undefined) {
    updates.push('nickname = ?')
    params.push(nickname)
  }

  if (avatarUrl !== undefined) {
    updates.push('avatar_url = ?')
    params.push(avatarUrl)
  }

  if (!updates.length) {
    return findUserById(id)
  }

  updates.push('updated_at = ?')
  params.push(new Date().toISOString().slice(0, 19).replace('T', ' '))
  params.push(id)

  await execute(`update users set ${updates.join(', ')} where id = ?`, params)
  return findUserById(id)
}

module.exports = {
  createUser,
  findUserById,
  findUserByOpenId,
  listUsers,
  listUsersByIds,
  updateUserProfile
}
