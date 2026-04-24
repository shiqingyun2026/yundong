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

const loadService = ({
  jobs = [],
  users = [],
  sendImpl = async () => {},
  useMySqlRepositories = true
} = {}) => {
  const servicePath = require.resolve(path.join(backendRoot, 'shared/services/groupResultNotificationDelivery.js'))
  const envPath = require.resolve(path.join(backendRoot, 'config/env.js'))
  const repositoriesPath = require.resolve(path.join(backendRoot, 'repositories/index.js'))
  const notificationsPath = require.resolve(path.join(backendRoot, 'shared/services/wechatMiniProgramNotifications.js'))

  delete require.cache[servicePath]
  delete require.cache[envPath]
  delete require.cache[repositoriesPath]
  delete require.cache[notificationsPath]

  const updates = []

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories
    }
  })

  mockModule('repositories/index.js', {
    groupResultNotificationJobsRepository: {
      listPendingNotificationJobs: async ({ limit }) => jobs.slice(0, limit),
      updateNotificationJobStatus: async payload => {
        updates.push(payload)
        return payload
      }
    },
    usersRepository: {
      listUsersByIds: async userIds => users.filter(user => userIds.includes(user.id))
    }
  })

  mockModule('shared/services/wechatMiniProgramNotifications.js', {
    sendGroupResultSubscribeMessage: sendImpl
  })

  const service = require(servicePath)
  return {
    ...service,
    updates
  }
}

test('group result notification delivery uses mysql repositories in mock mode', async () => {
  const pendingJobs = [
    {
      id: 'job-sent',
      user_id: 'user-1',
      template_id: 'tpl-1',
      page_path: '/pages/group/detail/index?packageGroupId=group-1',
      message_snapshot: {
        template_key: 'groupSuccess',
        group_course: '少儿体适能基础课(4人团)',
        course_start_time: '2026-04-27 10:00:00',
        course_address: '浦东新区 XX 运动中心',
        warm_tips: '拼团已成功，客服稍后将拉您进去课程微信群，请留意后续通知'
      }
    },
    {
      id: 'job-skipped',
      user_id: 'user-2',
      template_id: '',
      page_path: '/pages/group/detail/index?packageGroupId=group-2',
      message_snapshot: {
        template_key: 'groupFail',
        group_course: '少儿体适能基础课(4人团)',
        failed_reason: '拼团截止前未达到成团人数',
        warm_tips: '本次拼团未成功，系统将自动原路退款，请留意微信支付到账通知'
      }
    }
  ]

  const { processPendingGroupResultNotificationJobs, updates } = loadService({
    jobs: pendingJobs
  })

  const result = await processPendingGroupResultNotificationJobs({
    supabase: null,
    mode: 'mock'
  })

  assert.equal(result.deliveryMode, 'mock')
  assert.equal(result.total, 2)
  assert.equal(result.sent, 1)
  assert.equal(result.skipped, 1)
  assert.equal(result.failed, 0)
  assert.deepEqual(updates, [
    {
      jobId: 'job-sent',
      status: 'sent',
      sentAt: updates[0].sentAt,
      failureReason: ''
    },
    {
      jobId: 'job-skipped',
      status: 'skipped',
      sentAt: '',
      failureReason: 'template_id_missing'
    }
  ])
  assert.ok(updates[0].sentAt)
})

test('group result notification delivery uses mysql user repository in wechat mode', async () => {
  const pendingJobs = [
    {
      id: 'job-wechat',
      user_id: 'user-1',
      template_id: 'tpl-1',
      page_path: '/pages/group/detail/index?packageGroupId=group-1',
      message_snapshot: {
        template_key: 'groupSuccess',
        group_course: '少儿体适能基础课(4人团)',
        course_start_time: '2026-04-27 10:00:00',
        course_address: '浦东新区 XX 运动中心',
        warm_tips: '拼团已成功，客服稍后将拉您进去课程微信群，请留意后续通知'
      }
    }
  ]

  const sentPayloads = []
  const { processPendingGroupResultNotificationJobs, updates } = loadService({
    jobs: pendingJobs,
    users: [
      {
        id: 'user-1',
        openid: 'openid-1'
      }
    ],
    sendImpl: async payload => {
      sentPayloads.push(payload)
    }
  })

  const result = await processPendingGroupResultNotificationJobs({
    supabase: null,
    mode: 'wechat'
  })

  assert.equal(result.deliveryMode, 'wechat')
  assert.equal(result.sent, 1)
  assert.equal(sentPayloads.length, 1)
  assert.equal(sentPayloads[0].openId, 'openid-1')
  assert.equal(updates.length, 1)
  assert.equal(updates[0].jobId, 'job-wechat')
  assert.equal(updates[0].status, 'sent')
  assert.ok(updates[0].sentAt)
})

test('group result notification delivery marks failures from wechat sender', async () => {
  const { processPendingGroupResultNotificationJobs, updates } = loadService({
    jobs: [
      {
        id: 'job-failed',
        user_id: 'user-1',
        template_id: 'tpl-1',
        page_path: '/pages/group/detail/index?packageGroupId=group-1',
        message_snapshot: {
          template_key: 'groupSuccess',
          group_course: '少儿体适能基础课(4人团)',
          course_start_time: '2026-04-27 10:00:00',
          course_address: '浦东新区 XX 运动中心',
          warm_tips: '拼团已成功，客服稍后将拉您进去课程微信群，请留意后续通知'
        }
      }
    ],
    users: [
      {
        id: 'user-1',
        openid: 'openid-1'
      }
    ],
    sendImpl: async () => {
      throw new Error('wechat gateway unavailable')
    }
  })

  const result = await processPendingGroupResultNotificationJobs({
    supabase: null,
    mode: 'wechat'
  })

  assert.equal(result.deliveryMode, 'wechat')
  assert.equal(result.failed, 1)
  assert.equal(updates.length, 1)
  assert.deepEqual(updates[0], {
    jobId: 'job-failed',
    status: 'failed',
    sentAt: '',
    failureReason: 'wechat gateway unavailable'
  })
})
