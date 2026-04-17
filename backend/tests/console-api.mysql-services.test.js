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

const clone = value => JSON.parse(JSON.stringify(value))

const withMockedDate = async (isoString, run) => {
  const RealDate = Date
  const fixedTime = new RealDate(isoString).getTime()

  global.Date = class MockDate extends RealDate {
    constructor(...args) {
      if (!args.length) {
        super(fixedTime)
        return
      }

      super(...args)
    }

    static now() {
      return fixedTime
    }

    static parse(value) {
      return RealDate.parse(value)
    }

    static UTC(...args) {
      return RealDate.UTC(...args)
    }
  }

  try {
    return await run()
  } finally {
    global.Date = RealDate
  }
}

const loadMysqlConsoleServices = () => {
  const targets = [
    'config/env.js',
    'utils/supabase.js',
    'repositories/index.js',
    'utils/adminStore.js',
    'utils/courseLifecycle.js',
    'shared/services/groupOrders.js',
    'console-api/services/tencentMapService.js',
    'console-api/services/courseServiceHelpers.js',
    'console-api/services/ordersService.js',
    'console-api/services/groupsService.js',
    'console-api/services/coursesService.js',
    'console-api/services/logService.js',
    'console-api/services/dashboardService.js'
  ].map(relativePath => require.resolve(path.join(backendRoot, relativePath)))

  targets.forEach(modulePath => {
    delete require.cache[modulePath]
  })

  const state = {
    courses: clone([
      {
        id: 'course-1',
        name: '晨练课',
        course_category: '体适能',
        cover: 'https://example.com/course-1.png',
        images: ['https://example.com/course-1.png'],
        description: '课程介绍',
        age_limit: '6-8岁',
        address: '深圳湾公园',
        location_district: '南山区',
        location_community: '',
        location_detail: '深圳湾公园南门',
        longitude: 113.93,
        latitude: 22.53,
        group_price: 99,
        original_price: 199,
        publish_time: '2026-04-15T00:00:00.000Z',
        unpublish_time: '',
        deadline: '2026-04-20T10:00:00.000Z',
        start_time: '2026-04-25T10:00:00.000Z',
        end_time: '2026-04-25T11:00:00.000Z',
        default_target_count: 3,
        max_groups: 5,
        status: 0,
        coach_name: '教练A',
        coach_intro: '资深教练',
        coach_certificates: [],
        rules: '',
        created_at: '2026-04-15T00:00:00.000Z',
        updated_at: '2026-04-15T00:00:00.000Z',
        created_by: 'admin-1',
        updated_by: 'admin-1'
      },
      {
        id: 'course-2',
        name: '平衡课',
        course_category: '体适能',
        cover: 'https://example.com/course-2.png',
        images: ['https://example.com/course-2.png'],
        description: '课程介绍',
        age_limit: '8-10岁',
        address: '科技园活动室',
        location_district: '南山区',
        location_community: '',
        location_detail: '科技园活动室 201',
        longitude: 113.95,
        latitude: 22.54,
        group_price: 120,
        original_price: 220,
        publish_time: '2026-04-01T00:00:00.000Z',
        unpublish_time: '',
        deadline: '2026-04-13T10:00:00.000Z',
        start_time: '2026-04-16T10:00:00.000Z',
        end_time: '2026-04-16T11:00:00.000Z',
        default_target_count: 3,
        max_groups: 4,
        status: 0,
        coach_name: '教练B',
        coach_intro: '资深教练',
        coach_certificates: [],
        rules: '',
        created_at: '2026-04-01T00:00:00.000Z',
        updated_at: '2026-04-01T00:00:00.000Z',
        created_by: 'admin-1',
        updated_by: 'admin-1'
      }
    ]),
    groups: clone([
      {
        id: 'group-1',
        course_id: 'course-1',
        creator_id: 'user-1',
        status: 'active',
        current_count: 1,
        target_count: 3,
        expire_time: '2026-04-20T10:00:00.000Z',
        created_at: '2026-04-15T01:00:00.000Z',
        success_time: null
      },
      {
        id: 'group-2',
        course_id: 'course-1',
        creator_id: 'user-2',
        status: 'failed',
        current_count: 2,
        target_count: 3,
        expire_time: '2026-04-10T10:00:00.000Z',
        created_at: '2026-04-10T01:00:00.000Z',
        success_time: null
      },
      {
        id: 'group-3',
        course_id: 'course-2',
        creator_id: 'user-1',
        status: 'success',
        current_count: 3,
        target_count: 3,
        expire_time: '2026-04-14T10:00:00.000Z',
        created_at: '2026-04-14T01:00:00.000Z',
        success_time: '2026-04-14T02:10:00.000Z'
      }
    ]),
    members: clone([
      { group_id: 'group-1', user_id: 'user-1', joined_at: '2026-04-15T02:00:00.000Z' },
      { group_id: 'group-2', user_id: 'user-1', joined_at: '2026-04-10T02:00:00.000Z' },
      { group_id: 'group-2', user_id: 'user-2', joined_at: '2026-04-10T02:10:00.000Z' },
      { group_id: 'group-3', user_id: 'user-1', joined_at: '2026-04-14T02:00:00.000Z' },
      { group_id: 'group-3', user_id: 'user-2', joined_at: '2026-04-14T02:05:00.000Z' },
      { group_id: 'group-3', user_id: 'user-3', joined_at: '2026-04-14T02:10:00.000Z' }
    ]),
    orders: clone([
      {
        id: 'order-1',
        order_no: 'ORD-1',
        user_id: 'user-1',
        course_id: 'course-1',
        group_id: 'group-1',
        amount: 99,
        status: 'success',
        created_at: '2026-04-15T02:00:00.000Z',
        updated_at: '2026-04-15T02:00:00.000Z',
        pay_time: '2026-04-15T02:05:00.000Z',
        refund_time: null,
        refund_reason: '',
        refund_operator_id: null,
        transaction_id: ''
      },
      {
        id: 'order-2',
        order_no: 'ORD-2',
        user_id: 'user-2',
        course_id: 'course-1',
        group_id: 'group-2',
        amount: 99,
        status: 'success',
        created_at: '2026-04-10T02:00:00.000Z',
        updated_at: '2026-04-10T02:00:00.000Z',
        pay_time: '2026-04-10T02:05:00.000Z',
        refund_time: null,
        refund_reason: '',
        refund_operator_id: null,
        transaction_id: ''
      },
      {
        id: 'order-3',
        order_no: 'ORD-3',
        user_id: 'user-2',
        course_id: 'course-2',
        group_id: 'group-3',
        amount: 120,
        status: 'success',
        created_at: '2026-04-14T02:00:00.000Z',
        updated_at: '2026-04-14T02:00:00.000Z',
        pay_time: '2026-04-14T02:06:00.000Z',
        refund_time: null,
        refund_reason: '',
        refund_operator_id: null,
        transaction_id: ''
      },
      {
        id: 'order-4',
        order_no: 'ORD-4',
        user_id: 'user-3',
        course_id: 'course-2',
        group_id: 'group-3',
        amount: 120,
        status: 'success',
        created_at: '2026-04-14T02:08:00.000Z',
        updated_at: '2026-04-14T02:08:00.000Z',
        pay_time: '2026-04-14T02:10:00.000Z',
        refund_time: null,
        refund_reason: '',
        refund_operator_id: null,
        transaction_id: ''
      },
      {
        id: 'order-5',
        order_no: 'ORD-5',
        user_id: 'user-1',
        course_id: 'course-1',
        group_id: 'group-2',
        amount: 99,
        status: 'refunded',
        created_at: '2026-04-15T03:00:00.000Z',
        updated_at: '2026-04-15T03:00:00.000Z',
        pay_time: '2026-04-15T03:02:00.000Z',
        refund_time: '2026-04-15T03:10:00.000Z',
        refund_reason: '报名截止前未成团，系统自动退款',
        refund_operator_id: 'admin-1',
        transaction_id: ''
      }
    ]),
    users: clone([
      { id: 'user-1', openid: 'openid-1', nickname: '阿明', avatar_url: 'https://example.com/u1.png', created_at: '', updated_at: '' },
      { id: 'user-2', openid: 'openid-2', nickname: '小红', avatar_url: 'https://example.com/u2.png', created_at: '', updated_at: '' },
      { id: 'user-3', openid: 'openid-3', nickname: '小刚', avatar_url: 'https://example.com/u3.png', created_at: '', updated_at: '' }
    ]),
    adminUsers: clone([
      { id: 'admin-1', username: 'root', role: 'super_admin', status: 'active', last_login: '', created_at: '', updated_at: '' }
    ]),
    adminLogs: clone([
      {
        id: 1,
        admin_id: 'admin-1',
        action: 'admin_login',
        target_type: 'admin_user',
        target_id: 'admin-1',
        detail: { username: 'root' },
        ip: '127.0.0.1',
        created_at: '2026-04-15T01:00:00.000Z'
      }
    ]),
    adminLogWrites: [],
    rollbackCalls: [],
    lifecycleMap: {
      'course-1': { status: 1 },
      'course-2': { status: 3 }
    },
    singleCourseLifecycle: {
      'course-1': { status: 1 },
      'course-2': { status: 5 }
    }
  }

  const filterByIds = (list, ids, key = 'id') => list.filter(item => ids.includes(item[key]))

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('utils/supabase.js', {
    from() {
      throw new Error('supabase should not be requested in mysql mode')
    }
  })

  mockModule('utils/adminStore.js', {
    hasAdminLogTable: async () => true,
    writeAdminLog: async payload => {
      state.adminLogWrites.push(payload)
      return payload
    }
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
    getCourseLifecycleMap: async ids =>
      ids.reduce((result, id) => {
        result[id] = state.lifecycleMap[id] || { status: 0 }
        return result
      }, {}),
    getSingleCourseLifecycle: async id => state.singleCourseLifecycle[id] || { status: 0 },
    syncAllCourseLifecycles: async () => ({})
  })

  mockModule('shared/services/groupOrders.js', {
    rollbackGroupParticipationForOrder: async payload => {
      state.rollbackCalls.push(payload)
      return {
        membership_removed: true,
        previous_group_status: 'success',
        next_group_status: 'active',
        previous_group_count: 3,
        next_group_count: 2
      }
    }
  })

  mockModule('console-api/services/tencentMapService.js', {
    geocodeAddressWithTencentMap: async ({ district, detail }) => ({
      province: '广东省',
      city: '深圳市',
      district: district || '南山区',
      formatted_address: detail || '深圳市南山区',
      longitude: 113.93,
      latitude: 22.53
    }),
    searchPlacesWithTencentMap: async ({ keyword, district }) => [
      {
        id: 'poi-1',
        title: keyword,
        address: district ? `${district}${keyword}` : keyword,
        longitude: 113.93,
        latitude: 22.53
      }
    ]
  })

  mockModule('repositories/index.js', {
    coursesRepository: {
      listCourses: async ({ keyword = '', category = '', startDateField = '', startDate, endDate } = {}) =>
        state.courses
          .filter(item => !keyword || `${item.name || ''}`.includes(keyword))
          .filter(item => !category || item.course_category === category)
          .filter(item => !startDateField || !startDate || new Date(item[startDateField] || 0).getTime() >= new Date(startDate).getTime())
          .filter(item => !startDateField || !endDate || new Date(item[startDateField] || 0).getTime() <= new Date(endDate).getTime())
          .sort((left, right) => new Date(left.start_time || 0).getTime() - new Date(right.start_time || 0).getTime()),
      findCourseById: async id => state.courses.find(item => item.id === id) || null,
      findCoursesByIds: async ids => filterByIds(state.courses, ids),
      createCourse: async payload => {
        const created = {
          id: payload.id || `course-${state.courses.length + 1}`,
          ...payload
        }
        state.courses.push(created)
        return created
      },
      updateCourse: async (id, payload = {}) => {
        const index = state.courses.findIndex(item => item.id === id)
        if (index < 0) {
          return null
        }

        state.courses[index] = {
          ...state.courses[index],
          ...payload
        }

        return state.courses[index]
      }
    },
    groupsRepository: {
      listGroups: async ({ courseIds = [], statuses = [] } = {}) =>
        state.groups
          .filter(item => !courseIds.length || courseIds.includes(item.course_id))
          .filter(item => !statuses.length || statuses.includes(item.status)),
      listGroupsByCourseId: async courseId => state.groups.filter(item => item.course_id === courseId),
      findGroupById: async id => state.groups.find(item => item.id === id) || null
    },
    groupMembersRepository: {
      listGroupMembers: async ({ groupId, userId, groupIds = [] } = {}) =>
        state.members
          .filter(item => !groupId || item.group_id === groupId)
          .filter(item => !userId || item.user_id === userId)
          .filter(item => !groupIds.length || groupIds.includes(item.group_id))
          .sort((left, right) => new Date(left.joined_at || 0).getTime() - new Date(right.joined_at || 0).getTime())
    },
    ordersRepository: {
      listOrders: async ({ userId, courseId, groupId, status, statuses = [] } = {}) =>
        state.orders
          .filter(item => !userId || item.user_id === userId)
          .filter(item => !courseId || item.course_id === courseId)
          .filter(item => !groupId || item.group_id === groupId)
          .filter(item => !status || item.status === status)
          .filter(item => !statuses.length || statuses.includes(item.status))
          .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()),
      listOrdersByGroupId: async ({ groupId, status, statuses = [] } = {}) =>
        state.orders
          .filter(item => item.group_id === groupId)
          .filter(item => !status || item.status === status)
          .filter(item => !statuses.length || statuses.includes(item.status))
          .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()),
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
      }
    },
    usersRepository: {
      listUsersByIds: async ids => filterByIds(state.users, ids),
      listUsers: async ({ keyword = '' } = {}) =>
        state.users.filter(item => !keyword || item.id.includes(keyword) || `${item.nickname || ''}`.includes(keyword)),
      findUserById: async id => state.users.find(item => item.id === id) || null
    },
    adminUsersRepository: {
      listAdmins: async ({ keyword = '', role = '', status = '', from = 0, size = 10 } = {}) => {
        const list = state.adminUsers
          .filter(item => !keyword || `${item.username || ''}`.includes(keyword))
          .filter(item => !role || item.role === role)
          .filter(item => !status || item.status === status)

        return {
          total: list.length,
          list: list.slice(from, from + size)
        }
      },
      findAdminsByIds: async ids => filterByIds(state.adminUsers, ids)
    },
    adminLogRepository: {
      listAdminLogsWithFilters: async ({ adminIds = [], action = '', targetType = '', targetId = '', from = 0, size = 10 } = {}) => {
        const list = state.adminLogs
          .filter(item => !adminIds.length || adminIds.includes(item.admin_id))
          .filter(item => !action || item.action === action)
          .filter(item => !targetType || item.target_type === targetType)
          .filter(item => !targetId || `${item.target_id || ''}`.includes(targetId))

        return {
          total: list.length,
          list: list.slice(from, from + size)
        }
      }
    }
  })

  const services = {
    ordersService: require(path.join(backendRoot, 'console-api/services/ordersService.js')),
    groupsService: require(path.join(backendRoot, 'console-api/services/groupsService.js')),
    coursesService: require(path.join(backendRoot, 'console-api/services/coursesService.js')),
    logService: require(path.join(backendRoot, 'console-api/services/logService.js')),
    dashboardService: require(path.join(backendRoot, 'console-api/services/dashboardService.js'))
  }

  return {
    ...services,
    state
  }
}

test('console api mysql services use repositories for orders and logs', async () => {
  const { ordersService, logService, state } = loadMysqlConsoleServices()

  const listResult = await ordersService.listOrders({
    query: {
      nick_name: '阿明',
      status: '1'
    },
    admin: {
      id: 'admin-1'
    }
  })

  assert.equal(listResult.total, 1)
  assert.equal(listResult.list[0].order_no, 'ORD-1')
  assert.equal(listResult.list[0].course_title, '晨练课')

  const detail = await ordersService.getOrderDetail({
    orderId: 'order-1',
    admin: {
      id: 'admin-1'
    }
  })

  assert.equal(detail.user.nick_name, '阿明')
  assert.equal(detail.group.id, 'group-1')
  assert.equal(detail.group.status, 0)

  const refund = await ordersService.refundOrder({
    orderId: 'order-1',
    reason: '用户申请退款',
    admin: {
      id: 'admin-1'
    },
    ip: '127.0.0.1'
  })

  assert.equal(refund.id, 'order-1')
  assert.equal(refund.refund_reason, '用户申请退款')
  assert.equal(state.rollbackCalls.length, 1)
  assert.equal(state.rollbackCalls[0].supabase, null)
  assert.equal(state.orders.find(item => item.id === 'order-1').status, 'refunded')
  assert.equal(state.adminLogWrites.at(-1).action, 'order_refund')

  const logs = await logService.listAdminLogPage({
    query: {
      admin_username: 'roo'
    }
  })

  assert.equal(logs.total, 1)
  assert.equal(logs.list[0].admin_username, 'root')
  assert.equal(logs.list[0].action, 'admin_login')
})

test('console api mysql services use repositories for groups and courses', async () => {
  const { groupsService, coursesService, state } = loadMysqlConsoleServices()

  const groups = await groupsService.listGroups({
    query: {
      status: 'active'
    }
  })

  assert.equal(groups.total, 1)
  assert.equal(groups.summary.active, 1)
  assert.equal(groups.list[0].creator_name, '阿明')

  const groupOrders = await groupsService.listGroupOrders({
    groupId: 'group-3'
  })

  assert.equal(groupOrders.length, 2)
  assert.equal(groupOrders[0].user_nick_name, '小刚')

  const groupDetail = await groupsService.getGroupDetail({
    groupId: 'group-2'
  })

  assert.equal(groupDetail.course_title, '晨练课')
  assert.ok(groupDetail.anomalies.includes('失败团存在未退款订单'))

  const courses = await coursesService.listCourses({
    query: {
      keyword: '晨练'
    },
    admin: {
      id: 'admin-1'
    }
  })

  assert.equal(courses.total, 1)
  assert.equal(courses.list[0].title, '晨练课')

  const courseDetail = await coursesService.getCourseDetail({
    courseId: 'course-1',
    admin: {
      id: 'admin-1'
    }
  })

  assert.equal(courseDetail.title, '晨练课')
  assert.equal(courseDetail.status, 1)

  const courseGroups = await coursesService.listCourseGroups({
    courseId: 'course-1'
  })

  assert.equal(courseGroups.length, 2)
  assert.equal(courseGroups[0].creator_name, '阿明')

  const offline = await coursesService.offlineCourse({
    courseId: 'course-2',
    admin: {
      id: 'admin-1'
    },
    ip: '127.0.0.1'
  })

  assert.equal(offline.id, 'course-2')
  assert.ok(state.courses.find(item => item.id === 'course-2').unpublish_time)
  assert.equal(state.adminLogWrites.at(-1).action, 'course_offline')
})

test('console api mysql dashboard overview uses repositories', async () => {
  await withMockedDate('2026-04-15T12:00:00+08:00', async () => {
    const { dashboardService } = loadMysqlConsoleServices()

    const overview = await dashboardService.getDashboardOverview({
      query: {
        range: '7d'
      },
      admin: {
        id: 'admin-1'
      }
    })

    assert.equal(overview.range.key, '7d')
    assert.equal(overview.metrics.grouping_course_count.current, 1)
    assert.equal(overview.metrics.success_group_count.current, 1)
    assert.equal(overview.metrics.successful_group_amount.current, 240)
    assert.equal(overview.anomalies.failed_group_pending_refund_count, 1)
    assert.equal(overview.anomalies.auto_refund_order_count, 1)
  })
})
