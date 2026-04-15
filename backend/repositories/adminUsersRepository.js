const crypto = require('crypto')

const { execute, query } = require('../config/db')

const normalizeAdmin = row => {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    email: row.email || '',
    username: row.username || '',
    role: row.role || 'admin',
    status: row.status || 'active',
    password_hash: row.password_hash || '',
    password_updated_at: row.password_updated_at || null,
    last_login: row.last_login || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  }
}

const buildWhereClause = ({ keyword = '', role = '', status = '' }) => {
  const conditions = []
  const params = []

  if (keyword) {
    conditions.push('username like ?')
    params.push(`%${keyword}%`)
  }

  if (role) {
    conditions.push('role = ?')
    params.push(role)
  }

  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  return {
    sql: conditions.length ? `where ${conditions.join(' and ')}` : '',
    params
  }
}

const countActiveSuperAdmins = async () => {
  const rows = await query(
    `
      select count(*) as total
      from admin_users
      where role = 'super_admin'
        and status = 'active'
    `
  )

  return Number(rows[0] && rows[0].total) || 0
}

const createAdmin = async ({
  id = crypto.randomUUID(),
  email,
  username,
  passwordHash = '',
  passwordUpdatedAt = null,
  role = 'admin',
  status = 'active'
}) => {
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ')

  await execute(
    `
      insert into admin_users (
        id,
        email,
        username,
        password_hash,
        role,
        status,
        password_updated_at,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      email,
      username,
      passwordHash || null,
      role,
      status,
      passwordUpdatedAt || null,
      timestamp,
      timestamp
    ]
  )

  return findAdminById(id)
}

const deleteAdmin = async id => {
  const result = await execute('delete from admin_users where id = ?', [id])
  return Number(result.affectedRows || 0) > 0
}

const findAdminById = async id => {
  const rows = await query(
    `
      select
        id,
        email,
        username,
        password_hash,
        role,
        status,
        last_login,
        password_updated_at,
        created_at,
        updated_at
      from admin_users
      where id = ?
      limit 1
    `,
    [id]
  )

  return normalizeAdmin(rows[0])
}

const findAdminByUsername = async username => {
  const rows = await query(
    `
      select
        id,
        email,
        username,
        password_hash,
        role,
        status,
        last_login,
        password_updated_at,
        created_at,
        updated_at
      from admin_users
      where username = ?
      limit 1
    `,
    [username]
  )

  return normalizeAdmin(rows[0])
}

const listAdmins = async ({ keyword = '', role = '', status = '', from = 0, size = 10 } = {}) => {
  const where = buildWhereClause({ keyword, role, status })
  const totalRows = await query(
    `
      select count(*) as total
      from admin_users
      ${where.sql}
    `,
    where.params
  )

  const rows = await query(
    `
      select
        id,
        email,
        username,
        role,
        status,
        last_login,
        password_updated_at,
        created_at,
        updated_at
      from admin_users
      ${where.sql}
      order by created_at desc
      limit ?
      offset ?
    `,
    [...where.params, size, from]
  )

  return {
    total: Number(totalRows[0] && totalRows[0].total) || 0,
    list: rows.map(normalizeAdmin)
  }
}

const touchAdminLogin = async adminId => {
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  await execute(
    `
      update admin_users
      set last_login = ?, updated_at = ?
      where id = ?
    `,
    [timestamp, timestamp, adminId]
  )
}

const updateAdmin = async (id, { email, passwordHash, passwordUpdatedAt, role, status }) => {
  const updates = []
  const params = []

  if (email !== undefined) {
    updates.push('email = ?')
    params.push(email)
  }

  if (passwordHash !== undefined) {
    updates.push('password_hash = ?')
    params.push(passwordHash || null)
  }

  if (passwordUpdatedAt !== undefined) {
    updates.push('password_updated_at = ?')
    params.push(passwordUpdatedAt || null)
  }

  if (role !== undefined) {
    updates.push('role = ?')
    params.push(role)
  }

  if (status !== undefined) {
    updates.push('status = ?')
    params.push(status)
  }

  updates.push('updated_at = ?')
  params.push(new Date().toISOString().slice(0, 19).replace('T', ' '))
  params.push(id)

  await execute(`update admin_users set ${updates.join(', ')} where id = ?`, params)
  return findAdminById(id)
}

module.exports = {
  countActiveSuperAdmins,
  createAdmin,
  deleteAdmin,
  findAdminById,
  findAdminByUsername,
  listAdmins,
  touchAdminLogin,
  updateAdmin
}
