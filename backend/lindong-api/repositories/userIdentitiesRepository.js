const crypto = require('crypto')

const { query, execute } = require('../config/db')

const normalizeIdentity = row => {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    user_id: row.user_id,
    identity_type: row.identity_type || '',
    identity_key: row.identity_key || '',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    last_used_at: row.last_used_at || null
  }
}

const findIdentity = async ({ identityType, identityKey }) => {
  const rows = await query(
    `
      select id, user_id, identity_type, identity_key, created_at, updated_at, last_used_at
      from user_identities
      where identity_type = ?
        and identity_key = ?
      limit 1
    `,
    [identityType, identityKey]
  )

  return normalizeIdentity(rows[0])
}

const listIdentitiesByUserId = async userId => {
  const rows = await query(
    `
      select id, user_id, identity_type, identity_key, created_at, updated_at, last_used_at
      from user_identities
      where user_id = ?
      order by created_at asc
    `,
    [userId]
  )

  return rows.map(normalizeIdentity)
}

const assignIdentityToUser = async ({ id = crypto.randomUUID(), userId, identityType, identityKey, usedAt = new Date() }, executor = null) => {
  const timestamp = new Date(usedAt).toISOString().slice(0, 19).replace('T', ' ')

  await execute(
    `
      insert into user_identities (
        id,
        user_id,
        identity_type,
        identity_key,
        created_at,
        updated_at,
        last_used_at
      ) values (?, ?, ?, ?, ?, ?, ?)
      on duplicate key update
        user_id = values(user_id),
        updated_at = values(updated_at),
        last_used_at = values(last_used_at)
    `,
    [id, userId, identityType, identityKey, timestamp, timestamp, timestamp],
    executor
  )

  return findIdentity({
    identityType,
    identityKey
  })
}

module.exports = {
  assignIdentityToUser,
  findIdentity,
  listIdentitiesByUserId
}
