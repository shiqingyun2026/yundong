const { env } = require('../../config/env')
const { ordersRepository, packageGroupsRepository, paymentRecordsRepository } = require('../../repositories')
const { AUTO_REFUND_REASON } = require('../constants/refunds')
const { PACKAGE_GROUP_STATUS, computePackageGroupDeadlineStatus } = require('../domain/packageGroupRules')
const { enqueueNotificationsForGroups } = require('./groupResultNotifications')
const { prepareCloudPayRefund } = require('./paymentShell')
const { computeFirstPackageClassTime } = require('./packageSchedule')
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
      successGroupIds: [],
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
      successGroupIds: [],
      refundedOrderIds: [],
      refundPendingOrderIds: [],
      refundFailedOrderIds: [],
      closedOrderIds: []
    }
  }

  const successGroups = expiredGroups.filter(group =>
    computePackageGroupDeadlineStatus({
      currentCount: group.current_count,
      targetCount: group.target_count,
      minSuccessCount: group.min_success_count,
      deadline: group.deadline,
      now
    }) === PACKAGE_GROUP_STATUS.SUCCESS
  )
  const successGroupIds = successGroups.map(item => item.id).filter(Boolean)
  const failedGroupIds = groupIds.filter(groupId => !successGroupIds.includes(groupId))

  await Promise.all(
    successGroups.map(group => {
      const firstClassTime = computeFirstPackageClassTime({
        successTime: now,
        scheduleConfig: group.schedule_config
      })

      return packageGroupsRepository.updatePackageGroup(group.id, {
        status: 'success',
        success_time: now,
        first_class_time: firstClassTime || group.first_class_time || null
      })
    })
  )

  if (failedGroupIds.length) {
    await packageGroupsRepository.bulkUpdatePackageGroupStatus({
      packageGroupIds: failedGroupIds,
      status: 'failed'
    })
    await Promise.all(
      failedGroupIds.map(groupId =>
        packageGroupsRepository.updatePackageGroup(groupId, {
          current_count: 0,
          status: 'failed'
        })
      )
    )
  }

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
      failedGroupIds.map(groupId =>
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
    groupIds: failedGroupIds,
    resultType: 'failed',
    recipientUserIdsByGroupId,
    now
  })

  if (successGroupIds.length) {
    const successOrders = (
      await Promise.all(
        successGroupIds.map(groupId =>
          ordersRepository.listOrdersByPackageGroupId({
            packageGroupId: groupId,
            status: 'success'
          })
        )
      )
    ).flat()
    const successRecipientUserIdsByGroupId = successOrders.reduce((result, order) => {
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
      groupIds: successGroupIds,
      resultType: 'success',
      recipientUserIdsByGroupId: successRecipientUserIdsByGroupId,
      now
    })
  }

  return {
    groupIds: failedGroupIds,
    successGroupIds,
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
