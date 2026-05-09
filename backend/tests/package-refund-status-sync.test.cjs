const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const backendRoot = path.resolve(__dirname, '..', 'console-api-service')

const mockModule = (relativePath, exports) => {
  const modulePath = require.resolve(path.join(backendRoot, relativePath))
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

const clearModule = relativePath => {
  try {
    const modulePath = require.resolve(path.join(backendRoot, relativePath))
    delete require.cache[modulePath]
  } catch (error) {
    if (!error || error.code !== 'MODULE_NOT_FOUND') {
      throw error
    }
  }
}

test('package refund status sync polls only refund pending package orders', async () => {
  clearModule('utils/packageRefundStatusSync.js')

  const state = {
    queried: [],
    orders: [
      {
        id: 'package-refund-pending-1',
        order_no: 'LDPKG-REFUND-001',
        order_type: 2,
        status: 'refund_pending'
      },
      {
        id: 'course-refund-pending-1',
        order_no: 'LDCOURSE-REFUND-001',
        order_type: 1,
        status: 'refund_pending'
      },
      {
        id: 'package-refunded-1',
        order_no: 'LDPKG-REFUND-002',
        order_type: 2,
        status: 'refunded'
      }
    ]
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    },
    toInt: (value, fallback) => Number.parseInt(`${value || ''}`, 10) || fallback
  })
  mockModule('repositories/index.js', {
    ordersRepository: {
      listOrders: async filters =>
        state.orders.filter(
          item =>
            Number(item.order_type) === Number(filters.orderType) &&
            item.status === filters.status
        )
    }
  })
  mockModule('console-api/services/cloudPayRefundGateway.js', {
    queryAndSyncCloudPayRefund: async payload => {
      state.queried.push(payload)
      return {
        queryStatus: 'SUCCESS',
        settled: true,
        finalStatus: 'refunded'
      }
    }
  })

  const { syncPendingPackageRefundStatuses } = require(path.join(
    backendRoot,
    'utils/packageRefundStatusSync.js'
  ))

  const result = await syncPendingPackageRefundStatuses()

  assert.equal(result.scanned, 1)
  assert.equal(result.synced, 1)
  assert.equal(result.failed, 0)
  assert.deepEqual(state.queried, [
    {
      orderId: 'package-refund-pending-1',
      outRefundNo: 'RF-LDPKG-REFUND-001'
    }
  ])
})
