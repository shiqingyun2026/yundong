const { ordersRepository, packageGroupsRepository } = require('../../repositories')
const { computePackageGroupStatusAfterRefund, PACKAGE_GROUP_STATUS } = require('../domain/packageGroupRules')
const { markPaymentRecordRefunded } = require('./paymentRecordStatus')
const { createPackageServiceError } = require('./packageServiceError')

const REFUND_EMPTY_GROUP_STATUS = {
  MANUAL: PACKAGE_GROUP_STATUS.CANCELED,
  AUTO_TIMEOUT: PACKAGE_GROUP_STATUS.FAILED
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

  const remainingSuccessOrders = await ordersRepository.listOrdersByPackageGroupId({
    packageGroupId: group.id,
    status: 'success'
  })
  const nextCount = remainingSuccessOrders.length
  const nextStatus = computePackageGroupStatusAfterRefund({
    group,
    currentCount: nextCount,
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
