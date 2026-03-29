const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const backendRoot = path.resolve(__dirname, '..')

const mockModule = (relativePath, exports) => {
  const modulePath = require.resolve(path.join(backendRoot, relativePath))
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

mockModule('miniprogram-cloud/app/handlers/courses.js', {
  handleCourseList: async request => ({
    path: request.path,
    method: request.method,
    page: request.data.page || 1
  }),
  handleCourseDetail: async request => ({
    courseId: request.params.id
  }),
  handleCourseActiveGroup: async request => ({
    courseId: request.params.id,
    authToken: request.authToken
  })
})

mockModule('miniprogram-cloud/app/handlers/auth.js', {
  handleLogin: async request => ({
    code: request.data.code || '',
    openId: request.userContext.openId
  })
})

mockModule('miniprogram-cloud/app/handlers/groups.js', {
  handleGroupDetail: async request => {
    const error = new Error('需要登录')
    error.statusCode = 401
    error.code = 'MINIPROGRAM_CLOUD_UNAUTHORIZED'
    error.detail = { groupId: request.params.id }
    throw error
  },
  handleUserGroupList: async request => ({
    status: request.data.status || ''
  })
})

mockModule('miniprogram-cloud/app/handlers/orders.js', {
  handleCreateOrder: async request => ({
    courseId: request.data.courseId,
    authToken: request.authToken
  }),
  handleMockPaymentSuccess: async request => ({
    orderId: request.data.orderId
  })
})

const routeRegistryPath = require.resolve(path.join(backendRoot, 'miniprogram-cloud/app/routeRegistry.js'))
const gatewayPath = require.resolve(
  path.join(backendRoot, 'miniprogram-cloud/functions/miniProgramGateway/index.js')
)

delete require.cache[routeRegistryPath]
delete require.cache[gatewayPath]

const gateway = require(gatewayPath)

test('miniprogram cloud smoke: gateway routes course list requests through the cloud adapter', async () => {
  const result = await gateway.main({
    path: '/api/courses',
    method: 'get',
    data: { page: 2 }
  })

  assert.deepEqual(result, {
    code: 0,
    data: {
      path: '/api/courses',
      method: 'GET',
      page: 2
    }
  })
})

test('miniprogram cloud smoke: gateway forwards context and params for auth and nested routes', async () => {
  const loginResult = await gateway.main(
    {
      path: '/api/auth/login',
      method: 'POST',
      data: { code: 'mock-login-code' }
    },
    {
      OPENID: 'seed0326_u02'
    }
  )

  assert.deepEqual(loginResult, {
    code: 0,
    data: {
      code: 'mock-login-code',
      openId: 'seed0326_u02'
    }
  })

  const detailResult = await gateway.main({
    path: '/api/courses/course-1',
    method: 'GET'
  })

  assert.deepEqual(detailResult, {
    code: 0,
    data: {
      courseId: 'course-1'
    }
  })
})

test('miniprogram cloud smoke: gateway returns a stable 404 envelope for unknown routes', async () => {
  const result = await gateway.main({
    path: '/api/unknown',
    method: 'GET'
  })

  assert.equal(result.code, 404)
  assert.equal(result.errorCode, 'MINIPROGRAM_CLOUD_ROUTE_NOT_FOUND')
  assert.match(result.message, /未找到云函数路由/)
})

test('miniprogram cloud smoke: gateway keeps service error status and code in the fail envelope', async () => {
  const result = await gateway.main({
    path: '/api/groups/group-1',
    method: 'GET'
  })

  assert.deepEqual(result, {
    code: 401,
    message: '需要登录',
    errorCode: 'MINIPROGRAM_CLOUD_UNAUTHORIZED'
  })
})
