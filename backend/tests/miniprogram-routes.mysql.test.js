const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const backendRoot = path.resolve(__dirname, '..', 'lindong-api')

const mockModule = (relativePath, exports) => {
  const modulePath = require.resolve(path.join(backendRoot, relativePath))
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

const loadAppForMySqlRoutes = ({ paymentProviderMode = 'mock' } = {}) => {
  process.env.PAYMENT_PROVIDER_MODE = paymentProviderMode
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret'

  const targets = [
    'app.js',
    'config/env.js',
    'utils/getSupabaseClient.js',
    'middleware/auth.js',
    'repositories/index.js',
    'repositories/userIdentitiesRepository.js',
    'repositories/usersRepository.js',
    'shared/utils/miniProgramIdentity.js',
    'shared/utils/wechatIdentity.js',
    'shared/services/miniProgramAuth.js',
    'shared/services/courseReaders.js',
    'shared/services/groupReaders.js',
    'shared/services/groupOrders.js',
    'shared/services/bannerReaders.js',
    'shared/services/packageReaders.js',
    'shared/services/packageOrders.js',
    'shared/services/paymentShell.js',
    'shared/services/wechatMiniProgram.js',
    'shared/services/userAccountMerge.js',
    'shared/services/wechatMiniProgramNotifications.js',
    'shared/services/groupResultNotificationDelivery.js',
    'shared/services/groupResultNotifications.js',
    'utils/courseLifecycle.js',
    'routes/auth.js',
    'routes/banners.js',
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

  const identityStore = new Map([
    ['wechat_openid:wx-openid-1', { user_id: 'user-from-cloudbase' }]
  ])

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true,
      paymentProviderMode,
      internalPaymentSecret: 'test-secret',
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
    findUserById: async id => ({
      id,
      openid: id === 'user-from-cloudbase' ? 'wx-openid-1' : 'wx-openid-2',
      nickname: '微信用户',
      avatar_url: '',
      phone: id === 'user-from-cloudbase' ? '13800138000' : ''
    }),
    findUserByOpenId: async openId => {
      if (openId === 'wx-openid-1') {
        return {
          id: 'user-from-cloudbase',
          openid: openId,
          nickname: '微信用户',
          avatar_url: '',
          phone: ''
        }
      }

      if (openId === 'wx-openid-2') {
        return {
          id: 'user-from-openid-2',
          openid: openId,
          nickname: '微信用户2',
          avatar_url: '',
          phone: ''
        }
      }

      return null
    },
    findUserByPhone: async phone => {
      if (phone === '13800138000') {
        return {
          id: 'user-from-cloudbase',
          openid: 'wx-openid-1',
          nickname: '微信用户',
          avatar_url: '',
          phone
        }
      }

      return null
    },
    updateUserPhone: async ({ id, phone }) => ({
      id,
      nickname: '微信用户',
      avatar_url: '',
      phone
    })
  })

  mockModule('repositories/userIdentitiesRepository.js', {
    findIdentity: async ({ identityType, identityKey }) => identityStore.get(`${identityType}:${identityKey}`) || null,
    assignIdentityToUser: async ({ userId, identityType, identityKey }) => {
      const record = {
        user_id: userId,
        identity_type: identityType,
        identity_key: identityKey
      }
      identityStore.set(`${identityType}:${identityKey}`, record)
      return record
    },
    listIdentitiesByUserId: async userId =>
      [...identityStore.values()].filter(item => item.user_id === userId)
  })

  mockModule('repositories/index.js', {
    groupResultSubscriptionsRepository: {
      upsertSubscription: async payload => payload
    },
    userIdentitiesRepository: require(path.join(backendRoot, 'repositories/userIdentitiesRepository.js')),
    usersRepository: require(path.join(backendRoot, 'repositories/usersRepository.js')),
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
      appId,
      token: 'stub-token',
      userInfo: {
        nickName: '微信用户',
        avatarUrl: ''
      }
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

  mockModule('shared/services/bannerReaders.js', {
    fetchMiniProgramHomeBanners: async ({ city }) => ({
      list: [
        {
          id: 'banner-1',
          title: city ? `${city} Banner` : '全国 Banner'
        }
      ]
    })
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
    createPackageStartOrder: async ({ supabase, packageId, targetCount, weekday, hour, childNickname, childAge, parentMobile, userId }) => ({
      order: {
        id: 'package-order-start-1',
        order_no: 'LDPKG-20260428-000001',
        order_type: 2,
        package_action: 'start',
        package_id: packageId,
        status: 'pending'
      },
      memberAmountFen: 33333,
      childNickname,
      childAge: Number(childAge),
      parentMobile,
      targetCount,
      weekday,
      hour,
      userId,
      supabaseWasPassed: supabase
    }),
    createPackageJoinOrder: async ({ supabase, packageId, packageGroupId, childNickname, childAge, parentMobile, userId }) => ({
      order: {
        id: 'package-order-join-1',
        order_no: 'LDPKG-20260428-000002',
        order_type: 2,
        package_action: 'join',
        package_id: packageId,
        package_group_id: packageGroupId,
        status: 'pending'
      },
      memberAmountFen: 33333,
      childNickname,
      childAge: Number(childAge),
      parentMobile,
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
    closeOrderPayment: async ({ supabase, orderId, userId }) => ({
      orderId,
      userId,
      orderStatus: 'closed',
      paymentRecordStatus: 'closed',
      supabaseWasPassed: supabase
    }),
    getOrderPaymentStatus: async ({ supabase, orderId, userId }) => ({
      orderId,
      userId,
      orderStatus: 'pending',
      supabaseWasPassed: supabase
    }),
    prepareOrderPayment: async ({ supabase, orderId, userId }) => ({
      orderId,
      userId,
      supabaseWasPassed: supabase
    }),
    prepareCloudPayUnifiedOrder: async ({ orderId, openId, userId }) => ({
      orderId,
      openId,
      userId,
      body: '邻动体适能课程报名-LDPKG-20260428-000001',
      outTradeNo: 'LDPKG-20260428-000001',
      totalFee: 33333,
      attach: JSON.stringify({ orderId })
    }),
    handleWechatPaymentCallback: async ({ supabase, payload }) => ({
      payload,
      supabaseWasPassed: supabase
    }),
    handleCloudPayPaymentCallback: async ({ payload }) => ({
      orderId: payload.orderId || 'package-order-start-1',
      orderStatus: 'success',
      paymentRecordStatus: 'paid'
    }),
    prepareCloudPayRefund: async ({ orderId, reason }) => ({
      orderId,
      outTradeNo: 'LDPKG-20260428-000001',
      outRefundNo: 'RF-LDPKG-20260428-000001',
      totalFee: 33333,
      refundFee: 33333,
      refundDesc: reason || '课程退款'
    }),
    markCloudPayRefundResult: async ({ payload }) => ({
      order_id: payload.orderId,
      status: 'refunded',
      callback_status: 'REFUNDED'
    }),
    markPaymentRecordPaid: async ({ supabase, orderId }) => ({
      orderId,
      supabaseWasPassed: supabase
    }),
    isCloudPayPaymentMode: () => `${process.env.PAYMENT_PROVIDER_MODE || ''}`.trim().toLowerCase() === 'cloudpay',
    isWechatPaymentMode: () => `${process.env.PAYMENT_PROVIDER_MODE || ''}`.trim().toLowerCase() === 'wechat'
  })

  mockModule('shared/services/wechatMiniProgram.js', {
    verifyWechatPayCallbackSignature: () => true,
    exchangePhoneNumberCode: async code => ({
      phoneNumber: '+8613800138000',
      purePhoneNumber: '13800138000',
      countryCode: '86',
      codeEcho: code
    })
  })

  mockModule('shared/services/userAccountMerge.js', {
    mergeUserAccountsByPhone: async ({ phone, currentUserId, currentOpenId }) => {
      if (phone === '13800138000' && currentUserId === 'user-from-openid-2') {
        identityStore.set('wechat_openid:wx-openid-2', {
          user_id: 'user-from-cloudbase',
          identity_type: 'wechat_openid',
          identity_key: currentOpenId
        })

        return {
          merged: true,
          userId: 'user-from-cloudbase'
        }
      }

      return {
        merged: false,
        userId: currentUserId
      }
    }
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

  const app = require(path.join(backendRoot, 'miniprogram-container/app.js'))
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
    banners,
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
        pathname: '/api/banners?city=%E6%B7%B1%E5%9C%B3'
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
          childAge: 6,
          parentMobile: '13800138000'
        }
      }),
      requestJson({
        app,
        method: 'POST',
        pathname: '/api/package-orders/join',
        headers: { 'x-wx-openid': 'wx-openid-1', 'x-wx-service': 'lindong-api' },
        body: {
          packageId: 'package-1',
          packageGroupId: 'package-group-1',
          childNickname: '乐乐',
          childAge: 5,
          parentMobile: '13800138001'
        }
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
  assert.equal(typeof login.body.token, 'string')
  assert.equal(login.body.token.length > 0, true)
  assert.equal(login.body.userInfo.nickName, '微信用户')

  assert.equal(banners.status, 200)
  assert.equal(banners.body.code, 0)
  assert.equal(banners.body.data.list[0].title, '深圳 Banner')

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
  assert.equal(createPackageStartOrder.body.data.parent_mobile, '13800138000')

  assert.equal(createPackageJoinOrder.status, 200)
  assert.equal(createPackageJoinOrder.body.data.orderId, 'package-order-join-1')
  assert.equal(createPackageJoinOrder.body.data.child_nickname, '乐乐')
  assert.equal(createPackageJoinOrder.body.data.child_age, 5)
  assert.equal(createPackageJoinOrder.body.data.parent_mobile, '13800138001')

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
  assert.equal(typeof login.body.token, 'string')
  assert.equal(login.body.token.length > 0, true)
  assert.equal(login.body.userInfo.nickName, '微信用户')
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
    body: {
      packageId: 'package-1',
      packageGroupId: 'package-group-1',
      childNickname: '乐乐',
      childAge: 5,
      parentMobile: '13800138001'
    }
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
  const paymentStatus = await requestJson({
    app,
    pathname: '/api/payments/status?orderId=order-1',
    headers: cloudbaseHeaders
  })
  const paymentClose = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/payments/close',
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
      groupId: 'package-group-1',
      courseId: 'package-1',
      templateKey: 'groupSuccess',
      templateId: 'tpl-success',
      decision: 'accept',
      status: 'subscribed'
    }
  })
  const invalidSubscription = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/user/group-result-subscriptions',
    headers: cloudbaseHeaders,
    body: {
      groupId: 'package-group-1',
      courseId: 'package-1',
      templateKey: 'groupResult',
      decision: 'accept',
      status: 'subscribed'
    }
  })
  const userPackageGroups = await requestJson({
    app,
    pathname: '/api/user/package-groups',
    headers: cloudbaseHeaders
  })
  const bindPhone = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/auth/phone',
    headers: {
      ...cloudbaseHeaders,
      'Content-Type': 'application/json'
    },
    body: {
      code: 'phone-code-1'
    }
  })

  assert.equal(packageGroupDetail.status, 200)
  assert.equal(packageGroupDetail.body.data.userId, 'user-from-cloudbase')

  assert.equal(createPackageStartOrder.status, 200)
  assert.equal(createPackageStartOrder.body.data.orderId, 'package-order-start-1')

  assert.equal(createPackageJoinOrder.status, 200)
  assert.equal(createPackageJoinOrder.body.data.orderId, 'package-order-join-1')
  assert.equal(createPackageJoinOrder.body.data.child_nickname, '乐乐')
  assert.equal(createPackageJoinOrder.body.data.child_age, 5)
  assert.equal(createPackageJoinOrder.body.data.parent_mobile, '13800138001')

  assert.equal(createOrder.status, 200)
  assert.equal(createOrder.body.orderId, 'order-1')

  assert.equal(orderStatus.status, 200)
  assert.equal(orderStatus.body.userId, 'user-from-cloudbase')
  assert.equal(orderStatus.body.supabaseWasPassed, null)

  assert.equal(paymentPrepare.status, 200)
  assert.equal(paymentPrepare.body.userId, 'user-from-cloudbase')
  assert.equal(paymentPrepare.body.supabaseWasPassed, null)

  assert.equal(paymentStatus.status, 200)
  assert.equal(paymentStatus.body.userId, 'user-from-cloudbase')
  assert.equal(paymentStatus.body.orderStatus, 'pending')
  assert.equal(paymentStatus.body.supabaseWasPassed, null)

  assert.equal(paymentClose.status, 200)
  assert.equal(paymentClose.body.userId, 'user-from-cloudbase')
  assert.equal(paymentClose.body.orderStatus, 'closed')
  assert.equal(paymentClose.body.supabaseWasPassed, null)

  assert.equal(mockSuccess.status, 200)
  assert.equal(mockSuccess.body.data.orderId, 'package-order-start-1')
  assert.equal(mockSuccess.body.data.packageGroupId, 'package-group-1')

  assert.equal(userGroups.status, 200)
  assert.equal(userGroups.body.userId, 'user-from-cloudbase')
  assert.equal(userGroups.body.supabaseWasPassed, null)

  assert.equal(userPackageGroups.status, 200)
  assert.equal(userPackageGroups.body.data.userId, 'user-from-cloudbase')
  assert.equal(userPackageGroups.body.data.supabaseWasPassed, null)

  assert.equal(bindPhone.status, 200)
  assert.equal(bindPhone.body.purePhoneNumber, '13800138000')
  assert.equal(bindPhone.body.userInfo.phone, '13800138000')
  assert.equal(typeof bindPhone.body.token, 'string')
  assert.equal(bindPhone.body.token.length > 0, true)

  assert.equal(subscription.status, 200)
  assert.equal(subscription.body.user_id, 'user-from-cloudbase')
  assert.equal(subscription.body.template_key, 'groupSuccess')
  assert.equal(subscription.body.template_id, 'tpl-success')
  assert.equal(invalidSubscription.status, 400)
  assert.equal(invalidSubscription.body.message, 'templateKey is invalid')
  assert.equal(subscription.body.group_id, 'package-group-1')
  assert.equal(subscription.body.course_id, 'package-1')
})

test('phone binding merges a different wechat openid into the existing phone account', async () => {
  const app = loadAppForMySqlRoutes()

  const bindPhone = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/auth/phone',
    headers: {
      'x-wx-openid': 'wx-openid-2',
      'x-wx-service': 'lindong-api'
    },
    body: {
      code: 'phone-code-1'
    }
  })

  const userGroups = await requestJson({
    app,
    pathname: '/api/user/groups',
    headers: {
      'x-wx-openid': 'wx-openid-2',
      'x-wx-service': 'lindong-api'
    }
  })

  assert.equal(bindPhone.status, 200)
  assert.equal(bindPhone.body.purePhoneNumber, '13800138000')
  assert.equal(bindPhone.body.userInfo.phone, '13800138000')
  assert.equal(typeof bindPhone.body.token, 'string')
  assert.equal(bindPhone.body.token.length > 0, true)

  assert.equal(userGroups.status, 200)
  assert.equal(userGroups.body.userId, 'user-from-cloudbase')
})

test('mock payment success is disabled in wechat payment mode', async () => {
  const originalPaymentProviderMode = process.env.PAYMENT_PROVIDER_MODE

  try {
    const app = loadAppForMySqlRoutes({ paymentProviderMode: 'wechat' })
    const response = await requestJson({
      app,
      method: 'POST',
      pathname: '/api/payments/mock-success',
      headers: {
        'x-wx-openid': 'wx-openid-1',
        'x-wx-service': 'lindong-api'
      },
      body: { orderId: 'package-order-start-1' }
    })

    assert.equal(response.status, 403)
    assert.equal(response.body.message, 'mock payment is disabled in wechat payment mode')
  } finally {
    if (originalPaymentProviderMode === undefined) {
      delete process.env.PAYMENT_PROVIDER_MODE
    } else {
      process.env.PAYMENT_PROVIDER_MODE = originalPaymentProviderMode
    }
  }
})

test('internal cloudpay prepare route requires secret and returns trusted payload', async () => {
  const app = loadAppForMySqlRoutes({ paymentProviderMode: 'cloudpay' })

  const forbidden = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/payments/internal/cloudpay/prepare',
    body: {
      orderId: 'package-order-start-1',
      openId: 'wx-openid-1'
    }
  })

  const prepared = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/payments/internal/cloudpay/prepare',
    headers: {
      'x-internal-payment-secret': 'test-secret'
    },
    body: {
      orderId: 'package-order-start-1',
      openId: 'wx-openid-1'
    }
  })

  assert.equal(forbidden.status, 403)
  assert.equal(prepared.status, 200)
  assert.equal(prepared.body.orderId, 'package-order-start-1')
  assert.equal(prepared.body.outTradeNo.length > 0, true)
})

test('internal cloudpay callback route requires secret and confirms payment', async () => {
  const app = loadAppForMySqlRoutes({ paymentProviderMode: 'cloudpay' })

  const forbidden = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/payments/internal/cloudpay/callback',
    body: {
      orderId: 'package-order-start-1'
    }
  })

  const confirmed = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/payments/internal/cloudpay/callback',
    headers: {
      'x-internal-payment-secret': 'test-secret'
    },
    body: {
      orderId: 'package-order-start-1'
    }
  })

  assert.equal(forbidden.status, 403)
  assert.equal(confirmed.status, 200)
  assert.equal(confirmed.body.orderId, 'package-order-start-1')
  assert.equal(confirmed.body.paymentRecordStatus, 'paid')
})

test('internal cloudpay refund routes require secret and return refund payload', async () => {
  const app = loadAppForMySqlRoutes({ paymentProviderMode: 'cloudpay' })

  const forbidden = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/payments/internal/cloudpay/refund/prepare',
    body: {
      orderId: 'package-order-start-1',
      reason: '用户协商退款'
    }
  })

  const prepared = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/payments/internal/cloudpay/refund/prepare',
    headers: {
      'x-internal-payment-secret': 'test-secret'
    },
    body: {
      orderId: 'package-order-start-1',
      reason: '用户协商退款'
    }
  })

  const confirmed = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/payments/internal/cloudpay/refund/confirm',
    headers: {
      'x-internal-payment-secret': 'test-secret'
    },
    body: {
      orderId: 'package-order-start-1',
      outRefundNo: 'RF-LDPKG-20260428-000001'
    }
  })

  assert.equal(forbidden.status, 403)
  assert.equal(prepared.status, 200)
  assert.equal(prepared.body.outRefundNo, 'RF-LDPKG-20260428-000001')
  assert.equal(confirmed.status, 200)
  assert.equal(confirmed.body.status, 'refunded')
})
