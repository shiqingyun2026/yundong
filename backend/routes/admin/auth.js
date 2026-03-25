const express = require('express')
const jwt = require('jsonwebtoken')

const { ok, fail } = require('./_helpers')
const {
  findAdminByUsername,
  hasAdminPasswordColumn,
  touchAdminLogin,
  verifyPassword,
  writeAdminLog
} = require('../../utils/adminStore')

const router = express.Router()

router.post('/', async (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    return fail(res, 1001, '用户名或密码错误')
  }

  try {
    const admin = await findAdminByUsername(username)

    const usePasswordHash = !!admin && (await hasAdminPasswordColumn()) && !!admin.password_hash
    const isPasswordValid = usePasswordHash ? verifyPassword(password, admin.password_hash) : !!admin && password === admin.password

    if (!admin || admin.status === 'disabled' || !isPasswordValid) {
      return fail(res, 1001, '用户名或密码错误')
    }

    const token = jwt.sign(
      {
        type: 'admin',
        adminId: admin.id,
        username: admin.username,
        role: admin.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    await touchAdminLogin(admin.id)
    await writeAdminLog({
      adminId: admin.id,
      action: 'admin_login',
      targetType: 'admin_user',
      targetId: admin.id,
      detail: { username: admin.username },
      ip: req.ip || null
    })

    return ok(res, {
      token,
      user: {
        id: admin.id,
        username: admin.username,
        role: admin.role
      }
    })
  } catch (error) {
    return fail(res, 5000, error.message || '登录失败', 500)
  }
})

module.exports = router
