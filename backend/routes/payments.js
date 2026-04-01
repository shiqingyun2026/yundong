const express = require('../lib/mini-express')

const authenticate = require('../middleware/auth')
const supabase = require('../utils/supabase')
const { isServiceError, markOrderPaymentSuccess } = require('../shared/services/groupOrders')
const { normalizeGroupStatus } = require('../shared/domain/groupRules')
const { prepareOrderPayment, handleWechatPaymentCallback, markPaymentRecordPaid } = require('../shared/services/paymentShell')

const router = express.Router()

router.post('/prepare', authenticate, async (req, res) => {
  const { orderId } = req.body || {}

  if (!orderId) {
    return res.status(400).json({
      message: 'orderId is required'
    })
  }

  try {
    return res.json(
      await prepareOrderPayment({
        supabase,
        userId: req.userId,
        orderId
      })
    )
  } catch (error) {
    console.error('[payments/prepare] failed', {
      orderId,
      userId: req.userId,
      error
    })
    return res.status(isServiceError(error) ? error.status : 500).json({
      message: error.message || 'failed to prepare payment'
    })
  }
})

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

    await markPaymentRecordPaid({
      supabase,
      orderId
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

router.post('/notify/wechat', async (req, res) => {
  try {
    const result = await handleWechatPaymentCallback({
      supabase,
      payload: req.body || {}
    })

    return res.json({
      ok: true,
      ...result
    })
  } catch (error) {
    console.error('[payments/notify/wechat] failed', {
      payload: req.body || {},
      error
    })
    return res.status(isServiceError(error) ? error.status : 500).json({
      message: error.message || 'failed to process payment callback'
    })
  }
})

module.exports = router
