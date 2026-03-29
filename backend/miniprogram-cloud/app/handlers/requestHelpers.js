const { createUnauthorizedError, resolveUserIdFromAuthorization } = require('../../../shared/utils/auth')

const readQueryValue = (request, key) => {
  if (request && request.data && Object.prototype.hasOwnProperty.call(request.data, key)) {
    return request.data[key]
  }

  return undefined
}

const resolveAuthorization = request => {
  const headerAuthorization =
    (request && request.headers && (request.headers.Authorization || request.headers.authorization)) || ''

  if (headerAuthorization) {
    return headerAuthorization
  }

  if (request && request.authToken) {
    return `Bearer ${request.authToken}`
  }

  return ''
}

const requireUserId = request => {
  const userId = resolveUserIdFromAuthorization(resolveAuthorization(request))

  if (!userId) {
    throw createUnauthorizedError()
  }

  return userId
}

module.exports = {
  readQueryValue,
  requireUserId,
  resolveAuthorization
}
