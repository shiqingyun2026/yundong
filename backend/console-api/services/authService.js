const jwt = require('jsonwebtoken')

const { ensureCondition } = require('./_guards')
const {
  findAdminByUsername,
  hasAdminPasswordColumn,
  touchAdminLogin,
  verifyPassword,
  writeAdminLog
} = require('../../utils/adminStore')

const assertValidCredentials = condition =>
  ensureCondition(condition, {
    responseCode: 1001,
    statusCode: 400,
    message: '用户名或密码错误'
  })

const loginAdmin = async ({ username, password, ip = null }) => {
  assertValidCredentials(!!username && !!password)

  const admin = await findAdminByUsername(username)
  const usePasswordHash = !!admin && (await hasAdminPasswordColumn()) && !!admin.password_hash
  const isPasswordValid = usePasswordHash ? verifyPassword(password, admin.password_hash) : !!admin && password === admin.password

  assertValidCredentials(!!admin && admin.status !== 'disabled' && isPasswordValid)

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
    ip
  })

  return {
    token,
    user: {
      id: admin.id,
      username: admin.username,
      role: admin.role
    }
  }
}

module.exports = {
  loginAdmin
}
