const normalizeHeaders = header => {
  if (!header || typeof header !== 'object') {
    return {}
  }

  return header
}

const normalizeMethod = method => {
  if (!method) {
    return 'GET'
  }

  return `${method}`.toUpperCase()
}

const normalizePath = path => {
  if (!path) {
    return '/'
  }

  return `${path}`.startsWith('/') ? `${path}` : `/${path}`
}

const normalizeCloudRequest = (event = {}, context = {}) => {
  const headers = normalizeHeaders(event.header)

  return {
    method: normalizeMethod(event.method),
    path: normalizePath(event.path),
    data: event.data || {},
    headers,
    authToken: event.authToken || headers.Authorization || headers.authorization || '',
    userContext: {
      openId: context.OPENID || '',
      appId: context.APPID || '',
      unionId: context.UNIONID || ''
    },
    rawEvent: event,
    rawContext: context
  }
}

module.exports = {
  normalizeCloudRequest
}
