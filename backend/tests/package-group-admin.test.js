const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = process.env.JWT_SECRET || 'package-group-admin-test-secret'
process.env.CRON_SECRET = process.env.CRON_SECRET || 'package-group-cron-secret'

const backendRoot = path.resolve(__dirname, '..', 'console-api-service')

const mockModule = (relativePath, exports) => {
  const modulePath = require.resolve(path.join(backendRoot, relativePath))
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

const clearModules = relativePaths => {
  relativePaths.forEach(relativePath => {
    const modulePath = require.resolve(path.join(backendRoot, relativePath))
    delete require.cache[modulePath]
  })
}

const clone = value => JSON.parse(JSON.stringify(value))

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

const createAdminToken = () =>
  jwt.sign(
    {
      type: 'admin',
      adminId: 'admin-1',
      username: 'root',
      role: 'super_admin'
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

const loadConsoleAppWithMockedPackageService = () => {
  const calls = []
  clearModules([
    'console-api/app.js',
    'console-api/routes/index.js',
    'console-api/routes/banners.js',
    'console-api/routes/packages.js',
    'console-api/routes/package-groups.js',
    'console-api/routes/package-orders.js',
    'console-api/controllers/bannerAdminController.js',
    'console-api/controllers/packageAdminController.js',
    'console-api/services/bannerAdminService.js',
    'console-api/services/packageAdminService.js',
    'middleware/adminAuth.js'
  ])

  mockModule('console-api/services/bannerAdminService.js', {
    listAdminBanners: async payload => {
      calls.push(['listAdminBanners', payload])
      return { total: 1, page: 1, size: 10, list: [{ id: 'banner-1', status: 'pending' }] }
    },
    getAdminBannerDetail: async payload => {
      calls.push(['getAdminBannerDetail', payload])
      return { id: payload.bannerId, title: '首页 Banner', status: 'pending' }
    },
    createAdminBanner: async payload => {
      calls.push(['createAdminBanner', payload])
      return { id: 'banner-created', title: payload.payload.title, status: 'pending' }
    },
    updateAdminBanner: async payload => {
      calls.push(['updateAdminBanner', payload])
      return { id: payload.bannerId, title: payload.payload.title, status: 'inactive' }
    },
    offlineAdminBanner: async payload => {
      calls.push(['offlineAdminBanner', payload])
      return { id: payload.bannerId, title: '首页 Banner', status: 'inactive' }
    }
  })

  mockModule('console-api/services/packageAdminService.js', {
    listAdminPackages: async payload => {
      calls.push(['listAdminPackages', payload])
      return { total: 1, page: 1, size: 10, list: [{ id: 'pkg-1' }] }
    },
    getAdminPackageDetail: async payload => {
      calls.push(['getAdminPackageDetail', payload])
      return { id: payload.packageId, name: '课包' }
    },
    createAdminPackage: async payload => {
      calls.push(['createAdminPackage', payload])
      return { id: 'pkg-created', name: payload.payload.name, package_category: payload.payload.package_category || '体适能' }
    },
    updateAdminPackage: async payload => {
      calls.push(['updateAdminPackage', payload])
      return { id: payload.packageId, name: payload.payload.name, package_category: payload.payload.package_category || '体适能' }
    },
    listAdminPackageGroups: async payload => {
      calls.push(['listAdminPackageGroups', payload])
      return { total: 1, page: 1, size: 10, list: [{ id: 'pg-1' }] }
    },
    getAdminPackageGroupDetail: async payload => {
      calls.push(['getAdminPackageGroupDetail', payload])
      return { id: payload.packageGroupId, package_name: '课包拼团详情' }
    },
    listAdminPackageOrders: async payload => {
      calls.push(['listAdminPackageOrders', payload])
      return { total: 1, page: 1, size: 10, list: [{ id: 'ord-1' }] }
    },
    refundAdminPackageOrder: async payload => {
      calls.push(['refundAdminPackageOrder', payload])
      return { id: payload.orderId, status: 'refunded' }
    }
  })

  return {
    app: require(path.join(backendRoot, 'console-api/app.js')),
    calls
  }
}

const createPackageRepositoryState = () => ({
  packages: clone([
    {
      id: 'pkg-1',
      name: '周末体适能5次课包',
      cover: 'https://example.com/pkg.png',
      images: [],
      total_price: 1000,
      package_category: '体适能',
      age_range: '4-8岁',
      class_count: 10,
      class_duration_minutes: 60,
      supported_people: [2, 4],
      group_price_config: [
        { target_count: 2, price_fen: 500 },
        { target_count: 4, price_fen: 250 }
      ],
      location_district: '南山区',
      location_community: '深圳湾社区',
      location_detail: '会所二楼',
      longitude: 113.93,
      latitude: 22.53,
      coach_name: '教练A',
      coach_intro: '简介',
      coach_certificates: [],
      description: '<p>课程介绍</p>',
      deadline_hours: 48,
      publish_time: '2026-04-19T00:00:00.000Z',
      unpublish_time: null,
      status: 1,
      created_at: '2026-04-19T00:00:00.000Z',
      updated_at: '2026-04-19T00:00:00.000Z'
    }
  ]),
  groups: clone([
    {
      id: 'pg-active',
      package_id: 'pkg-1',
      creator_id: 'user-1',
      target_count: 2,
      current_count: 1,
      status: 'active',
      weekday: 6,
      hour: 10,
      first_class_time: null,
      deadline: '2026-04-20T10:00:00.000Z',
      created_at: '2026-04-18T10:00:00.000Z',
      success_time: null
    },
    {
      id: 'pg-success',
      package_id: 'pkg-1',
      creator_id: 'user-1',
      target_count: 2,
      current_count: 2,
      status: 'success',
      weekday: 6,
      hour: 10,
      first_class_time: '2026-04-25T10:00:00.000Z',
      deadline: '2026-04-20T10:00:00.000Z',
      created_at: '2026-04-18T10:00:00.000Z',
      success_time: '2026-04-18T11:00:00.000Z'
    },
    {
      id: 'pg-expired',
      package_id: 'pkg-1',
      creator_id: 'user-2',
      target_count: 4,
      current_count: 2,
      status: 'active',
      weekday: 7,
      hour: 9,
      first_class_time: null,
      deadline: '2026-04-18T10:00:00.000Z',
      created_at: '2026-04-16T10:00:00.000Z',
      success_time: null
    }
  ]),
  orders: clone([
    {
      id: 'ord-refund',
      order_no: 'LD-REFUND',
      user_id: 'user-1',
      order_type: 2,
      package_id: 'pkg-1',
      package_group_id: 'pg-active',
      package_action: 'start',
      package_context: {
        child_nickname: '小满',
        child_age: 6,
        parent_mobile: '13800138000'
      },
      amount: 500,
      status: 'success',
      created_at: '2026-04-18T10:01:00.000Z',
      updated_at: '2026-04-18T10:01:00.000Z',
      pay_time: '2026-04-18T10:02:00.000Z',
      refund_time: null,
      refund_reason: '',
      refund_operator_id: null
    },
    {
      id: 'ord-pending',
      order_no: 'LD-PENDING',
      user_id: 'user-3',
      order_type: 2,
      package_id: 'pkg-1',
      package_group_id: 'pg-active',
      package_action: 'join',
      package_context: {
        child_nickname: '乐乐',
        child_age: 5,
        parent_mobile: '13800138001'
      },
      amount: 500,
      status: 'pending',
      created_at: '2026-04-18T10:03:00.000Z',
      updated_at: '2026-04-18T10:03:00.000Z'
    },
    {
      id: 'ord-success-group',
      order_no: 'LD-SUCCESS',
      user_id: 'user-2',
      order_type: 2,
      package_id: 'pkg-1',
      package_group_id: 'pg-success',
      package_action: 'join',
      package_context: {
        child_nickname: '米米',
        child_age: 7,
        parent_mobile: '13800138002'
      },
      amount: 500,
      status: 'success',
      created_at: '2026-04-18T11:00:00.000Z',
      updated_at: '2026-04-18T11:00:00.000Z',
      pay_time: '2026-04-18T11:00:00.000Z'
    },
    {
      id: 'ord-expired-1',
      order_no: 'LD-EXPIRED-1',
      user_id: 'user-1',
      order_type: 2,
      package_id: 'pkg-1',
      package_group_id: 'pg-expired',
      package_action: 'start',
      package_context: {
        child_nickname: '星星',
        child_age: 8,
        parent_mobile: '13800138003'
      },
      amount: 250,
      status: 'success',
      created_at: '2026-04-16T10:01:00.000Z',
      updated_at: '2026-04-16T10:01:00.000Z',
      pay_time: '2026-04-16T10:02:00.000Z'
    },
    {
      id: 'ord-expired-2',
      order_no: 'LD-EXPIRED-2',
      user_id: 'user-2',
      order_type: 2,
      package_id: 'pkg-1',
      package_group_id: 'pg-expired',
      package_action: 'join',
      package_context: {
        child_nickname: '安安',
        child_age: 6,
        parent_mobile: '13800138004'
      },
      amount: 250,
      status: 'success',
      created_at: '2026-04-16T10:03:00.000Z',
      updated_at: '2026-04-16T10:03:00.000Z',
      pay_time: '2026-04-16T10:04:00.000Z'
    }
  ]),
  paymentRecords: clone([
    {
      id: 'pay-refund',
      order_id: 'ord-refund',
      user_id: 'user-1',
      package_id: 'pkg-1',
      package_group_id: '',
      status: 'paid',
      callback_status: 'MOCK_SUCCESS',
      callback_payload: null
    },
    {
      id: 'pay-expired-1',
      order_id: 'ord-expired-1',
      user_id: 'user-1',
      package_id: 'pkg-1',
      package_group_id: 'pg-expired',
      status: 'paid',
      callback_status: 'MOCK_SUCCESS',
      callback_payload: null
    },
    {
      id: 'pay-expired-2',
      order_id: 'ord-expired-2',
      user_id: 'user-2',
      package_id: 'pkg-1',
      package_group_id: 'pg-expired',
      status: 'paid',
      callback_status: 'MOCK_SUCCESS',
      callback_payload: null
    }
  ]),
  users: clone([
    { id: 'user-1', nickname: '阿明', avatar_url: '' },
    { id: 'user-2', nickname: '小红', avatar_url: '' }
  ]),
  adminLogWrites: []
})

const loadPackageServicesWithState = () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'utils/adminStore.js',
    'shared/services/paymentShell.js',
    'shared/services/groupResultNotifications.js',
    'shared/services/packageGroupStore.js',
    'shared/services/packageReaders.js',
    'shared/services/packageOrders.js',
    'shared/services/groupOrders.js',
    'shared/services/groupOrderStore.js',
    'shared/services/groupOrderParticipation.js',
    'console-api/services/packageAdminService.js'
  ])

  const state = createPackageRepositoryState()
  const filterByIds = (list, ids, key = 'id') => list.filter(item => ids.includes(item[key]))
  const normalizeSupportedPeople = value => {
    const items = Array.isArray(value) ? value : `${value || ''}`.split(',')
    return [...new Set(items.map(item => Number(item)).filter(item => Number.isInteger(item) && item > 0))]
  }
  const normalizePackageCategory = value => {
    const normalized = `${value || ''}`.trim()
    return ['体适能', '跳绳'].includes(normalized) ? normalized : '体适能'
  }
  const normalizeGroupPriceConfig = value =>
    (Array.isArray(value) ? value : [])
      .map(item => ({
        target_count: Number(item && item.target_count) || 0,
        price_fen: Number(item && item.price_fen) || 0
      }))
      .filter(item => item.target_count > 0 && item.price_fen > 0)
      .sort((left, right) => left.target_count - right.target_count)

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('utils/adminStore.js', {
    writeAdminLog: async payload => {
      state.adminLogWrites.push(payload)
      return payload
    }
  })

  mockModule('shared/services/groupResultNotifications.js', {
    enqueueNotificationsForGroups: async payload => {
      if (!state.notificationEnqueueCalls) {
        state.notificationEnqueueCalls = []
      }
      state.notificationEnqueueCalls.push(payload)
      return []
    }
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      PACKAGE_CATEGORIES: ['体适能', '跳绳'],
      normalizePackageCategory,
      normalizeGroupPriceConfig,
      normalizeSupportedPeople,
      listPackages: async ({ keyword = '', category = '', status = '' } = {}) =>
        state.packages
          .filter(item => !keyword || item.name.includes(keyword))
          .filter(item => !category || item.package_category === category)
          .filter(item => status === '' || Number(item.status) === Number(status)),
      findPackageById: async id => state.packages.find(item => item.id === id) || null,
      findPackagesByIds: async ids => filterByIds(state.packages, ids),
      createPackage: async payload => {
        const created = {
          id: payload.id || `pkg-${state.packages.length + 1}`,
          ...payload,
          package_category: normalizePackageCategory(payload.package_category),
          supported_people: normalizeSupportedPeople(payload.supported_people),
          group_price_config: normalizeGroupPriceConfig(payload.group_price_config),
          created_at: payload.created_at || '2026-04-19T00:00:00.000Z',
          updated_at: payload.updated_at || '2026-04-19T00:00:00.000Z'
        }
        state.packages.push(created)
        return created
      },
      updatePackage: async (id, payload = {}) => {
        const index = state.packages.findIndex(item => item.id === id)
        if (index < 0) {
          return null
        }

        state.packages[index] = {
          ...state.packages[index],
          ...payload,
          package_category:
            payload.package_category === undefined
              ? state.packages[index].package_category
              : normalizePackageCategory(payload.package_category),
          supported_people:
            payload.supported_people === undefined
              ? state.packages[index].supported_people
              : normalizeSupportedPeople(payload.supported_people),
          group_price_config:
            payload.group_price_config === undefined
              ? state.packages[index].group_price_config
              : normalizeGroupPriceConfig(payload.group_price_config)
        }
        return state.packages[index]
      }
    },
    packageGroupsRepository: {
      listPackageGroups: async ({ packageId, packageIds = [], status, statuses = [], beforeDeadline, afterDeadline } = {}) =>
        state.groups
          .filter(item => !packageId || item.package_id === packageId)
          .filter(item => !packageIds.length || packageIds.includes(item.package_id))
          .filter(item => !status || item.status === status)
          .filter(item => !statuses.length || statuses.includes(item.status))
          .filter(item => !beforeDeadline || new Date(item.deadline).getTime() <= new Date(beforeDeadline).getTime())
          .filter(item => !afterDeadline || new Date(item.deadline).getTime() > new Date(afterDeadline).getTime()),
      findPackageGroupById: async id => state.groups.find(item => item.id === id) || null,
      findPackageGroupsByIds: async ids => filterByIds(state.groups, ids),
      updatePackageGroup: async (id, payload = {}) => {
        const index = state.groups.findIndex(item => item.id === id)
        if (index < 0) {
          return null
        }

        state.groups[index] = {
          ...state.groups[index],
          ...payload
        }
        return state.groups[index]
      },
      bulkUpdatePackageGroupStatus: async ({ packageGroupIds = [], status }) => {
        state.groups.forEach(item => {
          if (packageGroupIds.includes(item.id)) {
            item.status = status
          }
        })
        return filterByIds(state.groups, packageGroupIds)
      }
    },
    ordersRepository: {
      listOrders: async ({ userId, orderType, packageId, packageGroupId, status, statuses = [] } = {}) =>
        state.orders
          .filter(item => !userId || item.user_id === userId)
          .filter(item => orderType === undefined || Number(item.order_type) === Number(orderType))
          .filter(item => !packageId || item.package_id === packageId)
          .filter(item => !packageGroupId || item.package_group_id === packageGroupId)
          .filter(item => !status || item.status === status)
          .filter(item => !statuses.length || statuses.includes(item.status)),
      listOrdersByPackageGroupId: async ({ packageGroupId, status, statuses = [] } = {}) =>
        state.orders
          .filter(item => item.package_group_id === packageGroupId)
          .filter(item => Number(item.order_type) === 2)
          .filter(item => !status || item.status === status)
          .filter(item => !statuses.length || statuses.includes(item.status)),
      findOrderById: async id => state.orders.find(item => item.id === id) || null,
      updateOrder: async (id, payload = {}) => {
        const index = state.orders.findIndex(item => item.id === id)
        if (index < 0) {
          return null
        }

        state.orders[index] = {
          ...state.orders[index],
          ...payload
        }
        return state.orders[index]
      },
      closeOrdersByIds: async ({ orderIds = [], now = new Date() }) => {
        state.orders.forEach(item => {
          if (orderIds.includes(item.id) && item.status === 'pending') {
            item.status = 'closed'
            item.updated_at = now
          }
        })
        return state.orders.filter(item => orderIds.includes(item.id) && item.status === 'closed')
      }
    },
    paymentRecordsRepository: {
      findPaymentRecordByOrderId: async orderId => state.paymentRecords.find(item => item.order_id === orderId) || null,
      updatePaymentRecord: async (id, payload = {}) => {
        const index = state.paymentRecords.findIndex(item => item.id === id)
        if (index < 0) {
          return null
        }

        state.paymentRecords[index] = {
          ...state.paymentRecords[index],
          ...payload
        }
        return state.paymentRecords[index]
      }
    },
    usersRepository: {
      listUsersByIds: async ids => filterByIds(state.users, ids),
      findUserById: async id => state.users.find(item => item.id === id) || null
    },
    coursesRepository: {},
    groupsRepository: {},
    groupMembersRepository: {}
  })

  return {
    packageAdminService: require(path.join(backendRoot, 'console-api/services/packageAdminService.js')),
    packageGroupStore: require(path.join(path.resolve(__dirname, '..', 'lindong-api'), 'shared/services/packageGroupStore.js')),
    state
  }
}

test('admin package routes are mounted behind admin authentication', async () => {
  const { app, calls } = loadConsoleAppWithMockedPackageService()

  const unauthorized = await requestJson({
    app,
    pathname: '/api/admin/packages'
  })
  assert.equal(unauthorized.status, 401)

  const headers = {
    Authorization: `Bearer ${createAdminToken()}`
  }
  const listPackages = await requestJson({
    app,
    pathname: '/api/admin/packages?page=2&size=20&keyword=体适能',
    headers
  })
  const listBanners = await requestJson({
    app,
    pathname: '/api/admin/banners?status=pending',
    headers
  })
  const bannerDetail = await requestJson({
    app,
    pathname: '/api/admin/banners/banner-1',
    headers
  })
  const createBanner = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/admin/banners',
    headers,
    body: {
      image_url: 'https://example.com/banner-create.png',
      title: '新 Banner',
      jump_type: 'none',
      online_time: '2026-04-24T10:00:00.000Z'
    }
  })
  const updateBanner = await requestJson({
    app,
    method: 'PUT',
    pathname: '/api/admin/banners/banner-1',
    headers,
    body: {
      title: '编辑 Banner',
      online_time: '2026-04-24T11:00:00.000Z'
    }
  })
  const offlineBanner = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/admin/banners/banner-1/offline',
    headers
  })
  const packageDetail = await requestJson({
    app,
    pathname: '/api/admin/packages/pkg-1',
    headers
  })
  const createPackage = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/admin/packages',
    headers,
    body: { name: '新课包', package_category: '跳绳' }
  })
  const updatePackage = await requestJson({
    app,
    method: 'PUT',
    pathname: '/api/admin/packages/pkg-1',
    headers,
    body: { name: '编辑课包', package_category: '体适能' }
  })
  const listGroups = await requestJson({
    app,
    pathname: '/api/admin/package-groups?status=active',
    headers
  })
  const groupDetail = await requestJson({
    app,
    pathname: '/api/admin/package-groups/pg-1',
    headers
  })
  const listOrders = await requestJson({
    app,
    pathname: '/api/admin/package-orders?status=success',
    headers
  })
  const refund = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/admin/package-orders/ord-1/refund',
    headers,
    body: { reason: '用户线下申请退款' }
  })

  assert.equal(listPackages.status, 200)
  assert.equal(listPackages.body.code, 0)
  assert.equal(listBanners.status, 200)
  assert.equal(listBanners.body.data.list[0].id, 'banner-1')
  assert.equal(bannerDetail.body.data.id, 'banner-1')
  assert.equal(createBanner.body.data.title, '新 Banner')
  assert.equal(updateBanner.body.data.title, '编辑 Banner')
  assert.equal(offlineBanner.body.data.status, 'inactive')
  assert.equal(packageDetail.body.data.id, 'pkg-1')
  assert.equal(createPackage.body.data.name, '新课包')
  assert.equal(createPackage.body.data.package_category, '跳绳')
  assert.equal(updatePackage.body.data.name, '编辑课包')
  assert.equal(listGroups.body.data.list[0].id, 'pg-1')
  assert.equal(groupDetail.body.data.id, 'pg-1')
  assert.equal(listOrders.body.data.list[0].id, 'ord-1')
  assert.equal(refund.body.data.status, 'refunded')
  assert.deepEqual(
    calls.map(item => item[0]),
    [
      'listAdminPackages',
      'listAdminBanners',
      'getAdminBannerDetail',
      'createAdminBanner',
      'updateAdminBanner',
      'offlineAdminBanner',
      'getAdminPackageDetail',
      'createAdminPackage',
      'updateAdminPackage',
      'listAdminPackageGroups',
      'getAdminPackageGroupDetail',
      'listAdminPackageOrders',
      'refundAdminPackageOrder'
    ]
  )
})

test('admin package group detail returns leader, members, orders, and anomalies', async () => {
  const { packageAdminService } = loadPackageServicesWithState()

  const result = await packageAdminService.getAdminPackageGroupDetail({
    packageGroupId: 'pg-active',
    now: new Date('2026-04-19T08:00:00.000Z')
  })

  assert.equal(result.id, 'pg-active')
  assert.equal(result.package_name, '周末体适能5次课包')
  assert.equal(result.leader.child_nickname, '小满')
  assert.equal(result.leader.child_age, 6)
  assert.equal(result.leader.parent_mobile, '13800138000')
  assert.equal(result.members.length, 2)
  assert.equal(result.members[1].child_nickname, '乐乐')
  assert.equal(result.orders.length, 2)
  assert.equal(result.orders[0].phone, '13800138000')
  assert.equal(result.summary.paid_order_count, 1)
  assert.equal(result.summary.pending_order_count, 1)
  assert.deepEqual(result.anomalies, [])
})

test('admin package order list exposes child profile and parent mobile from package context', async () => {
  const { packageAdminService } = loadPackageServicesWithState()

  const result = await packageAdminService.listAdminPackageOrders({
    query: {
      package_id: 'pkg-1'
    }
  })

  assert.equal(result.list.length > 0, true)
  assert.equal(result.list[0].child_nickname.length > 0, true)
  assert.equal(typeof result.list[0].child_age, 'number')
  assert.equal(result.list[0].phone.startsWith('138'), true)
})

test('admin package detail and order list tolerate legacy or missing package context fields', async () => {
  const { packageAdminService, state } = loadPackageServicesWithState()

  state.orders.push(
    {
      id: 'ord-legacy-phone',
      order_no: 'LD-LEGACY-PHONE',
      user_id: 'user-1',
      order_type: 2,
      package_id: 'pkg-1',
      package_group_id: 'pg-active',
      package_action: 'join',
      package_context: {
        child_nickname: '旧口径',
        child_age: 4,
        parent_phone: '13900139000'
      },
      amount: 500,
      status: 'refunded',
      created_at: '2026-04-18T10:05:00.000Z',
      updated_at: '2026-04-18T10:06:00.000Z',
      refund_time: '2026-04-18T11:00:00.000Z',
      refund_reason: '系统自动退款'
    },
    {
      id: 'ord-missing-context',
      order_no: 'LD-MISSING-CONTEXT',
      user_id: 'user-2',
      order_type: 2,
      package_id: 'pkg-1',
      package_group_id: 'pg-active',
      package_action: 'join',
      package_context: null,
      amount: 500,
      status: 'closed',
      created_at: '2026-04-18T10:07:00.000Z',
      updated_at: '2026-04-18T10:08:00.000Z'
    }
  )

  const detail = await packageAdminService.getAdminPackageGroupDetail({
    packageGroupId: 'pg-active',
    now: new Date('2026-04-19T08:00:00.000Z')
  })
  const orders = await packageAdminService.listAdminPackageOrders({
    query: {
      package_id: 'pkg-1'
    }
  })

  const legacyDetailOrder = detail.orders.find(item => item.order_no === 'LD-LEGACY-PHONE')
  const missingDetailOrder = detail.orders.find(item => item.order_no === 'LD-MISSING-CONTEXT')
  const legacyListOrder = orders.list.find(item => item.order_no === 'LD-LEGACY-PHONE')
  const missingListOrder = orders.list.find(item => item.order_no === 'LD-MISSING-CONTEXT')

  assert.equal(legacyDetailOrder.phone, '13900139000')
  assert.equal(legacyListOrder.phone, '13900139000')
  assert.equal(missingDetailOrder.child_nickname, '')
  assert.equal(missingDetailOrder.child_age, null)
  assert.equal(missingDetailOrder.phone, '')
  assert.equal(missingListOrder.child_nickname, '')
  assert.equal(missingListOrder.child_age, null)
  assert.equal(missingListOrder.phone, '')
})

test('admin package order refund updates order, group, pending orders, and payment record', async () => {
  const { packageAdminService, state } = loadPackageServicesWithState()

  const result = await packageAdminService.refundAdminPackageOrder({
    orderId: 'ord-refund',
    reason: '用户线下申请退款',
    admin: { id: 'admin-1' },
    now: new Date('2026-04-19T08:00:00.000Z')
  })

  const refundedOrder = state.orders.find(item => item.id === 'ord-refund')
  const pendingOrder = state.orders.find(item => item.id === 'ord-pending')
  const group = state.groups.find(item => item.id === 'pg-active')
  const paymentRecord = state.paymentRecords.find(item => item.id === 'pay-refund')

  assert.equal(result.status, 'refunded')
  assert.equal(refundedOrder.status, 'refunded')
  assert.equal(refundedOrder.refund_reason, '用户线下申请退款')
  assert.equal(group.status, 'failed')
  assert.equal(group.current_count, 0)
  assert.equal(pendingOrder.status, 'closed')
  assert.equal(paymentRecord.status, 'refunded')
  assert.equal(paymentRecord.callback_status, 'REFUNDED')
  assert.equal(paymentRecord.package_group_id, 'pg-active')
  assert.equal(state.adminLogWrites.length, 1)
  assert.equal(state.adminLogWrites[0].action, 'package_order_refund')
})

test('admin package order refund rejects successful package groups', async () => {
  const { packageAdminService } = loadPackageServicesWithState()

  await assert.rejects(
    () =>
      packageAdminService.refundAdminPackageOrder({
        orderId: 'ord-success-group',
        reason: '用户线下申请退款',
        admin: { id: 'admin-1' }
      }),
    error => {
      assert.equal(error.responseCode, 2006)
      assert.equal(error.statusCode, 400)
      assert.match(error.message, /已成团/)
      return true
    }
  )
})

test('admin package create requires valid package category', async () => {
  const { packageAdminService } = loadPackageServicesWithState()

  await assert.rejects(
    () =>
      packageAdminService.createAdminPackage({
        payload: {
          name: '测试课包',
          package_category: '篮球',
          age_range: '4-8岁',
          cover: 'https://example.com/pkg.png',
          total_price_fen: 1000,
          class_count: 10,
          class_duration_minutes: 60,
          group_price_config: [{ target_count: 2, price_fen: 500 }],
          location_district: '南山区',
          location_community: '深圳湾社区',
          location_detail: '会所二楼',
          coach_name: '教练A',
          coach_intro: '简介',
          description: '介绍',
          publish_time: '2026-04-21T10:00:00.000Z'
        },
        admin: { id: 'admin-1' }
      }),
    error => {
      assert.equal(error.responseCode, 1001)
      assert.equal(error.statusCode, 400)
      assert.match(error.message, /体适能或跳绳/)
      return true
    }
  )
})

test('admin package create does not require coach name', async () => {
  const { packageAdminService } = loadPackageServicesWithState()

  const result = await packageAdminService.createAdminPackage({
    payload: {
      name: '测试课包',
      package_category: '体适能',
      age_range: '4-8岁',
      cover: 'https://example.com/pkg.png',
      total_price_fen: 1000,
      class_count: 10,
      class_duration_minutes: 60,
      group_price_config: [{ target_count: 2, price_fen: 500 }],
      location_district: '南山区',
      location_community: '深圳湾社区',
      location_detail: '会所二楼',
      coach_intro: '简介',
      description: '介绍',
      publish_time: '2026-04-21T10:00:00.000Z'
    },
    admin: { id: 'admin-1' }
  })

  assert.equal(result.name, '测试课包')
})

test('admin package create derives total price from group price config', async () => {
  const { packageAdminService, state } = loadPackageServicesWithState()

  await packageAdminService.createAdminPackage({
    payload: {
      name: '测试课包',
      package_category: '体适能',
      age_range: '4-8岁',
      cover: 'https://example.com/pkg.png',
      class_count: 10,
      class_duration_minutes: 60,
      group_price_config: [
        { target_count: 2, price_fen: 800 },
        { target_count: 4, price_fen: 500 }
      ],
      location_district: '南山区',
      location_community: '深圳湾社区',
      location_detail: '会所二楼',
      coach_intro: '简介',
      description: '介绍',
      publish_time: '2026-04-21T10:00:00.000Z'
    },
    admin: { id: 'admin-1' }
  })

  const created = state.packages.at(-1)
  assert.equal(created.total_price, 2000)
})

test('admin package create derives supported people from group price config', async () => {
  const { packageAdminService, state } = loadPackageServicesWithState()

  const result = await packageAdminService.createAdminPackage({
    payload: {
      name: '测试课包',
      package_category: '体适能',
      age_range: '4-8岁',
      cover: 'https://example.com/pkg-new.png',
      class_count: 12,
      class_duration_minutes: 90,
      group_price_config: [
        { target_count: 6, price_fen: 30000 },
        { target_count: 4, price_fen: 45000 }
      ],
      location_district: '南山区',
      location_community: '深圳湾社区',
      location_detail: '会所二楼',
      coach_name: '教练A',
      coach_intro: '<p>简介</p>',
      description: '<p>介绍</p>',
      publish_time: '2026-04-21T10:00:00.000Z'
    },
    admin: { id: 'admin-1' },
    now: new Date('2026-04-20T08:00:00.000Z')
  })

  const created = state.packages.at(-1)

  assert.deepEqual(created.supported_people, [4, 6])
  assert.equal(created.age_range, '4-8岁')
  assert.deepEqual(created.group_price_config, [
    { target_count: 4, price_fen: 45000 },
    { target_count: 6, price_fen: 30000 }
  ])
  assert.equal(created.status, 2)
  assert.equal(result.status, 'pending')
})

test('admin package detail auto switches pending package to active after publish time', async () => {
  const { packageAdminService, state } = loadPackageServicesWithState()
  state.packages[0].status = 2
  state.packages[0].publish_time = '2026-04-21T10:00:00.000Z'
  state.packages[0].unpublish_time = '2026-04-23T10:00:00.000Z'

  const result = await packageAdminService.getAdminPackageDetail({
    packageId: 'pkg-1',
    now: new Date('2026-04-21T10:00:01.000Z')
  })

  assert.equal(result.status, 'active')
  assert.equal(result.status_text, '已上架')
})

test('admin package detail auto switches active package to inactive after unpublish time', async () => {
  const { packageAdminService, state } = loadPackageServicesWithState()
  state.packages[0].status = 1
  state.packages[0].publish_time = '2026-04-19T10:00:00.000Z'
  state.packages[0].unpublish_time = '2026-04-21T10:00:00.000Z'

  const result = await packageAdminService.getAdminPackageDetail({
    packageId: 'pkg-1',
    now: new Date('2026-04-21T10:00:01.000Z')
  })

  assert.equal(result.status, 'inactive')
  assert.equal(result.status_text, '已下架')
})

test('admin package offline updates package to inactive', async () => {
  const { packageAdminService, state } = loadPackageServicesWithState()

  const result = await packageAdminService.offlineAdminPackage({
    packageId: 'pkg-1',
    admin: { id: 'admin-1' },
    now: new Date('2026-04-21T08:00:00.000Z')
  })

  const updated = state.packages.find(item => item.id === 'pkg-1')
  assert.equal(updated.status, 0)
  assert.ok(updated.unpublish_time)
  assert.equal(result.status, 'inactive')
  assert.equal(state.adminLogWrites.at(-1).action, 'package_offline')
})

test('expired package group cleanup refunds success orders and payment records', async () => {
  const { packageGroupStore, state } = loadPackageServicesWithState()
  state.notificationEnqueueCalls = []

  const result = await packageGroupStore.cleanupExpiredPackageGroups({
    packageId: 'pkg-1',
    now: new Date('2026-04-19T08:00:00.000Z')
  })

  const expiredGroup = state.groups.find(item => item.id === 'pg-expired')
  const refundedOrders = state.orders.filter(item => item.package_group_id === 'pg-expired')
  const refundedPayments = state.paymentRecords.filter(item => item.package_group_id === 'pg-expired')

  assert.deepEqual(result.groupIds, ['pg-expired'])
  assert.deepEqual(result.refundedOrderIds.sort(), ['ord-expired-1', 'ord-expired-2'])
  assert.equal(expiredGroup.status, 'failed')
  assert.ok(refundedOrders.every(item => item.status === 'refunded'))
  assert.ok(refundedPayments.every(item => item.status === 'refunded'))
  assert.ok(refundedPayments.every(item => item.callback_status === 'REFUNDED'))
  assert.deepEqual(state.notificationEnqueueCalls, [
    {
      supabase: null,
      groupIds: ['pg-expired'],
      resultType: 'failed',
      now: new Date('2026-04-19T08:00:00.000Z')
    }
  ])
})
