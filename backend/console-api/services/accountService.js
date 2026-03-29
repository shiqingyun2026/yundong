const { formatDateTime, getPagination } = require('../routes/_helpers')
const { createConsoleApiError } = require('./_errors')
const { ensureCondition, ensureFeatureEnabled } = require('./_guards')
const {
  createAdmin,
  deleteAdmin,
  hasAdminPasswordColumn,
  hasAdminUsersTable,
  listAdmins,
  updateAdmin,
  writeAdminLog
} = require('../../utils/adminStore')

const listAccountPage = async ({ query = {} }) => {
  const { page, size } = getPagination(query)
  const keyword = `${query.keyword || ''}`.trim()
  const role = `${query.role || ''}`.trim()
  const status = `${query.status || ''}`.trim()

  const result = await listAdmins({
    keyword,
    role,
    status,
    from: (page - 1) * size,
    to: page * size - 1
  })

  return {
    total: result.total,
    page,
    size,
    total_pages: Math.max(1, Math.ceil(result.total / size)),
    list: result.list.map(item => ({
      id: item.id,
      username: item.username,
      role: item.role,
      status: item.status || 'active',
      last_login_time: formatDateTime(item.last_login),
      create_time: formatDateTime(item.created_at)
    }))
  }
}

const createAccount = async ({ actorAdmin, ip = null, payload = {} }) => {
  await ensureFeatureEnabled(hasAdminUsersTable, '当前数据库未启用 admin_users，暂不支持创建管理员账号')
  await ensureFeatureEnabled(hasAdminPasswordColumn, '请先执行最新 admin_users 密码迁移脚本，再创建账号')

  const { username, password, role } = payload

  ensureCondition(!!username && !!password && !!role, {
    responseCode: 4001,
    statusCode: 400,
    message: '用户名、密码、角色不能为空'
  })
  ensureCondition(password.length >= 6, {
    responseCode: 4001,
    statusCode: 400,
    message: '密码至少 6 位'
  })

  try {
    const admin = await createAdmin({ username, password, role })
    await writeAdminLog({
      adminId: actorAdmin.id,
      action: 'account_create',
      targetType: 'admin_user',
      targetId: admin.id,
      detail: { username: admin.username, role: admin.role },
      ip
    })

    return { id: admin.id }
  } catch (error) {
    if (error.code === 'ADMIN_EXISTS') {
      throw createConsoleApiError({
        responseCode: 4001,
        statusCode: 400,
        message: error.message
      })
    }

    throw error
  }
}

const updateAccountById = async ({ accountId, actorAdmin, ip = null, payload = {} }) => {
  await ensureFeatureEnabled(hasAdminUsersTable, '当前数据库未启用 admin_users，暂不支持编辑管理员账号')

  const { password, role, status } = payload

  ensureCondition(!!password || !!role || !!status, {
    responseCode: 4001,
    statusCode: 400,
    message: '至少提供一项修改内容'
  })
  ensureCondition(!password || password.length >= 6, {
    responseCode: 4001,
    statusCode: 400,
    message: '密码至少 6 位'
  })

  try {
    const admin = await updateAdmin(accountId, { password, role, status })
    await writeAdminLog({
      adminId: actorAdmin.id,
      action: 'account_update',
      targetType: 'admin_user',
      targetId: admin.id,
      detail: { role: admin.role, status: admin.status },
      ip
    })

    return { id: admin.id }
  } catch (error) {
    if (error.code === 'ADMIN_NOT_FOUND') {
      throw createConsoleApiError({
        responseCode: 4001,
        statusCode: 404,
        message: error.message
      })
    }

    if (error.code === 'LAST_SUPER_ADMIN') {
      throw createConsoleApiError({
        responseCode: 4002,
        statusCode: 400,
        message: error.message
      })
    }

    throw error
  }
}

const deleteAccountById = async ({ accountId, actorAdmin, ip = null }) => {
  await ensureFeatureEnabled(hasAdminUsersTable, '当前数据库未启用 admin_users，暂不支持删除管理员账号')

  try {
    await deleteAdmin(accountId)
    await writeAdminLog({
      adminId: actorAdmin.id,
      action: 'account_delete',
      targetType: 'admin_user',
      targetId: accountId,
      detail: {},
      ip
    })

    return { id: accountId }
  } catch (error) {
    if (error.code === 'ADMIN_NOT_FOUND') {
      throw createConsoleApiError({
        responseCode: 4001,
        statusCode: 404,
        message: error.message
      })
    }

    if (error.code === 'LAST_SUPER_ADMIN') {
      throw createConsoleApiError({
        responseCode: 4002,
        statusCode: 400,
        message: error.message
      })
    }

    throw error
  }
}

module.exports = {
  createAccount,
  deleteAccountById,
  listAccountPage,
  updateAccountById
}
