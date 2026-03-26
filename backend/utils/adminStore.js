const crypto = require('crypto')

const supabase = require('./supabase')

let adminUsersTableState = null
let adminLogTableState = null
let adminPasswordColumnState = null

const getBootstrapAdmin = () => ({
  id: process.env.ADMIN_BOOTSTRAP_ID || '00000000-0000-0000-0000-000000000001',
  username: process.env.ADMIN_BOOTSTRAP_USERNAME || 'admin',
  password: process.env.ADMIN_BOOTSTRAP_PASSWORD || 'admin123456',
  role: process.env.ADMIN_BOOTSTRAP_ROLE || 'super_admin',
  status: 'active'
})

const buildInternalAdminEmail = username => `${username}@admin.local`

const isTableMissingError = error => error && error.code === 'PGRST205'
const isColumnMissingError = error => error && (error.code === 'PGRST204' || error.code === '42703')

const hashPassword = password => {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

const verifyPassword = (password, passwordHash) => {
  if (!passwordHash || !passwordHash.startsWith('scrypt$')) {
    return false
  }

  const [, salt, storedHash] = passwordHash.split('$')
  const actualHash = crypto.scryptSync(password, salt, 64).toString('hex')
  const storedBuffer = Buffer.from(storedHash, 'hex')
  const actualBuffer = Buffer.from(actualHash, 'hex')

  if (storedBuffer.length !== actualBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(storedBuffer, actualBuffer)
}

const detectTable = async tableName => {
  const { error } = await supabase.from(tableName).select('*').limit(1)
  if (isTableMissingError(error)) {
    return false
  }

  if (error) {
    throw error
  }

  return true
}

const hasAdminUsersTable = async () => {
  if (adminUsersTableState !== null) {
    return adminUsersTableState
  }

  adminUsersTableState = await detectTable('admin_users')
  return adminUsersTableState
}

const hasAdminLogTable = async () => {
  if (adminLogTableState !== null) {
    return adminLogTableState
  }

  adminLogTableState = await detectTable('admin_log')
  return adminLogTableState
}

const hasAdminPasswordColumn = async () => {
  if (adminPasswordColumnState !== null) {
    return adminPasswordColumnState
  }

  const { error } = await supabase.from('admin_users').select('password_hash').limit(1)

  if (isColumnMissingError(error)) {
    adminPasswordColumnState = false
    return adminPasswordColumnState
  }

  if (error) {
    throw error
  }

  adminPasswordColumnState = true
  return adminPasswordColumnState
}

const listAdmins = async ({ keyword = '', from = 0, to = 9 } = {}) => {
  const fallbackAdmin = getBootstrapAdmin()

  if (!(await hasAdminUsersTable())) {
    return {
      total: keyword && !fallbackAdmin.username.includes(keyword) ? 0 : 1,
      list:
        keyword && !fallbackAdmin.username.includes(keyword)
          ? []
          : [
              {
                id: fallbackAdmin.id,
                username: fallbackAdmin.username,
                role: fallbackAdmin.role,
                status: fallbackAdmin.status,
                last_login: null,
                created_at: null
              }
            ]
    }
  }

  let query = supabase
    .from('admin_users')
    .select('id, username, role, status, last_login, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (keyword) {
    query = query.ilike('username', `%${keyword}%`)
  }

  const { data, count, error } = await query
  if (error) {
    throw error
  }

  return {
    total: count || 0,
    list: data || []
  }
}

const findAdminByUsername = async username => {
  const fallbackAdmin = getBootstrapAdmin()

  if (!(await hasAdminUsersTable())) {
    return username === fallbackAdmin.username ? fallbackAdmin : null
  }

  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('username', username)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return {
    ...data,
    password: fallbackAdmin.password
  }
}

const createAdmin = async ({ username, password, role = 'admin' }) => {
  const { data: existing, error: existingError } = await supabase
    .from('admin_users')
    .select('id')
    .eq('username', username)
    .limit(1)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  if (existing) {
    const error = new Error('账号已存在')
    error.code = 'ADMIN_EXISTS'
    throw error
  }

  const payload = {
    id: crypto.randomUUID(),
    username,
    email: buildInternalAdminEmail(username),
    role,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  if (await hasAdminPasswordColumn()) {
    payload.password_hash = hashPassword(password)
    payload.password_updated_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('admin_users')
    .insert(payload)
    .select('id, username, role, status, last_login, created_at')
    .single()

  if (error) {
    throw error
  }

  return data
}

const countActiveSuperAdmins = async () => {
  const { count, error } = await supabase
    .from('admin_users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'super_admin')
    .eq('status', 'active')

  if (error) {
    throw error
  }

  return Number(count) || 0
}

const updateAdmin = async (id, { password, role, status }) => {
  const { data: existing, error: existingError } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  if (!existing) {
    const error = new Error('账号不存在')
    error.code = 'ADMIN_NOT_FOUND'
    throw error
  }

  if (existing.role === 'super_admin' && role && role !== 'super_admin' && (await countActiveSuperAdmins()) <= 1) {
    const error = new Error('至少保留一个超级管理员账号')
    error.code = 'LAST_SUPER_ADMIN'
    throw error
  }

  if (existing.role === 'super_admin' && status === 'disabled' && (await countActiveSuperAdmins()) <= 1) {
    const error = new Error('至少保留一个超级管理员账号')
    error.code = 'LAST_SUPER_ADMIN'
    throw error
  }

  const payload = {
    updated_at: new Date().toISOString()
  }

  if (role) {
    payload.role = role
  }

  if (status) {
    payload.status = status
  }

  if (password && (await hasAdminPasswordColumn())) {
    payload.password_hash = hashPassword(password)
    payload.password_updated_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('admin_users')
    .update(payload)
    .eq('id', id)
    .select('id, username, role, status, last_login, created_at')
    .single()

  if (error) {
    throw error
  }

  return data
}

const deleteAdmin = async id => {
  const { data: existing, error: existingError } = await supabase
    .from('admin_users')
    .select('id, role')
    .eq('id', id)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  if (!existing) {
    const error = new Error('账号不存在')
    error.code = 'ADMIN_NOT_FOUND'
    throw error
  }

  if (existing.role === 'super_admin' && (await countActiveSuperAdmins()) <= 1) {
    const error = new Error('至少保留一个超级管理员账号')
    error.code = 'LAST_SUPER_ADMIN'
    throw error
  }

  const { error } = await supabase.from('admin_users').delete().eq('id', id)

  if (error) {
    throw error
  }
}

const touchAdminLogin = async adminId => {
  if (!(await hasAdminUsersTable())) {
    return
  }

  const { error } = await supabase
    .from('admin_users')
    .update({
      last_login: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', adminId)

  if (error) {
    throw error
  }
}

const writeAdminLog = async ({ adminId, action, targetType = '', targetId = '', detail = {}, ip = null }) => {
  if (!(await hasAdminLogTable())) {
    return
  }

  const { error } = await supabase.from('admin_log').insert({
    admin_id: adminId,
    action,
    target_type: targetType || null,
    target_id: targetId || null,
    detail,
    ip
  })

  if (error) {
    throw error
  }
}

const ensureBootstrapAdmin = async () => {
  if (!(await hasAdminUsersTable())) {
    return {
      mode: 'fallback',
      admin: getBootstrapAdmin()
    }
  }

  const fallbackAdmin = getBootstrapAdmin()
  const candidateId =
    fallbackAdmin.id === '00000000-0000-0000-0000-000000000001'
      ? crypto.randomUUID()
      : fallbackAdmin.id

  const payload = {
    id: candidateId,
    email: buildInternalAdminEmail(fallbackAdmin.username),
    username: fallbackAdmin.username,
    role: fallbackAdmin.role,
    status: 'active',
    updated_at: new Date().toISOString()
  }

  if (await hasAdminPasswordColumn()) {
    payload.password_hash = hashPassword(fallbackAdmin.password)
    payload.password_updated_at = new Date().toISOString()
  }

  const { data: existing, error: queryError } = await supabase
    .from('admin_users')
    .select('*')
    .eq('username', fallbackAdmin.username)
    .maybeSingle()

  if (queryError) {
    throw queryError
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({
        email: payload.email,
        role: payload.role,
        status: payload.status,
        updated_at: payload.updated_at,
        ...(payload.password_hash
          ? {
              password_hash: payload.password_hash,
              password_updated_at: payload.password_updated_at
            }
          : {})
      })
      .eq('id', existing.id)

    if (updateError) {
      throw updateError
    }

    return {
      mode: 'updated',
      admin: {
        ...fallbackAdmin,
        id: existing.id
      }
    }
  }

  const { error: insertError } = await supabase.from('admin_users').insert({
    ...payload,
    created_at: new Date().toISOString()
  })

  if (insertError) {
    throw insertError
  }

  return {
    mode: 'created',
    admin: {
      ...fallbackAdmin,
      id: candidateId
    }
  }
}

module.exports = {
  getBootstrapAdmin,
  hasAdminUsersTable,
  hasAdminLogTable,
  hasAdminPasswordColumn,
  hashPassword,
  verifyPassword,
  listAdmins,
  findAdminByUsername,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  touchAdminLogin,
  writeAdminLog,
  ensureBootstrapAdmin
}
