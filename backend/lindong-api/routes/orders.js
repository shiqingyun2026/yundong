const express = require('../lib/mini-express')

const { env } = require('../config/env')
const authenticate = require('../middleware/auth')
const { getSupabaseClient } = require('../utils/getSupabaseClient')
const { createPendingOrder, isServiceError } = require('../shared/services/groupOrders')
const { normalizeGroupStatus } = require('../shared/domain/groupRules')
const { getOrderPaymentStatus } = require('../shared/services/paymentShell')
const { logMiniProgramIdentity } = require('../shared/utils/miniProgramIdentityLog')

const router = express.Router()
const resolveSupabase = () => (env.useMySqlRepositories ? null : getSupabaseClient())

router.post('/', authenticate, async (req, res) => {
  const { courseId, groupId } = req.body || {}

  if (!courseId) {
    return res.status(400).json({
      message: 'courseId is required'
    })
  }

  try {
    logMiniProgramIdentity({
      route: req.path,
      source: req.authSource,
      headers: req.headers,
      userId: req.userId,
      extra: {
        courseId,
        hasGroupId: !!groupId
      }
    })

    const { group, order } = await createPendingOrder({
      supabase: resolveSupabase(),
      userId: req.userId,
      courseId,
      groupId
    })

    return res.json({
      orderId: order.id,
      courseId: order.course_id,
      groupId: order.group_id,
      amount: Number(order.amount) || 0,
      paymentParams: {},
      alreadyJoined: false,
      groupStatus: normalizeGroupStatus(group.status)
    })
  } catch (error) {
    console.error('[orders] failed to create order', {
      userId: req.userId,
      courseId,
      groupId,
      error
    })
    return res.status(isServiceError(error) ? error.status : 500).json({
      message: error.message || 'failed to create order'
    })
  }
})

router.get('/:id', authenticate, async (req, res) => {
  try {
    logMiniProgramIdentity({
      route: req.path,
      source: req.authSource,
      headers: req.headers,
      userId: req.userId,
      extra: {
        orderId: req.params.id
      }
    })

    return res.json(
      await getOrderPaymentStatus({
        supabase: resolveSupabase(),
        userId: req.userId,
        orderId: req.params.id
      })
    )
  } catch (error) {
    console.error('[orders/:id] failed to fetch order detail', {
      orderId: req.params.id,
      userId: req.userId,
      error
    })
    return res.status(isServiceError(error) ? error.status : 500).json({
      message: error.message || 'failed to fetch order detail'
    })
  }
})

module.exports = router
