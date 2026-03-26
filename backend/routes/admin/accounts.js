const express = require('express')

const { requireSuperAdmin } = require('../../middleware/adminAuth')
const { ok, fail, getPagination, formatDateTime } = require('./_helpers')
const {
  createAdmin,
  deleteAdmin,
  hasAdminPasswordColumn,
  hasAdminUsersTable,
  listAdmins,
  updateAdmin,
  writeAdminLog
} = require('../../utils/adminStore')

const router = express.Router()

router.get('/', requireSuperAdmin, async (req, res) => {
  const { page, size } = getPagination(req.query || {})
  const keyword = `${req.query.keyword || ''}`.trim()

  try {
    const result = await listAdmins({
      keyword,
      from: (page - 1) * size,
      to: page * size - 1
    })

    return ok(res, {
      total: result.total,
      list: result.list.map(item => ({
        id: item.id,
        username: item.username,
        role: item.role,
        status: item.status || 'active',
        last_login_time: formatDateTime(item.last_login),
        create_time: formatDateTime(item.created_at)
      }))
    })
  } catch (error) {
    return fail(res, 5000, error.message || '获取账号列表失败', 500)
  }
})

router.post('/', requireSuperAdmin, async (req, res) => {
  if (!(await hasAdminUsersTable())) {
    return fail(res, 5000, '当前数据库未启用 admin_users，暂不支持创建管理员账号', 501)
  }

  if (!(await hasAdminPasswordColumn())) {
    return fail(res, 5000, '请先执行最新 admin_users 密码迁移脚本，再创建账号', 501)
  }

  const { username, password, role } = req.body || {}

  if (!username || !password || !role) {
    return fail(res, 4001, '用户名、密码、角色不能为空')
  }

  if (password.length < 6) {
    return fail(res, 4001, '密码至少 6 位')
  }

  try {
    const admin = await createAdmin({ username, password, role })
    await writeAdminLog({
      adminId: req.admin.id,
      action: 'account_create',
      targetType: 'admin_user',
      targetId: admin.id,
      detail: { username: admin.username, role: admin.role },
      ip: req.ip || null
    })

    return ok(res, { id: admin.id })
  } catch (error) {
    if (error.code === 'ADMIN_EXISTS') {
      return fail(res, 4001, error.message)
    }

    return fail(res, 5000, error.message || '创建账号失败', 500)
  }
})

router.put('/:id', requireSuperAdmin, async (req, res) => {
  if (!(await hasAdminUsersTable())) {
    return fail(res, 5000, '当前数据库未启用 admin_users，暂不支持编辑管理员账号', 501)
  }

  const { password, role, status } = req.body || {}

  if (!password && !role && !status) {
    return fail(res, 4001, '至少提供一项修改内容')
  }

  if (password && password.length < 6) {
    return fail(res, 4001, '密码至少 6 位')
  }

  try {
    const admin = await updateAdmin(req.params.id, { password, role, status })
    await writeAdminLog({
      adminId: req.admin.id,
      action: 'account_update',
      targetType: 'admin_user',
      targetId: admin.id,
      detail: { role: admin.role, status: admin.status },
      ip: req.ip || null
    })

    return ok(res, { id: admin.id })
  } catch (error) {
    if (error.code === 'ADMIN_NOT_FOUND') {
      return fail(res, 4001, error.message, 404)
    }

    if (error.code === 'LAST_SUPER_ADMIN') {
      return fail(res, 4002, error.message)
    }

    return fail(res, 5000, error.message || '更新账号失败', 500)
  }
})

router.delete('/:id', requireSuperAdmin, async (req, res) => {
  if (!(await hasAdminUsersTable())) {
    return fail(res, 5000, '当前数据库未启用 admin_users，暂不支持删除管理员账号', 501)
  }

  try {
    await deleteAdmin(req.params.id)
    await writeAdminLog({
      adminId: req.admin.id,
      action: 'account_delete',
      targetType: 'admin_user',
      targetId: req.params.id,
      detail: {},
      ip: req.ip || null
    })

    return ok(res, { id: req.params.id })
  } catch (error) {
    if (error.code === 'ADMIN_NOT_FOUND') {
      return fail(res, 4001, error.message, 404)
    }

    if (error.code === 'LAST_SUPER_ADMIN') {
      return fail(res, 4002, error.message)
    }

    return fail(res, 5000, error.message || '删除账号失败', 500)
  }
})

module.exports = router
