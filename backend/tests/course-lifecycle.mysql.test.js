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

const loadCourseLifecycle = ({
  courses = [],
  groups = [],
  orders = [],
  adminLogCalls = [],
  useMySqlRepositories = true
} = {}) => {
  const targetPaths = [
    'utils/courseLifecycle.js',
    'config/env.js',
    'repositories/index.js',
    'utils/adminStore.js',
    'utils/getSupabaseClient.js'
  ].map(relativePath => require.resolve(path.join(backendRoot, relativePath)))

  targetPaths.forEach(modulePath => {
    delete require.cache[modulePath]
  })

  const updatedCourseStatuses = []
  const updatedGroupStatuses = []
  const updatedOrders = []

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories
    }
  })

  mockModule('repositories/index.js', {
    coursesRepository: {
      findCoursesByIds: async ids => courses.filter(course => ids.includes(course.id)),
      listCourses: async () => courses,
      updateCourseStatus: async (id, status) => {
        updatedCourseStatuses.push({ id, status })
        return { id, status }
      }
    },
    groupsRepository: {
      listGroups: async ({ courseIds = [] } = {}) => groups.filter(group => courseIds.includes(group.course_id)),
      bulkUpdateGroupStatus: async ({ groupIds = [], status }) => {
        updatedGroupStatuses.push({ groupIds, status })
        return groupIds.map(id => ({ id, status }))
      }
    },
    ordersRepository: {
      listOrders: async ({ courseId, statuses = [] } = {}) =>
        orders.filter(order => order.course_id === courseId && (!statuses.length || statuses.includes(order.status))),
      updateOrder: async (id, payload) => {
        updatedOrders.push({ id, payload })
        return { id, ...payload }
      }
    }
  })

  mockModule('utils/adminStore.js', {
    writeAdminLog: async payload => {
      adminLogCalls.push(payload)
    }
  })

  mockModule('utils/getSupabaseClient.js', {
    getSupabaseClient: () => {
      throw new Error('supabase should not be requested in mysql mode')
    }
  })

  const lifecycle = require(path.join(backendRoot, 'utils/courseLifecycle.js'))

  return {
    ...lifecycle,
    updatedCourseStatuses,
    updatedGroupStatuses,
    updatedOrders
  }
}

test('course lifecycle sync in mysql mode does not require supabase client', async () => {
  const adminLogCalls = []
  const {
    syncAllCourseLifecycles,
    updatedCourseStatuses,
    updatedGroupStatuses,
    updatedOrders
  } = loadCourseLifecycle({
    courses: [
      {
        id: 'course-1',
        publish_time: '2026-04-15T08:00:00+08:00',
        deadline: '2026-04-15T09:00:00+08:00',
        start_time: '2026-04-16T10:00:00+08:00',
        end_time: '2026-04-16T12:00:00+08:00',
        unpublish_time: null,
        status: 1
      }
    ],
    groups: [
      {
        id: 'group-1',
        course_id: 'course-1',
        status: 'active'
      }
    ],
    orders: [
      {
        id: 'order-pending',
        course_id: 'course-1',
        status: 'pending'
      },
      {
        id: 'order-success',
        course_id: 'course-1',
        status: 'success'
      }
    ],
    adminLogCalls
  })

  const result = await syncAllCourseLifecycles({
    now: new Date('2026-04-15T10:00:00+08:00'),
    operatorId: 'admin-1'
  })

  assert.equal(result['course-1'].status, 2)
  assert.deepEqual(updatedCourseStatuses, [{ id: 'course-1', status: 2 }])
  assert.deepEqual(updatedGroupStatuses, [{ groupIds: ['group-1'], status: 'failed' }])
  assert.equal(updatedOrders.length, 2)
  assert.equal(adminLogCalls.length, 2)
  assert.equal(adminLogCalls[0].action, 'course_auto_refund')
  assert.equal(adminLogCalls[1].action, 'course_status_sync')
})
