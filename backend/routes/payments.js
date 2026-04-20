const express = require('../lib/mini-express')

const { env } = require('../config/env')
const authenticate = require('../middleware/auth')
const { ordersRepository } = require('../repositories')
const { getSupabaseClient } = require('../utils/getSupabaseClient')
const { isServiceError, markOrderPaymentSuccess } = require('../shared/services/groupOrders')
const { markPackageOrderPaymentSuccess } = require('../shared/services/packageOrders')
const { isPackageServiceError } = require('../shared/services/packageServiceError')
const { normalizeGroupStatus } = require('../shared/domain/groupRules')
const { prepareOrderPayment, handleWechatPaymentCallback, markPaymentRecordPaid } = require('../shared/services/paymentShell')
const { verifyWechatPayCallbackSignature } = require('../shared/services/wechatMiniProgram')
const { logMiniProgramIdentity } = require('../shared/utils/miniProgramIdentityLog')

const router = express.Router()
const resolveSupabase = () => (env.useMySqlRepositories ? null : getSupabaseClient())

router.post('/prepare', authenticate, async (req, res) => {
  const { orderId } = req.body || {}

  if (!orderId) {
    return res.status(400).json({
      message: 'orderId is required'
    })
  }

  try {
    logMiniProgramIdentity({
      route: req.path,
      source: req.authSource,
      headers: req.headers,
      userId: req.userId,
      extra: {
        orderId
      }
    })

    return res.json(
      await prepareOrderPayment({
        supabase: resolveSupabase(),
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
    logMiniProgramIdentity({
      route: req.path,
      source: req.authSource,
      headers: req.headers,
      userId: req.userId,
      extra: {
        orderId,
        hasGroupId: !!groupId
      }
    })

    const existingOrder =
      env.useMySqlRepositories && ordersRepository && typeof ordersRepository.findOrderForUser === 'function'
        ? await ordersRepository.findOrderForUser({ userId: req.userId, orderId })
        : null
    const isPackageOrder = existingOrder && Number(existingOrder.order_type) === 2
    const result = isPackageOrder
      ? await markPackageOrderPaymentSuccess({
          supabase: resolveSupabase(),
          userId: req.userId,
          orderId
        })
      : await markOrderPaymentSuccess({
          supabase: resolveSupabase(),
          userId: req.userId,
          orderId,
          groupId
        })

    await markPaymentRecordPaid({
      supabase: resolveSupabase(),
      orderId
    })

    if (isPackageOrder) {
      return res.json({
        code: 0,
        message: 'ok',
        data: {
          orderId: result.order.id,
          status: result.status,
          packageGroupId: result.packageGroupId,
          groupStatus: result.groupStatus
        }
      })
    }

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
    const status = isPackageServiceError(error) ? error.status : isServiceError(error) ? error.status : 500
    return res.status(status).json({
      message: error.message || 'failed to mark payment success'
    })
  }
})

router.post('/notify/wechat', async (req, res) => {
  try {
    const signatureVerified = verifyWechatPayCallbackSignature({
      timestamp: req.headers['wechatpay-timestamp'],
      nonce: req.headers['wechatpay-nonce'],
      signature: req.headers['wechatpay-signature'],
      rawBody: req.rawBody || ''
    })

    if (!signatureVerified) {
      return res.status(401).json({
        code: 'FAIL',
        message: 'invalid wechatpay signature'
      })
    }

    const result = await handleWechatPaymentCallback({
      supabase: resolveSupabase(),
      payload: req.body || {}
    })

    return res.json({
      code: 'SUCCESS',
      message: '成功',
      ...result
    })
  } catch (error) {
    console.error('[payments/notify/wechat] failed', {
      payload: req.body || {},
      error
    })
    return res.status(isServiceError(error) ? error.status : 500).json({
      code: 'FAIL',
      message: error.message || 'failed to process payment callback'
    })
  }
})

module.exports = router
