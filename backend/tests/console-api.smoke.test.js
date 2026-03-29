const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = process.env.JWT_SECRET || 'console-api-smoke-secret'

const backendRoot = path.resolve(__dirname, '..')

const createConsoleApiError = ({ responseCode, statusCode, message }) => {
  const error = new Error(message)
  error.responseCode = responseCode
  error.statusCode = statusCode
  return error
}

const mockModule = (relativePath, exports) => {
  const modulePath = require.resolve(path.join(backendRoot, relativePath))
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

mockModule('console-api/services/authService.js', {
  loginAdmin: async ({ username, password }) => {
    if (!username || !password || password === 'bad-password') {
      throw createConsoleApiError({
        responseCode: 1001,
        statusCode: 400,
        message: '用户名或密码错误'
      })
    }

    return {
      token: 'stub-login-token',
      user: {
        id: 'admin-super',
        username: username || 'smoke-admin',
        role: 'super_admin'
      }
    }
  }
})

mockModule('console-api/services/accountService.js', {
  listAccountPage: async () => ({
    total: 1,
    page: 1,
    size: 10,
    total_pages: 1,
    list: [
      {
        id: 'admin-super',
        username: 'smoke-admin',
        role: 'super_admin',
        status: 'active',
        last_login_time: '',
        create_time: ''
      }
    ]
  }),
  createAccount: async () => ({ id: 'admin-created' }),
  updateAccountById: async () => ({ id: 'admin-updated' }),
  deleteAccountById: async () => ({ id: 'admin-deleted' })
})

mockModule('console-api/services/logService.js', {
  listAdminLogPage: async () => ({
    total: 1,
    total_pages: 1,
    page: 1,
    size: 10,
    list: [
      {
        id: 'log-1',
        admin_id: 'admin-super',
        admin_username: 'smoke-admin',
        admin_role: 'super_admin',
        action: 'admin_login',
        target_type: 'admin_user',
        target_id: 'admin-super',
        detail: {},
        ip: '127.0.0.1',
        created_at: '2026-03-29 10:00:00'
      }
    ]
  })
})

mockModule('console-api/services/uploadService.js', {
  createUploadSignature: async ({ filename }) => {
    if (!filename) {
      throw createConsoleApiError({
        responseCode: 5000,
        statusCode: 400,
        message: 'filename 和 contentType 不能为空'
      })
    }

    if (filename === 'explode.png') {
      throw new Error('storage unavailable')
    }

    return {
      bucket: 'course-images',
      path: 'course-cover/2026-03-29/file.png',
      token: 'upload-token',
      signed_url: '/storage/v1/signed',
      upload_url: 'https://example.com/storage/v1/signed',
      public_url: 'https://example.com/storage/v1/object/public/course-cover/2026-03-29/file.png'
    }
  }
})

mockModule('console-api/services/ordersService.js', {
  listOrders: async () => ({
    total: 1,
    page: 1,
    size: 10,
    total_pages: 1,
    list: [
      {
        id: 'order-1',
        order_no: 'ORD-001',
        user_nick_name: '测试用户',
        user_phone: '',
        course_title: '测试课程',
        amount: 99,
        status: 1,
        create_time: '2026-03-29 10:00:00',
        pay_time: '2026-03-29 10:05:00',
        refund_time: '',
        refund_reason: '',
        refund_type: ''
      }
    ]
  }),
  getOrderDetail: async () => ({
    id: 'order-1',
    order_no: 'ORD-001',
    user: { id: 'user-1', nick_name: '测试用户', phone: '', avatar_url: '' },
    course: { id: 'course-1', title: '测试课程', start_time: '', end_time: '', location_community: '', location_detail: '' },
    group: { id: 'group-1', current_count: 1, target_count: 3, status: 0 },
    amount: 99,
    status: 1,
    pay_time: '2026-03-29 10:05:00',
    refund_time: '',
    refund_reason: '',
    refund_type: '',
    create_time: '2026-03-29 10:00:00'
  }),
  refundOrder: async ({ orderId, reason }) => {
    if (!reason) {
      throw createConsoleApiError({
        responseCode: 2003,
        statusCode: 400,
        message: '退款原因不能为空'
      })
    }

    return {
      id: orderId,
      refund_time: '2026-03-29 10:10:00',
      refund_reason: reason
    }
  }
})

mockModule('console-api/services/groupsService.js', {
  listGroups: async () => ({
    total: 1,
    page: 1,
    size: 10,
    total_pages: 1,
    summary: { total: 1, active: 1, success: 0, failed: 0 },
    list: [
      {
        id: 'group-1',
        course_id: 'course-1',
        course_title: '测试课程',
        status: 'active',
        current_count: 1,
        target_count: 3,
        creator_name: '测试用户',
        expire_time: '2026-03-29 11:00:00',
        create_time: '2026-03-29 10:00:00'
      }
    ]
  }),
  listGroupOrders: async () => [
    {
      id: 'order-1',
      order_no: 'ORD-001',
      user_nick_name: '测试用户',
      amount: 99,
      status: 'success',
      create_time: '2026-03-29 10:00:00',
      pay_time: '2026-03-29 10:05:00',
      refund_time: '',
      refund_reason: '',
      refund_type: ''
    }
  ],
  getGroupDetail: async ({ groupId }) => {
    if (groupId === 'missing-group') {
      throw createConsoleApiError({
        responseCode: 2003,
        statusCode: 404,
        message: '拼团不存在'
      })
    }

    return {
      id: 'group-1',
      course_id: 'course-1',
      course_title: '测试课程',
      creator_name: '测试用户',
      status: 'active',
      current_count: 1,
      target_count: 3,
      expire_time: '2026-03-29 11:00:00',
      create_time: '2026-03-29 10:00:00',
      course_status: 1,
      course_status_text: '拼团中',
      publish_time: '',
      unpublish_time: '',
      deadline: '',
      start_time: '',
      end_time: '',
      refund_order_count: 0,
      paid_order_count: 1,
      rules: [],
      members: [],
      orders: [],
      anomalies: []
    }
  }
})

mockModule('console-api/services/dashboardService.js', {
  getDashboardOverview: async () => {
    await new Promise(resolve => setTimeout(resolve, 10))

    return {
      range: {
        key: 'today',
        label: '今日',
        days: 1,
        compare_label: '较昨日',
        start_date: '2026-03-29',
        end_date: '2026-03-29',
        display_text: '2026-03-29（今日）'
      },
      metrics: {
        grouping_course_count: { current: 1, previous: null, delta: null, direction: 'none' }
      },
      anomalies: {
        failed_group_pending_refund_count: 0,
        expired_active_group_count: 0,
        member_mismatch_group_count: 0,
        auto_refund_order_count: 0
      },
      note: 'smoke'
    }
  }
})

mockModule('console-api/services/coursesService.js', {
  geocodeCourseAddress: async () => ({
    formatted_address: '深圳市南山区测试地点',
    longitude: 113.93,
    latitude: 22.53
  }),
  listCourses: async () => ({
    total: 1,
    page: 1,
    size: 10,
    total_pages: 1,
    list: [
      {
        id: 'course-1',
        title: '测试课程',
        publish_time: '',
        unpublish_time: '',
        deadline: '',
        start_time: '',
        end_time: '',
        location_district: '南山区',
        location_detail: '测试地点',
        group_price: 99,
        original_price: 199,
        target_count: 3,
        max_groups: 5,
        status: 1,
        cover: 'https://example.com/course.png'
      }
    ]
  }),
  getCourseDetail: async ({ courseId }) => {
    if (courseId === 'missing-course') {
      throw createConsoleApiError({
        responseCode: 2001,
        statusCode: 404,
        message: '课程不存在'
      })
    }

    return {
      id: 'course-1',
      title: '测试课程',
      cover: 'https://example.com/course.png',
      description: '课程描述',
      age_range: '6-8岁',
      original_price: 199,
      group_price: 99,
      target_count: 3,
      max_groups: 5,
      publish_time: '',
      unpublish_time: '',
      start_time: '',
      end_time: '',
      location_district: '南山区',
      location_detail: '测试地点',
      longitude: 113.93,
      latitude: 22.53,
      deadline: '',
      coach_name: '教练A',
      coach_intro: '简介',
      coach_cert: [],
      rules: '',
      status: 1
    }
  },
  listCourseGroups: async () => [
    {
      id: 'group-1',
      course_id: 'course-1',
      status: 'active',
      current_count: 1,
      target_count: 3,
      creator_name: '测试用户',
      expire_time: '2026-03-29 11:00:00',
      create_time: '2026-03-29 10:00:00'
    }
  ],
  createCourse: async () => ({ id: 'course-created' }),
  updateCourse: async () => ({ id: 'course-updated' }),
  offlineCourse: async () => ({ id: 'course-offlined' })
})

const app = require(path.join(backendRoot, 'console-api/app.js'))

const createToken = role =>
  jwt.sign(
    {
      type: 'admin',
      adminId: role === 'super_admin' ? 'admin-super' : 'admin-normal',
      username: role === 'super_admin' ? 'smoke-admin' : 'smoke-operator',
      role
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )

const superAdminToken = createToken('super_admin')
const adminToken = createToken('admin')

const requestJson = async ({ method = 'GET', path: pathname, body, token } = {}) => {
  const headers = new Headers()

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await app.fetch(
    new Request(`http://127.0.0.1${pathname}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  )

  return {
    status: response.status,
    body: await response.json()
  }
}

test('console api smoke: login route returns ok envelope', async () => {
  const response = await requestJson({
    method: 'POST',
    path: '/api/admin/login',
    body: {
      username: 'smoke-admin',
      password: '123456'
    }
  })

  assert.equal(response.status, 200)
  assert.equal(response.body.code, 0)
  assert.equal(response.body.data.user.username, 'smoke-admin')
})

test('console api smoke: admin routes reject missing token', async () => {
  const response = await requestJson({
    method: 'GET',
    path: '/api/admin/orders'
  })

  assert.equal(response.status, 401)
  assert.equal(response.body.code, 1002)
})

test('console api smoke: accounts route requires super admin', async () => {
  const response = await requestJson({
    method: 'GET',
    path: '/api/admin/accounts',
    token: adminToken
  })

  assert.equal(response.status, 403)
  assert.equal(response.body.code, 1003)
})

test('console api smoke: key authenticated routes stay wired', async () => {
  const [accounts, logs, upload, courses, groups, groupOrders, refund, dashboard] = await Promise.all([
    requestJson({
      method: 'GET',
      path: '/api/admin/accounts',
      token: superAdminToken
    }),
    requestJson({
      method: 'GET',
      path: '/api/admin/logs',
      token: adminToken
    }),
    requestJson({
      method: 'POST',
      path: '/api/admin/upload/sign',
      token: adminToken,
      body: {
        filename: 'course.png',
        contentType: 'image/png',
        folder: 'course-cover'
      }
    }),
    requestJson({
      method: 'GET',
      path: '/api/admin/courses',
      token: adminToken
    }),
    requestJson({
      method: 'GET',
      path: '/api/admin/groups',
      token: adminToken
    }),
    requestJson({
      method: 'GET',
      path: '/api/admin/groups/group-1/orders',
      token: adminToken
    }),
    requestJson({
      method: 'POST',
      path: '/api/admin/orders/order-1/refund',
      token: adminToken,
      body: {
        reason: 'smoke refund'
      }
    }),
    requestJson({
      method: 'GET',
      path: '/api/admin/dashboard/overview',
      token: adminToken
    })
  ])

  assert.equal(accounts.status, 200)
  assert.equal(accounts.body.code, 0)
  assert.equal(accounts.body.data.list[0].username, 'smoke-admin')

  assert.equal(logs.status, 200)
  assert.equal(logs.body.code, 0)

  assert.equal(upload.status, 200)
  assert.equal(upload.body.code, 0)
  assert.equal(upload.body.data.bucket, 'course-images')

  assert.equal(courses.status, 200)
  assert.equal(courses.body.code, 0)
  assert.equal(courses.body.data.list[0].title, '测试课程')

  assert.equal(groups.status, 200)
  assert.equal(groups.body.code, 0)
  assert.equal(groups.body.data.list[0].id, 'group-1')

  assert.equal(groupOrders.status, 200)
  assert.equal(groupOrders.body.code, 0)
  assert.equal(groupOrders.body.data[0].order_no, 'ORD-001')

  assert.equal(refund.status, 200)
  assert.equal(refund.body.code, 0)
  assert.equal(refund.body.data.refund_reason, 'smoke refund')

  assert.equal(dashboard.status, 200)
  assert.equal(dashboard.body.code, 0)
  assert.equal(dashboard.body.data.range.key, 'today')
})

test('console api smoke: business errors keep declared status and code', async () => {
  const [badLogin, missingCourse, missingGroup, badRefund] = await Promise.all([
    requestJson({
      method: 'POST',
      path: '/api/admin/login',
      body: {
        username: 'smoke-admin',
        password: 'bad-password'
      }
    }),
    requestJson({
      method: 'GET',
      path: '/api/admin/courses/missing-course',
      token: adminToken
    }),
    requestJson({
      method: 'GET',
      path: '/api/admin/groups/missing-group',
      token: adminToken
    }),
    requestJson({
      method: 'POST',
      path: '/api/admin/orders/order-1/refund',
      token: adminToken,
      body: {
        reason: ''
      }
    })
  ])

  assert.equal(badLogin.status, 400)
  assert.equal(badLogin.body.code, 1001)
  assert.equal(badLogin.body.message, '用户名或密码错误')

  assert.equal(missingCourse.status, 404)
  assert.equal(missingCourse.body.code, 2001)
  assert.equal(missingCourse.body.message, '课程不存在')

  assert.equal(missingGroup.status, 404)
  assert.equal(missingGroup.body.code, 2003)
  assert.equal(missingGroup.body.message, '拼团不存在')

  assert.equal(badRefund.status, 400)
  assert.equal(badRefund.body.code, 2003)
  assert.equal(badRefund.body.message, '退款原因不能为空')
})

test('console api smoke: unexpected service errors are wrapped as 5000', async () => {
  const response = await requestJson({
    method: 'POST',
    path: '/api/admin/upload/sign',
    token: adminToken,
    body: {
      filename: 'explode.png',
      contentType: 'image/png',
      folder: 'course-cover'
    }
  })

  assert.equal(response.status, 500)
  assert.equal(response.body.code, 5000)
  assert.equal(response.body.message, 'storage unavailable')
})
