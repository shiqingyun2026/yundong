const { env } = require('../../config/env')
const { ordersRepository, packageGroupsRepository } = require('../../repositories')
const { AUTO_REFUND_REASON } = require('../constants/refunds')
const { enqueueNotificationsForGroups } = require('./groupResultNotifications')

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
      closedOrderIds: []
    }
  }

  await packageGroupsRepository.bulkUpdatePackageGroupStatus({
    packageGroupIds: groupIds,
    status: 'failed'
  })

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

  const { finalizePackageOrderRefund, REFUND_EMPTY_GROUP_STATUS } = require('./packageRefundService')
  await Promise.all(
    successOrders.map(order =>
      finalizePackageOrderRefund({
        orderId: order.id,
        reason: AUTO_REFUND_REASON,
        now,
        emptyGroupStatus: REFUND_EMPTY_GROUP_STATUS.AUTO_TIMEOUT
      })
    )
  )

  await enqueueNotificationsForGroups({
    supabase: null,
    groupIds,
    resultType: 'failed',
    now
  })

  return {
    groupIds,
    refundedOrderIds: successOrders.map(item => item.id).filter(Boolean),
    closedOrderIds: (closedOrders || []).map(item => item.id).filter(Boolean)
  }
}

module.exports = {
  cleanupExpiredPackageGroups,
  closePendingPackageOrdersByIds,
  listPendingOrderIdsForPackage
}
