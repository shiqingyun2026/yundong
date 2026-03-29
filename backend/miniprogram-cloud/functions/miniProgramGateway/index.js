const { normalizeCloudRequest } = require('../../adapters/requestContext')
const { ok, fail } = require('../../adapters/responses')
const { resolveRoute } = require('../../app/routeRegistry')

exports.main = async (event = {}, context = {}) => {
  const request = normalizeCloudRequest(event, context)
  const route = resolveRoute(request)

  if (!route) {
    const error = new Error(`未找到云函数路由: ${request.method} ${request.path}`)
    error.statusCode = 404
    error.code = 'MINIPROGRAM_CLOUD_ROUTE_NOT_FOUND'
    return fail(error)
  }

  try {
    const result = await route.handler({
      ...request,
      params: route.params,
      route
    })

    return ok(result)
  } catch (error) {
    console.error('[miniProgramGateway] request failed', {
      method: request.method,
      path: request.path,
      params: route.params,
      error
    })

    return fail(error)
  }
}
