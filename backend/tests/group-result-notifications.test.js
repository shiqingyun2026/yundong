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

const loadService = ({ deliveryImpl, packageOverrides = {}, groupOverrides = {} } = {}) => {
  const servicePath = require.resolve(path.join(backendRoot, 'shared/services/groupResultNotifications.js'))
  const envPath = require.resolve(path.join(backendRoot, 'config/env.js'))
  const repositoriesPath = require.resolve(path.join(backendRoot, 'repositories/index.js'))
  const deliveryPath = require.resolve(path.join(backendRoot, 'shared/services/groupResultNotificationDelivery.js'))
  const packageSchedulePath = require.resolve(path.join(backendRoot, 'shared/services/packageSchedule.js'))

  delete require.cache[servicePath]
  delete require.cache[envPath]
  delete require.cache[repositoriesPath]
  delete require.cache[deliveryPath]
  delete require.cache[packageSchedulePath]

  const createdPayloads = []
  const deliveryCalls = []

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackageById: async packageId => ({
        id: packageId,
        name: '少儿体适能基础课',
        location_district: '南山区',
        location_community: '科技园',
        location_detail: '邻动运动馆',
        ...packageOverrides
      })
    },
    groupResultNotificationJobsRepository: {
      listExistingNotificationJobs: async () => [],
      createNotificationJobs: async payload => {
        createdPayloads.push(...payload)
        return payload.map((item, index) => ({
          id: `job-${index + 1}`,
          ...item
        }))
      }
    },
    groupResultSubscriptionsRepository: {
      listSubscriptionsByGroupAndUsers: async () => [
        {
          user_id: 'user-1',
          template_id: 'tpl-success',
          requested_at: '2026-05-09T12:00:00.000Z'
        }
      ]
    },
    ordersRepository: {
      listOrdersByPackageGroupId: async () => [
        {
          user_id: 'user-1'
        }
      ]
    },
    packageGroupsRepository: {
      findPackageGroupById: async groupId => ({
        id: groupId,
        package_id: 'package-1',
        status: 'success',
        target_count: 2,
        first_class_time: '2026-05-16T10:00:00.000Z',
        ...groupOverrides
      })
    }
  })

  mockModule('shared/services/groupResultNotificationDelivery.js', {
    processPendingGroupResultNotificationJobs: async payload => {
      deliveryCalls.push(payload)
      if (deliveryImpl) {
        return deliveryImpl(payload)
      }
      return {
        deliveryMode: 'wechat',
        total: 1,
        sent: 1,
        failed: 0,
        skipped: 0,
        jobs: [
          {
            id: 'job-1',
            status: 'sent',
            reason: ''
          }
        ]
      }
    }
  })

  mockModule('shared/services/packageSchedule.js', {
    formatPackageDateTime: value => value
  })

  return {
    ...require(servicePath),
    createdPayloads,
    deliveryCalls
  }
}

test('enqueue group result notifications immediately processes newly created jobs', async () => {
  const { enqueueGroupResultNotifications, createdPayloads, deliveryCalls } = loadService()

  const result = await enqueueGroupResultNotifications({
    supabase: null,
    groupId: 'group-1',
    resultType: 'success',
    now: new Date('2026-05-09T12:30:00.000Z')
  })

  assert.equal(result.createdCount, 1)
  assert.equal(result.skippedCount, 0)
  assert.equal(result.immediateDelivery.sent, 1)
  assert.equal(createdPayloads.length, 1)
  assert.equal(createdPayloads[0].status, 'pending')
  assert.equal(createdPayloads[0].page_path, '/pages/mine/index')
  assert.equal(createdPayloads[0].message_snapshot.template_key, 'groupSuccess')
  assert.equal(createdPayloads[0].message_snapshot.course_address, '科技园')
  assert.equal(createdPayloads[0].message_snapshot.warm_tips, '客服稍后将联系您，请保持通话畅通')
  assert.equal(deliveryCalls.length, 1)
  assert.equal(deliveryCalls[0].supabase, null)
  assert.equal(deliveryCalls[0].limit, 20)
})

test('enqueue group result notifications only uses community field for course address', async () => {
  const { enqueueGroupResultNotifications, createdPayloads } = loadService({
    packageOverrides: {
      location_province: '广东省',
      location_city: '深圳市',
      location_district: '南山区',
      location_community: '科技园社区',
      location_detail: '广东省深圳市南山区科技园社区 邻动运动馆'
    }
  })

  const result = await enqueueGroupResultNotifications({
    supabase: null,
    groupId: 'group-1',
    resultType: 'success',
    now: new Date('2026-05-09T12:30:00.000Z')
  })

  assert.equal(result.createdCount, 1)
  assert.equal(createdPayloads.length, 1)
  assert.equal(createdPayloads[0].message_snapshot.course_address, '科技园社区')
})

test('enqueue group result notifications keeps job creation when immediate delivery throws', async () => {
  const { enqueueGroupResultNotifications, createdPayloads, deliveryCalls } = loadService({
    deliveryImpl: async () => {
      throw new Error('wechat access token unavailable')
    }
  })

  const result = await enqueueGroupResultNotifications({
    supabase: null,
    groupId: 'group-1',
    resultType: 'success',
    now: new Date('2026-05-09T12:30:00.000Z')
  })

  assert.equal(result.createdCount, 1)
  assert.equal(result.immediateDelivery.failed, 1)
  assert.equal(result.immediateDelivery.error, 'wechat access token unavailable')
  assert.equal(createdPayloads.length, 1)
  assert.equal(deliveryCalls.length, 1)
})

test('failed notifications can use explicit recipient user ids after orders leave success status', async () => {
  const { enqueueGroupResultNotifications, createdPayloads } = loadService({
    groupOverrides: {
      status: 'failed'
    },
    packageOverrides: {
      name: '少儿体适能周末班'
    }
  })

  const result = await enqueueGroupResultNotifications({
    supabase: null,
    groupId: 'group-1',
    resultType: 'failed',
    explicitRecipientUserIds: ['user-1'],
    now: new Date('2026-05-09T12:30:00.000Z')
  })

  assert.equal(result.createdCount, 1)
  assert.equal(result.skippedCount, 0)
  assert.equal(createdPayloads.length, 1)
  assert.equal(createdPayloads[0].user_id, 'user-1')
  assert.equal(createdPayloads[0].result_type, 'failed')
  assert.equal(createdPayloads[0].message_snapshot.template_key, 'groupFail')
})
