const jwt = require('jsonwebtoken')

const resolveBearerToken = authorization => {
  const value = `${authorization || ''}`.trim()
  const [scheme, token] = value.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return ''
  }

  return token
}

const resolveUserIdFromToken = token => {
  if (!token || !process.env.JWT_SECRET) {
    return ''
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    return (payload && payload.userId) || ''
  } catch (error) {
    return ''
  }
}

const resolveUserIdFromAuthorization = authorization => {
  return resolveUserIdFromToken(resolveBearerToken(authorization))
}

const createUnauthorizedError = (message = 'Unauthorized') => {
  const error = new Error(message)
  error.statusCode = 401
  error.code = 401
  return error
}

module.exports = {
  createUnauthorizedError,
  resolveBearerToken,
  resolveUserIdFromAuthorization,
  resolveUserIdFromToken
}
