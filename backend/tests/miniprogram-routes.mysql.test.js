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

const loadAppForMySqlRoutes = () => {
  const targets = [
    'app.js',
    'config/env.js',
    'utils/getSupabaseClient.js',
    'middleware/auth.js',
    'repositories/index.js',
    'repositories/usersRepository.js',
    'shared/utils/miniProgramIdentity.js',
    'shared/utils/wechatIdentity.js',
    'shared/services/miniProgramAuth.js',
    'shared/services/courseReaders.js',
    'shared/services/groupReaders.js',
    'shared/services/groupOrders.js',
    'shared/services/packageReaders.js',
    'shared/services/packageOrders.js',
    'shared/services/paymentShell.js',
    'shared/services/wechatMiniProgram.js',
    'shared/services/wechatMiniProgramNotifications.js',
    'shared/services/groupResultNotificationDelivery.js',
    'shared/services/groupResultNotifications.js',
    'utils/courseLifecycle.js',
    'routes/auth.js',
    'routes/courses.js',
    'routes/packages.js',
    'routes/groups.js',
    'routes/package-groups.js',
    'routes/orders.js',
    'routes/package-orders.js',
    'routes/payments.js',
    'routes/user.js'
  ].map(relativePath => require.resolve(path.join(backendRoot, relativePath)))

  targets.forEach(modulePath => {
    delete require.cache[modulePath]
  })

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true,
      trustCloudBaseMiniProgramIdentity: true,
      enableMiniProgramIdentityLogs: false
    }
  })

  mockModule('utils/getSupabaseClient.js', {
    getSupabaseClient: () => {
      throw new Error('supabase should not be requested in mysql mode')
    }
  })

  mockModule('repositories/usersRepository.js', {
    findUserByOpenId: async openId => {
      if (openId === 'wx-openid-1') {
        return {
          id: 'user-from-cloudbase',
          openid: openId
        }
      }

      return null
    }
  })

  mockModule('repositories/index.js', {
    groupResultSubscriptionsRepository: {
      upsertSubscription: async payload => payload
    },
    ordersRepository: {
      findOrderForUser: async ({ orderId }) => {
        if (orderId === 'package-order-start-1' || orderId === 'package-order-join-1') {
          return {
            id: orderId,
            user_id: 'user-from-cloudbase',
            order_type: 2,
            package_id: 'package-1'
          }
        }

        return {
          id: orderId,
          user_id: 'user-from-cloudbase',
          order_type: 1,
          course_id: 'course-1',
          group_id: 'group-1'
        }
      }
    }
  })

  mockModule('shared/services/miniProgramAuth.js', {
    loginMiniProgramUser: async ({ supabase, code, openId, unionId, appId }) => ({
      supabaseWasPassed: supabase,
      code,
      openId,
      unionId,
      appId
    })
  })

  mockModule('shared/services/courseReaders.js', {
    fetchMiniProgramCourseList: async ({ supabase }) => ({
      source: 'mysql',
      supabaseWasPassed: supabase
    }),
    fetchMiniProgramCourseDetail: async ({ supabase, courseId }) => ({
      id: courseId,
      supabaseWasPassed: supabase
    }),
    fetchMiniProgramCourseActiveGroup: async ({ supabase, courseId, userId }) => ({
      courseId,
      userId,
      supabaseWasPassed: supabase
    })
  })

  mockModule('shared/services/groupReaders.js', {
    fetchMiniProgramGroupDetail: async ({ supabase, groupId, userId }) => ({
      id: groupId,
      userId,
      supabaseWasPassed: supabase
    }),
    fetchMiniProgramUserGroupList: async ({ supabase, userId }) => ({
      list: [],
      userId,
      supabaseWasPassed: supabase
    })
  })

  mockModule('shared/services/groupOrders.js', {
    createPendingOrder: async ({ supabase, courseId, userId }) => ({
      group: { id: 'group-1', status: 'active' },
      order: {
        id: 'order-1',
        course_id: courseId,
        group_id: 'group-1',
        amount: 99
      },
      userId,
      supabaseWasPassed: supabase
    }),
    markOrderPaymentSuccess: async ({ supabase, orderId, groupId, userId }) => ({
      order: {
        id: orderId,
        course_id: 'course-1'
      },
      userId,
      groupId: groupId || 'group-1',
      currentCount: 1,
      targetCount: 2,
      groupStatus: 'active',
      supabaseWasPassed: supabase
    }),
    isServiceError: error => !!error && Number.isInteger(error.status)
  })

  mockModule('shared/services/packageReaders.js', {
    fetchMiniProgramPackageList: async ({ supabase }) => ({
      list: [
        {
          id: 'package-1'
        }
      ],
      supabaseWasPassed: supabase
    }),
    fetchMiniProgramPackageDetail: async ({ supabase, packageId }) => ({
      id: packageId,
      supabaseWasPassed: supabase
    }),
    fetchMiniProgramPackageGroupDetail: async ({ supabase, packageGroupId, userId }) => ({
      id: packageGroupId,
      userId,
      supabaseWasPassed: supabase
    }),
    fetchMiniProgramUserPackageGroupList: async ({ supabase, userId }) => ({
      list: [],
      userId,
      supabaseWasPassed: supabase
    }),
    formatFenText: amount => (Number(amount || 0) / 100).toFixed(2)
  })

  mockModule('shared/services/packageOrders.js', {
    createPackageStartOrder: async ({ supabase, packageId, targetCount, weekday, hour, childNickname, childAge, userId }) => ({
      order: {
        id: 'package-order-start-1',
        order_no: 'PKG-ORDER-START-1',
        order_type: 2,
        package_action: 'start',
        package_id: packageId,
        status: 'pending'
      },
      memberAmountFen: 33333,
      childNickname,
      childAge: Number(childAge),
      targetCount,
      weekday,
      hour,
      userId,
      supabaseWasPassed: supabase
    }),
    createPackageJoinOrder: async ({ supabase, packageId, packageGroupId, userId }) => ({
      order: {
        id: 'package-order-join-1',
        order_no: 'PKG-ORDER-JOIN-1',
        order_type: 2,
        package_action: 'join',
        package_id: packageId,
        package_group_id: packageGroupId,
        status: 'pending'
      },
      memberAmountFen: 33333,
      userId,
      supabaseWasPassed: supabase
    }),
    markPackageOrderPaymentSuccess: async ({ supabase, orderId, userId }) => ({
      order: {
        id: orderId,
        package_id: 'package-1'
      },
      status: 'success',
      packageGroupId: 'package-group-1',
      groupStatus: 'active',
      userId,
      supabaseWasPassed: supabase
    }),
    isPackageServiceError: error => !!error && Number.isInteger(error.status) && Number.isInteger(error.code)
  })

  mockModule('shared/services/paymentShell.js', {
    getOrderPaymentStatus: async ({ supabase, orderId, userId }) => ({
      orderId,
      userId,
      supabaseWasPassed: supabase
    }),
    prepareOrderPayment: async ({ supabase, orderId, userId }) => ({
      orderId,
      userId,
      supabaseWasPassed: supabase
    }),
    handleWechatPaymentCallback: async ({ supabase, payload }) => ({
      payload,
      supabaseWasPassed: supabase
    }),
    markPaymentRecordPaid: async ({ supabase, orderId }) => ({
      orderId,
      supabaseWasPassed: supabase
    })
  })

  mockModule('shared/services/wechatMiniProgram.js', {
    verifyWechatPayCallbackSignature: () => true
  })

  mockModule('shared/services/groupResultNotifications.js', {
    enqueueGroupResultNotifications: async () => ({}),
    enqueueNotificationsForGroups: async () => []
  })

  mockModule('shared/services/groupResultNotificationDelivery.js', {
    processPendingGroupResultNotificationJobs: async () => ({})
  })

  mockModule('utils/courseLifecycle.js', {
    COURSE_STATUS: {
      PENDING_PUBLISH: 0,
      GROUPING: 1,
      GROUP_FAILED: 2,
      WAITING_CLASS: 3,
      IN_CLASS: 4,
      FINISHED: 5,
      UNPUBLISHED: 6
    },
    syncAllCourseLifecycles: async () => ({}),
    getSingleCourseLifecycle: async () => ({ status: 1 }),
    getCourseLifecycleMap: async () => ({})
  })

  const app = require(path.join(backendRoot, 'app.js'))
  return app
}

const requestJson = async ({ app, method = 'GET', pathname, body, headers = {} }) => {
  const requestHeaders = new Headers(headers)

  if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  const response = await app.fetch(
    new Request(`http://127.0.0.1${pathname}`, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  )

  return {
    status: response.status,
    body: await response.json()
  }
}

test('mini program routes work in mysql mode without supabase client', async () => {
  const app = loadAppForMySqlRoutes()

  const [
    login,
    courses,
    courseDetail,
    packages,
    packageDetail,
    activeGroup,
    groupDetail,
    packageGroupDetail,
    createOrder,
    createPackageStartOrder,
    createPackageJoinOrder,
    orderStatus,
    userGroups,
    userPackageGroups,
    paymentPrepare
  ] =
    await Promise.all([
      requestJson({
        app,
        method: 'POST',
        pathname: '/api/auth/login',
        body: { code: 'mock-code' }
      }),
      requestJson({
        app,
        pathname: '/api/courses'
      }),
      requestJson({
        app,
        pathname: '/api/courses/course-1'
      }),
      requestJson({
        app,
        pathname: '/api/packages'
      }),
      requestJson({
        app,
        pathname: '/api/packages/package-1'
      }),
      requestJson({
        app,
        pathname: '/api/courses/course-1/active-group'
      }),
      requestJson({
        app,
        pathname: '/api/groups/group-1',
        headers: { 'x-wx-openid': 'wx-openid-1', 'x-wx-service': 'lindong-api' }
      }),
      requestJson({
        app,
        pathname: '/api/package-groups/package-group-1',
        headers: { 'x-wx-openid': 'wx-openid-1', 'x-wx-service': 'lindong-api' }
      }),
      requestJson({
        app,
        method: 'POST',
        pathname: '/api/orders',
        headers: { 'x-wx-openid': 'wx-openid-1', 'x-wx-service': 'lindong-api' },
        body: { courseId: 'course-1' }
      }),
      requestJson({
        app,
        method: 'POST',
        pathname: '/api/package-orders/start',
        headers: { 'x-wx-openid': 'wx-openid-1', 'x-wx-service': 'lindong-api' },
        body: {
          packageId: 'package-1',
          targetCount: 4,
          weekday: 6,
          hour: 10,
          childNickname: '小满',
          childAge: 6
        }
      }),
      requestJson({
        app,
        method: 'POST',
        pathname: '/api/package-orders/join',
        headers: { 'x-wx-openid': 'wx-openid-1', 'x-wx-service': 'lindong-api' },
        body: { packageId: 'package-1', packageGroupId: 'package-group-1' }
      }),
      requestJson({
        app,
        pathname: '/api/orders/order-1',
        headers: { 'x-wx-openid': 'wx-openid-1', 'x-wx-service': 'lindong-api' }
      }),
      requestJson({
        app,
        pathname: '/api/user/groups',
        headers: { 'x-wx-openid': 'wx-openid-1', 'x-wx-service': 'lindong-api' }
      }),
      requestJson({
        app,
        pathname: '/api/user/package-groups',
        headers: { 'x-wx-openid': 'wx-openid-1', 'x-wx-service': 'lindong-api' }
      }),
      requestJson({
        app,
        method: 'POST',
        pathname: '/api/payments/prepare',
        headers: { 'x-wx-openid': 'wx-openid-1', 'x-wx-service': 'lindong-api' },
        body: { orderId: 'order-1' }
      })
    ])

  assert.equal(login.status, 200)
  assert.equal(login.body.supabaseWasPassed, null)

  assert.equal(courses.status, 200)
  assert.equal(courses.body.supabaseWasPassed, null)

  assert.equal(courseDetail.status, 200)
  assert.equal(courseDetail.body.supabaseWasPassed, null)

  assert.equal(packages.status, 200)
  assert.equal(packages.body.data.supabaseWasPassed, null)

  assert.equal(packageDetail.status, 200)
  assert.equal(packageDetail.body.data.supabaseWasPassed, null)

  assert.equal(activeGroup.status, 200)
  assert.equal(activeGroup.body.supabaseWasPassed, null)

  assert.equal(groupDetail.status, 200)
  assert.equal(groupDetail.body.supabaseWasPassed, null)

  assert.equal(packageGroupDetail.status, 200)
  assert.equal(packageGroupDetail.body.data.supabaseWasPassed, null)

  assert.equal(createOrder.status, 200)
  assert.equal(createOrder.body.orderId, 'order-1')

  assert.equal(createPackageStartOrder.status, 200)
  assert.equal(createPackageStartOrder.body.data.orderId, 'package-order-start-1')
  assert.equal(createPackageStartOrder.body.data.child_nickname, '小满')
  assert.equal(createPackageStartOrder.body.data.child_age, 6)

  assert.equal(createPackageJoinOrder.status, 200)
  assert.equal(createPackageJoinOrder.body.data.orderId, 'package-order-join-1')

  assert.equal(orderStatus.status, 200)
  assert.equal(orderStatus.body.supabaseWasPassed, null)

  assert.equal(userGroups.status, 200)
  assert.equal(userGroups.body.supabaseWasPassed, null)

  assert.equal(userPackageGroups.status, 200)
  assert.equal(userPackageGroups.body.data.supabaseWasPassed, null)

  assert.equal(paymentPrepare.status, 200)
  assert.equal(paymentPrepare.body.supabaseWasPassed, null)
})

test('mini program login accepts cloudbase identity headers in mysql mode', async () => {
  const app = loadAppForMySqlRoutes()

  const login = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/auth/login',
    headers: {
      'x-wx-openid': 'wx-openid-1',
      'x-wx-unionid': 'wx-unionid-1',
      'x-wx-appid': 'wx-appid-1',
      'x-wx-service': 'lindong-api'
    },
    body: {}
  })

  assert.equal(login.status, 200)
  assert.equal(login.body.supabaseWasPassed, null)
  assert.equal(login.body.openId, 'wx-openid-1')
  assert.equal(login.body.unionId, 'wx-unionid-1')
  assert.equal(login.body.appId, 'wx-appid-1')
})

test('course active group resolves optional user from cloudbase headers before bearer token', async () => {
  const app = loadAppForMySqlRoutes()

  const activeGroup = await requestJson({
    app,
    pathname: '/api/courses/course-1/active-group',
    headers: {
      'x-wx-openid': 'wx-openid-1',
      'x-wx-service': 'lindong-api',
      Authorization: 'Bearer token'
    }
  })

  assert.equal(activeGroup.status, 200)
  assert.equal(activeGroup.body.supabaseWasPassed, null)
  assert.equal(activeGroup.body.courseId, 'course-1')
  assert.equal(activeGroup.body.userId, 'user-from-cloudbase')
})

test('protected mini program routes accept trusted cloudbase identity without bearer token', async () => {
  const app = loadAppForMySqlRoutes()
  const cloudbaseHeaders = {
    'x-wx-openid': 'wx-openid-1',
    'x-wx-service': 'lindong-api'
  }

  const packageGroupDetail = await requestJson({
    app,
    pathname: '/api/package-groups/package-group-1',
    headers: cloudbaseHeaders
  })
  const createPackageStartOrder = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/package-orders/start',
    headers: cloudbaseHeaders,
    body: { packageId: 'package-1', targetCount: 4, weekday: 6, hour: 10 }
  })
  const createPackageJoinOrder = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/package-orders/join',
    headers: cloudbaseHeaders,
    body: { packageId: 'package-1', packageGroupId: 'package-group-1' }
  })
  const createOrder = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/orders',
    headers: cloudbaseHeaders,
    body: { courseId: 'course-1' }
  })
  const orderStatus = await requestJson({
    app,
    pathname: '/api/orders/order-1',
    headers: cloudbaseHeaders
  })
  const paymentPrepare = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/payments/prepare',
    headers: cloudbaseHeaders,
    body: { orderId: 'order-1' }
  })
  const mockSuccess = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/payments/mock-success',
    headers: cloudbaseHeaders,
    body: { orderId: 'package-order-start-1' }
  })
  const userGroups = await requestJson({
    app,
    pathname: '/api/user/groups',
    headers: cloudbaseHeaders
  })
  const subscription = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/user/group-result-subscriptions',
    headers: cloudbaseHeaders,
    body: {
      groupId: 'group-1',
      courseId: 'course-1',
      decision: 'accept',
      status: 'subscribed'
    }
  })
  const userPackageGroups = await requestJson({
    app,
    pathname: '/api/user/package-groups',
    headers: cloudbaseHeaders
  })

  assert.equal(packageGroupDetail.status, 200)
  assert.equal(packageGroupDetail.body.data.userId, 'user-from-cloudbase')

  assert.equal(createPackageStartOrder.status, 200)
  assert.equal(createPackageStartOrder.body.data.orderId, 'package-order-start-1')

  assert.equal(createPackageJoinOrder.status, 200)
  assert.equal(createPackageJoinOrder.body.data.orderId, 'package-order-join-1')

  assert.equal(createOrder.status, 200)
  assert.equal(createOrder.body.orderId, 'order-1')

  assert.equal(orderStatus.status, 200)
  assert.equal(orderStatus.body.userId, 'user-from-cloudbase')
  assert.equal(orderStatus.body.supabaseWasPassed, null)

  assert.equal(paymentPrepare.status, 200)
  assert.equal(paymentPrepare.body.userId, 'user-from-cloudbase')
  assert.equal(paymentPrepare.body.supabaseWasPassed, null)

  assert.equal(mockSuccess.status, 200)
  assert.equal(mockSuccess.body.data.orderId, 'package-order-start-1')
  assert.equal(mockSuccess.body.data.packageGroupId, 'package-group-1')

  assert.equal(userGroups.status, 200)
  assert.equal(userGroups.body.userId, 'user-from-cloudbase')
  assert.equal(userGroups.body.supabaseWasPassed, null)

  assert.equal(userPackageGroups.status, 200)
  assert.equal(userPackageGroups.body.data.userId, 'user-from-cloudbase')
  assert.equal(userPackageGroups.body.data.supabaseWasPassed, null)

  assert.equal(subscription.status, 200)
  assert.equal(subscription.body.user_id, 'user-from-cloudbase')
  assert.equal(subscription.body.group_id, 'group-1')
})
