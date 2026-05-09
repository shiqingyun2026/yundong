const { ordersRepository, packageGroupsRepository } = require('../../repositories')
const { computePackageGroupStatusAfterRefund, PACKAGE_GROUP_STATUS } = require('../domain/packageGroupRules')
const { markPaymentRecordRefunded } = require('./paymentRecordStatus')
const { createPackageServiceError } = require('./packageServiceError')

const REFUND_EMPTY_GROUP_STATUS = {
  MANUAL: PACKAGE_GROUP_STATUS.CANCELED,
  AUTO_TIMEOUT: PACKAGE_GROUP_STATUS.FAILED
}

const resolveGroupStatusDuringRefundSettlement = ({ group, orders = [], emptyGroupStatus, now = new Date() }) => {
  const successOrders = orders.filter(item => item.status === 'success')
  const refundPendingOrders = orders.filter(item => item.status === 'refund_pending')
  const refundFailedOrders = orders.filter(item => item.status === 'refund_failed')
  const refundedOrders = orders.filter(item => item.status === 'refunded')

  if (refundPendingOrders.length > 0) {
    return {
      currentCount: successOrders.length + refundPendingOrders.length + refundFailedOrders.length,
      status: 'refund_pending'
    }
  }

  if (refundFailedOrders.length > 0 && successOrders.length <= 0) {
    return {
      currentCount: refundFailedOrders.length,
      status: 'refund_failed'
    }
  }

  if ((group.status === 'refund_pending' || group.status === 'refund_failed') && successOrders.length <= 0 && refundedOrders.length > 0) {
    return {
      currentCount: 0,
      status: emptyGroupStatus
    }
  }

  const nextCount = successOrders.length
  return {
    currentCount: nextCount,
    status: computePackageGroupStatusAfterRefund({
      group,
      currentCount: nextCount,
      emptyGroupStatus,
      now
    })
  }
}

const finalizePackageOrderRefund = async ({
  orderId,
  reason,
  operatorId = null,
  now = new Date(),
  emptyGroupStatus = REFUND_EMPTY_GROUP_STATUS.MANUAL
}) => {
  const order = await ordersRepository.findOrderById(orderId)
  if (!order) {
    throw createPackageServiceError(404, 2003, '订单不存在')
  }

  const updatedOrder = await ordersRepository.updateOrder(order.id, {
    status: 'refunded',
    refund_time: now,
    refund_reason: reason,
    refund_operator_id: operatorId,
    updated_at: now
  })

  const paymentRecord = await markPaymentRecordRefunded({
    orderId: order.id,
    reason,
    now
  })

  if (!order.package_group_id) {
    return {
      order: updatedOrder,
      group: null,
      paymentRecord,
      closedOrders: []
    }
  }

  const group = await packageGroupsRepository.findPackageGroupById(order.package_group_id)
  if (!group) {
    return {
      order: updatedOrder,
      group: null,
      paymentRecord,
      closedOrders: []
    }
  }

  const groupOrders = await ordersRepository.listOrdersByPackageGroupId({
    packageGroupId: group.id
  })
  const { currentCount: nextCount, status: nextStatus } = resolveGroupStatusDuringRefundSettlement({
    group,
    orders: groupOrders,
    emptyGroupStatus,
    now
  })

  const updatedGroup = await packageGroupsRepository.updatePackageGroup(group.id, {
    current_count: nextCount,
    status: nextStatus
  })

  let closedOrders = []
  if (nextCount <= 0) {
    const pendingOrders = await ordersRepository.listOrdersByPackageGroupId({
      packageGroupId: group.id,
      status: 'pending'
    })
    const pendingOrderIds = pendingOrders.map(item => item.id).filter(Boolean)
    if (pendingOrderIds.length) {
      const { closePendingPackageOrdersByIds } = require('./packageGroupStore')
      closedOrders = await closePendingPackageOrdersByIds({
        orderIds: pendingOrderIds,
        now
      })
    }
  }

  return {
    order: updatedOrder,
    group: updatedGroup,
    paymentRecord,
    closedOrders
  }
}

module.exports = {
  REFUND_EMPTY_GROUP_STATUS,
  finalizePackageOrderRefund
}
