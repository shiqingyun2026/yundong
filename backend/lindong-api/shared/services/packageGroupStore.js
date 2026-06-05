const { env } = require('../../config/env')
const { ordersRepository, packageGroupsRepository, paymentRecordsRepository } = require('../../repositories')
const { AUTO_REFUND_REASON } = require('../constants/refunds')
const { enqueueNotificationsForGroups } = require('./groupResultNotifications')
const { prepareCloudPayRefund } = require('./paymentShell')
const { createWechatPayRefund } = require('./wechatMiniProgram')

const markPaymentRecordRefundPending = async ({ orderId, outRefundNo = '', now = new Date() }) => {
  const paymentRecord = await paymentRecordsRepository.findPaymentRecordByOrderId(orderId)
  if (!paymentRecord) {
    return null
  }

  const existingCallbackPayload =
    paymentRecord.callback_payload && typeof paymentRecord.callback_payload === 'object'
      ? paymentRecord.callback_payload
      : {}
  const timestamp = now.toISOString()

  return paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, {
    status: 'refund_pending',
    callback_status: 'REFUND_PENDING',
    callback_payload: {
      ...existingCallbackPayload,
      refund_pending: {
        out_refund_no: outRefundNo,
        started_at: timestamp
      }
    },
    updated_at: timestamp
  })
}

const markPaymentRecordRefundFailed = async ({ orderId, reason = '', payload = {}, now = new Date() }) => {
  const paymentRecord = await paymentRecordsRepository.findPaymentRecordByOrderId(orderId)
  if (!paymentRecord) {
    return null
  }

  const existingCallbackPayload =
    paymentRecord.callback_payload && typeof paymentRecord.callback_payload === 'object'
      ? paymentRecord.callback_payload
      : {}
  const timestamp = now.toISOString()

  return paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, {
    status: 'refund_failed',
    callback_status: 'REFUND_FAILED',
    callback_payload: {
      ...existingCallbackPayload,
      refund_failure: {
        reason: `${reason || ''}`.trim(),
        failed_at: timestamp,
        payload
      }
    },
    updated_at: timestamp
  })
}

const startAutoRefundForPackageOrder = async ({ order, reason = AUTO_REFUND_REASON, now = new Date() }) => {
  await ordersRepository.updateOrder(order.id, {
    status: 'refund_pending',
    refund_reason: reason,
    updated_at: now
  })

  try {
    const prepared = await prepareCloudPayRefund({
      supabase: null,
      orderId: order.id,
      reason
    })

    const refundResult = await createWechatPayRefund({
      outTradeNo: prepared.outTradeNo,
      outRefundNo: prepared.outRefundNo,
      reason: prepared.refundDesc || AUTO_REFUND_REASON,
      totalFee: prepared.totalFee,
      refundFee: prepared.refundFee
    })

    await markPaymentRecordRefundPending({
      orderId: order.id,
      outRefundNo: prepared.outRefundNo,
      now
    })

    return {
      orderId: order.id,
      status: 'refund_pending',
      refundResult
    }
  } catch (error) {
    await ordersRepository.updateOrder(order.id, {
      status: 'refund_failed',
      updated_at: now
    })
    await markPaymentRecordRefundFailed({
      orderId: order.id,
      reason: error && error.message ? error.message : 'auto refund failed',
      payload: error && error.payload ? error.payload : {},
      now
    })

    return {
      orderId: order.id,
      status: 'refund_failed',
      error: error && error.message ? error.message : String(error)
    }
  }
}

const listPendingOrderIdsForPackage = async ({ userId, packageId }) => {
  if (!env.useMySqlRepositories) {
    return []
  }

  return ordersRepository.listPendingOrderIdsByUserAndPackage({
    userId,
    packageId
  })
}

const closePendingPackageOrdersByIds = async ({ orderIds = [], now = new Date() }) => {
  if (!env.useMySqlRepositories) {
    return []
  }

  return ordersRepository.closeOrdersByIds({
    orderIds,
    now
  })
}

const cleanupExpiredPackageGroups = async ({ packageId, packageIds = [], now = new Date() } = {}) => {
  if (!env.useMySqlRepositories) {
    return {
      groupIds: [],
      refundedOrderIds: [],
      refundPendingOrderIds: [],
      refundFailedOrderIds: [],
      closedOrderIds: []
    }
  }

  const normalizedPackageIds = packageId ? [packageId] : [...new Set((packageIds || []).filter(Boolean))]
  const expiredGroups = await packageGroupsRepository.listPackageGroups({
    packageIds: normalizedPackageIds,
    statuses: ['active'],
    beforeDeadline: now
  })

  const groupIds = expiredGroups.map(item => item.id).filter(Boolean)
  if (!groupIds.length) {
    return {
      groupIds: [],
      refundedOrderIds: [],
      refundPendingOrderIds: [],
      refundFailedOrderIds: [],
      closedOrderIds: []
    }
  }

  await packageGroupsRepository.bulkUpdatePackageGroupStatus({
    packageGroupIds: groupIds,
    status: 'failed'
  })
  await Promise.all(
    groupIds.map(groupId =>
      packageGroupsRepository.updatePackageGroup(groupId, {
        current_count: 0,
        status: 'failed'
      })
    )
  )

  const pendingOrders = (
    await Promise.all(
      groupIds.map(groupId =>
        ordersRepository.listOrdersByPackageGroupId({
          packageGroupId: groupId,
          status: 'pending'
        })
      )
    )
  ).flat()

  const successOrders = (
    await Promise.all(
      groupIds.map(groupId =>
        ordersRepository.listOrdersByPackageGroupId({
          packageGroupId: groupId,
          status: 'success'
        })
      )
    )
  ).flat()

  const closedOrders = await closePendingPackageOrdersByIds({
    orderIds: pendingOrders.map(item => item.id).filter(Boolean),
    now
  })

  const refundResults = await Promise.all(
    successOrders.map(order =>
      startAutoRefundForPackageOrder({
        order,
        reason: AUTO_REFUND_REASON,
        now
      })
    )
  )
  const refundPendingOrderIds = refundResults
    .filter(item => item.status === 'refund_pending')
    .map(item => item.orderId)
  const refundFailedOrderIds = refundResults
    .filter(item => item.status === 'refund_failed')
    .map(item => item.orderId)
  const recipientUserIdsByGroupId = successOrders.reduce((result, order) => {
    if (!order || !order.package_group_id || !order.user_id) {
      return result
    }

    if (!result[order.package_group_id]) {
      result[order.package_group_id] = []
    }

    result[order.package_group_id].push(order.user_id)
    return result
  }, {})

  await enqueueNotificationsForGroups({
    supabase: null,
    groupIds,
    resultType: 'failed',
    recipientUserIdsByGroupId,
    now
  })

  return {
    groupIds,
    refundedOrderIds: [],
    refundPendingOrderIds,
    refundFailedOrderIds,
    closedOrderIds: (closedOrders || []).map(item => item.id).filter(Boolean)
  }
}

module.exports = {
  cleanupExpiredPackageGroups,
  closePendingPackageOrdersByIds,
  listPendingOrderIdsForPackage,
  startAutoRefundForPackageOrder
}
