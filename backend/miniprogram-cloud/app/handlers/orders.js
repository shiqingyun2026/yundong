const supabase = require('../../../utils/supabase')
const { normalizeGroupStatus } = require('../../../shared/domain/groupRules')
const { createPendingOrder, isServiceError, markOrderPaymentSuccess } = require('../../../shared/services/groupOrders')
const { requireUserId } = require('./requestHelpers')

const normalizeServiceError = error => {
  if (isServiceError(error)) {
    error.statusCode = error.status
  }

  return error
}

const handleCreateOrder = async request => {
  const payload = request.data || {}

  if (!payload.courseId) {
    const error = new Error('courseId is required')
    error.statusCode = 400
    error.code = 400
    throw error
  }

  try {
    const { group, order } = await createPendingOrder({
      supabase,
      userId: requireUserId(request),
      courseId: payload.courseId,
      groupId: payload.groupId
    })

    return {
      orderId: order.id,
      courseId: order.course_id,
      groupId: order.group_id,
      amount: Number(order.amount) || 0,
      paymentParams: {},
      alreadyJoined: false,
      groupStatus: normalizeGroupStatus(group.status)
    }
  } catch (error) {
    throw normalizeServiceError(error)
  }
}

const handleMockPaymentSuccess = async request => {
  const payload = request.data || {}

  if (!payload.orderId) {
    const error = new Error('orderId is required')
    error.statusCode = 400
    error.code = 400
    throw error
  }

  try {
    const result = await markOrderPaymentSuccess({
      supabase,
      userId: requireUserId(request),
      orderId: payload.orderId,
      groupId: payload.groupId
    })

    return {
      orderId: result.order.id,
      courseId: result.order.course_id,
      groupId: result.groupId,
      groupStatus: normalizeGroupStatus(result.groupStatus),
      currentCount: result.currentCount,
      targetCount: result.targetCount
    }
  } catch (error) {
    throw normalizeServiceError(error)
  }
}

module.exports = {
  handleCreateOrder,
  handleMockPaymentSuccess
}
