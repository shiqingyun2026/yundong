const express = require('../lib/mini-express')

const { syncAllCourseLifecycles } = require('../utils/courseLifecycle')
const { ok, fail } = require('../console-api/routes/_helpers')
const supabase = require('../utils/supabase')
const { enqueueGroupResultNotifications } = require('../shared/services/groupResultNotifications')
const { processPendingGroupResultNotificationJobs } = require('../shared/services/groupResultNotificationDelivery')

const router = express.Router()

const validateCronSecret = req => {
  const expectedSecret = `${process.env.CRON_SECRET || ''}`.trim()
  const authorization = `${req.headers.authorization || ''}`.trim()
  const bearerPrefix = 'Bearer '
  const providedSecret = authorization.startsWith(bearerPrefix)
    ? authorization.slice(bearerPrefix.length).trim()
    : `${req.headers['x-cron-secret'] || ''}`.trim()

  if (!expectedSecret) {
    return {
      ok: false,
      reason: 'CRON_SECRET 未配置'
    }
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    return {
      ok: false,
      reason: '无权限调用内部接口'
    }
  }

  return {
    ok: true
  }
}

const handleCourseLifecycleSync = async (req, res) => {
  const validation = validateCronSecret(req)

  if (!validation.ok) {
    return fail(res, 1004, validation.reason, validation.reason.includes('未配置') ? 500 : 401)
  }

  try {
    const startedAt = new Date().toISOString()
    const lifecycleMap = await syncAllCourseLifecycles({
      now: req.body && req.body.now ? req.body.now : req.query.now
    })

    return ok(res, {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      course_count: Object.keys(lifecycleMap || {}).length,
      trigger_method: req.method
    })
  } catch (error) {
    return fail(res, 5001, error.message || '课程生命周期同步失败', 500)
  }
}

router.get('/course-lifecycle/sync', handleCourseLifecycleSync)
router.post('/course-lifecycle/sync', handleCourseLifecycleSync)

router.post('/group-result-notifications/enqueue', async (req, res) => {
  const validation = validateCronSecret(req)

  if (!validation.ok) {
    return fail(res, 1004, validation.reason, validation.reason.includes('未配置') ? 500 : 401)
  }

  const groupId = (req.body && req.body.groupId) || (req.query && req.query.groupId) || ''
  const resultType = (req.body && req.body.resultType) || (req.query && req.query.resultType) || ''

  if (!groupId || !resultType) {
    return fail(res, 4001, 'groupId 和 resultType 必填', 400)
  }

  try {
    const result = await enqueueGroupResultNotifications({
      supabase,
      groupId,
      resultType,
      now: req.body && req.body.now ? new Date(req.body.now) : new Date()
    })

    return ok(res, result)
  } catch (error) {
    return fail(res, 5002, error.message || '拼团结果通知任务生成失败', 500)
  }
})

router.post('/group-result-notifications/process', async (req, res) => {
  const validation = validateCronSecret(req)

  if (!validation.ok) {
    return fail(res, 1004, validation.reason, validation.reason.includes('未配置') ? 500 : 401)
  }

  try {
    const result = await processPendingGroupResultNotificationJobs({
      supabase,
      limit: (req.body && req.body.limit) || (req.query && req.query.limit),
      mode: (req.body && req.body.mode) || (req.query && req.query.mode)
    })

    return ok(res, result)
  } catch (error) {
    return fail(res, 5003, error.message || '拼团结果通知任务处理失败', 500)
  }
})

module.exports = router
