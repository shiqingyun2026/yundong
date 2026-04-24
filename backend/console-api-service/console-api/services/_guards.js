const { createConsoleApiError } = require('./_errors')

const ensureCondition = (condition, { responseCode = 4001, statusCode = 400, message = '参数错误', extra = {}, code = '' }) => {
  if (condition) {
    return
  }

  throw createConsoleApiError({
    responseCode,
    statusCode,
    message,
    extra,
    code
  })
}

const ensureFeatureEnabled = async (checker, message) => {
  const enabled = await checker()

  ensureCondition(enabled, {
    responseCode: 5000,
    statusCode: 501,
    message
  })
}

const ensureFound = (value, { responseCode = 2001, message = '资源不存在', code = '' }) => {
  ensureCondition(!!value, {
    responseCode,
    statusCode: 404,
    message,
    code
  })

  return value
}

module.exports = {
  ensureCondition,
  ensureFeatureEnabled,
  ensureFound
}
