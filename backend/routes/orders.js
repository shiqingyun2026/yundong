const express = require('../lib/mini-express')

const authenticate = require('../middleware/auth')
const supabase = require('../utils/supabase')
const { createPendingOrder, isServiceError } = require('../shared/services/groupOrders')
const { normalizeGroupStatus } = require('../shared/domain/groupRules')

const router = express.Router()

router.post('/', authenticate, async (req, res) => {
  const { courseId, groupId } = req.body || {}

  if (!courseId) {
    return res.status(400).json({
      message: 'courseId is required'
    })
  }

  try {
    const { group, order } = await createPendingOrder({
      supabase,
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

module.exports = router
