const express = require('../lib/mini-express')

const authenticate = require('../middleware/auth')
const supabase = require('../utils/supabase')
const { isServiceError, markOrderPaymentSuccess } = require('../shared/services/groupOrders')
const { normalizeGroupStatus } = require('../shared/domain/groupRules')

const router = express.Router()

router.post('/mock-success', authenticate, async (req, res) => {
  const { orderId, groupId } = req.body || {}

  if (!orderId) {
    return res.status(400).json({
      message: 'orderId is required'
    })
  }

  try {
    const result = await markOrderPaymentSuccess({
      supabase,
      userId: req.userId,
      orderId,
      groupId
    })

    return res.json({
      orderId: result.order.id,
      courseId: result.order.course_id,
      groupId: result.groupId,
      groupStatus: normalizeGroupStatus(result.groupStatus),
      currentCount: result.currentCount,
      targetCount: result.targetCount
    })
  } catch (error) {
    console.error('[payments/mock-success] failed', {
      orderId,
      groupId,
      userId: req.userId,
      error
    })
    return res.status(isServiceError(error) ? error.status : 500).json({
      message: error.message || 'failed to mark payment success'
    })
  }
})

module.exports = router
