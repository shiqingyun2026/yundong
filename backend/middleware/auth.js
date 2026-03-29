const jwt = require('jsonwebtoken')

const authenticate = (req, res, next) => {
  const authorization = req.headers.authorization || ''
  const [scheme, token] = authorization.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      message: 'Unauthorized'
    })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    if (!payload || !payload.userId) {
      return res.status(401).json({
        message: 'Unauthorized'
      })
    }

    req.userId = payload.userId
    return next()
  } catch (error) {
    return res.status(401).json({
      message: 'Unauthorized'
    })
  }
}

module.exports = authenticate
