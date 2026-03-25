const jwt = require('jsonwebtoken')

const adminAuthenticate = (req, res, next) => {
  const authorization = req.headers.authorization || ''
  const [scheme, token] = authorization.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      code: 1002,
      message: 'token无效或过期'
    })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    if (!payload || payload.type !== 'admin' || !payload.adminId) {
      return res.status(401).json({
        code: 1002,
        message: 'token无效或过期'
      })
    }

    req.admin = {
      id: payload.adminId,
      username: payload.username || '',
      role: payload.role || 'admin'
    }
    next()
  } catch (error) {
    return res.status(401).json({
      code: 1002,
      message: 'token无效或过期'
    })
  }
}

const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || req.admin.role !== 'super_admin') {
    return res.status(403).json({
      code: 1003,
      message: '无权限操作'
    })
  }

  next()
}

module.exports = {
  adminAuthenticate,
  requireSuperAdmin
}
