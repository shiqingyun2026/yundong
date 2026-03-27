const express = require('express')

const { syncAllCourseLifecycles } = require('../utils/courseLifecycle')
const { ok, fail } = require('./admin/_helpers')

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

module.exports = router
