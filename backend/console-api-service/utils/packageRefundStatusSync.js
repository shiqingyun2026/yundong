const { env } = require('../config/env')
const { ordersRepository } = require('../repositories')
const { queryAndSyncCloudPayRefund } = require('../console-api/services/cloudPayRefundGateway')

const buildPackageRefundOutRefundNo = order => {
  const base = (order && (order.order_no || order.id) ? `${order.order_no || order.id}` : '').replace(/[^a-zA-Z0-9_-]/g, '')
  const outTradeNo = base || `order_${Date.now()}`
  return `RF-${outTradeNo}`.slice(0, 64)
}

const syncPendingPackageRefundStatuses = async (options = {}) => {
  if (!env.useMySqlRepositories) {
    return {
      scanned: 0,
      synced: 0,
      failed: 0,
      skipped: 0,
      results: []
    }
  }

  const pendingOrders = await ordersRepository.listOrders({
    orderType: 2,
    status: 'refund_pending'
  })
  const batch = pendingOrders || []
  const results = []
  let synced = 0
  let failed = 0

  for (const order of batch) {
    try {
      const syncResult = await queryAndSyncCloudPayRefund({
        orderId: order.id,
        outRefundNo: buildPackageRefundOutRefundNo(order)
      })
      synced += 1
      results.push({
        orderId: order.id,
        outRefundNo: buildPackageRefundOutRefundNo(order),
        queryStatus: syncResult.queryStatus || '',
        finalStatus: syncResult.finalStatus || '',
        settled: !!syncResult.settled
      })
    } catch (error) {
      failed += 1
      console.error('[package-refund-status-sync] sync failed', {
        orderId: order.id,
        message: error && error.message ? error.message : String(error)
      })
      results.push({
        orderId: order.id,
        outRefundNo: buildPackageRefundOutRefundNo(order),
        error: error && error.message ? error.message : String(error)
      })
    }
  }

  return {
    scanned: batch.length,
    synced,
    failed,
    skipped: 0,
    results
  }
}

module.exports = {
  buildPackageRefundOutRefundNo,
  syncPendingPackageRefundStatuses
}
