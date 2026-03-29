const buildRouteKey = ({ method, path }) => `${method} ${path}`
const {
  handleCourseActiveGroup,
  handleCourseDetail,
  handleCourseList
} = require('./handlers/courses')
const { handleLogin } = require('./handlers/auth')
const { handleGroupDetail, handleUserGroupList } = require('./handlers/groups')
const { handleCreateOrder, handleMockPaymentSuccess } = require('./handlers/orders')

const createTodoHandler = capability => async request => {
  const error = new Error(`云函数接入层尚未实现 ${capability}`)
  error.statusCode = 501
  error.code = 'MINIPROGRAM_CLOUD_TODO'
  error.details = {
    capability,
    method: request.method,
    path: request.path
  }
  throw error
}

const plannedRoutes = [
  {
    method: 'GET',
    path: '/api/courses',
    capability: 'course.list',
    sourceRoute: 'backend/routes/courses.js',
    handler: handleCourseList
  },
  {
    method: 'GET',
    path: '/api/courses/:id',
    capability: 'course.detail',
    sourceRoute: 'backend/routes/courses.js',
    handler: handleCourseDetail
  },
  {
    method: 'GET',
    path: '/api/courses/:id/active-group',
    capability: 'course.activeGroup',
    sourceRoute: 'backend/routes/courses.js',
    handler: handleCourseActiveGroup
  },
  {
    method: 'GET',
    path: '/api/groups/:id',
    capability: 'group.detail',
    sourceRoute: 'backend/routes/groups.js',
    handler: handleGroupDetail
  },
  {
    method: 'GET',
    path: '/api/user/groups',
    capability: 'user.groupList',
    sourceRoute: 'backend/routes/user.js',
    handler: handleUserGroupList
  },
  {
    method: 'POST',
    path: '/api/auth/login',
    capability: 'auth.login',
    sourceRoute: 'backend/routes/auth.js',
    handler: handleLogin
  },
  {
    method: 'POST',
    path: '/api/orders',
    capability: 'order.create',
    sourceRoute: 'backend/routes/orders.js',
    handler: handleCreateOrder
  },
  {
    method: 'POST',
    path: '/api/payments/mock-success',
    capability: 'payment.mockSuccess',
    sourceRoute: 'backend/routes/payments.js',
    handler: handleMockPaymentSuccess
  }
]

const normalizeSegments = path =>
  `${path}`
    .split('/')
    .filter(Boolean)

const matchPath = (pattern, actualPath) => {
  const patternSegments = normalizeSegments(pattern)
  const actualSegments = normalizeSegments(actualPath)

  if (patternSegments.length !== actualSegments.length) {
    return null
  }

  const params = {}

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index]
    const actualSegment = actualSegments[index]

    if (patternSegment.startsWith(':')) {
      params[patternSegment.slice(1)] = actualSegment
      continue
    }

    if (patternSegment !== actualSegment) {
      return null
    }
  }

  return params
}

const routeRegistry = plannedRoutes.map(route => ({
  ...route,
  handler: route.handler || createTodoHandler(route.capability)
}))

const resolveRoute = request => {
  for (const route of routeRegistry) {
    if (route.method !== request.method) {
      continue
    }

    const params = matchPath(route.path, request.path)
    if (!params) {
      continue
    }

    return {
      ...route,
      params
    }
  }

  return null
}

module.exports = {
  buildRouteKey,
  plannedRoutes,
  resolveRoute
}
