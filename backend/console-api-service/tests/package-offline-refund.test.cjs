const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const serviceRoot = path.resolve(__dirname, '..')

const mockModule = (relativePath, exports) => {
  const modulePath = require.resolve(path.join(serviceRoot, relativePath))
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

const clearModules = relativePaths => {
  relativePaths.forEach(relativePath => {
    const modulePath = require.resolve(path.join(serviceRoot, relativePath))
    delete require.cache[modulePath]
  })
}

const loadService = ({
  repositories,
  packageGroupStore,
  writeAdminLog
}) => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/domain/packageGroupRules.js',
    'shared/constants/refunds.js',
    'shared/services/packageGroupStore.js',
    'shared/services/packageSchedule.js',
    'shared/services/packageReaders.js',
    'shared/utils/dateTime.js',
    'utils/adminStore.js',
    'console-api/routes/_helpers.js',
    'console-api/services/tencentMapService.js',
    'console-api/services/_guards.js',
    'console-api/services/cloudPayRefundGateway.js',
    'console-api/services/packageAdminService.js'
  ])

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })
  mockModule('repositories/index.js', repositories)
  mockModule('shared/domain/packageGroupRules.js', {
    calculatePackageMemberAmountFen: () => 0,
    findGroupPriceFen: () => 0
  })
  mockModule('shared/constants/refunds.js', {
    AUTO_REFUND_REASON: '报名截止前未成团，系统自动退款',
    PACKAGE_OFFLINE_REFUND_REASON: '当前课程已下架'
  })
  mockModule('shared/services/packageGroupStore.js', packageGroupStore)
  mockModule('shared/services/packageSchedule.js', {
    buildPackageLessonSchedule: () => [],
    formatPackageDateTime: value => value || '',
    formatPendingPackageScheduleText: () => ''
  })
  mockModule('shared/services/packageReaders.js', {
    buildAdminLocationText: () => '',
    formatFenText: value => `${value || 0}`
  })
  mockModule('shared/utils/dateTime.js', {
    parseShanghaiDate: value => (value ? new Date(value) : null)
  })
  mockModule('utils/adminStore.js', {
    writeAdminLog
  })
  mockModule('console-api/routes/_helpers.js', {
    formatDateTime: value => (value ? new Date(value).toISOString() : ''),
    getPagination: () => ({ page: 1, size: 10, from: 0, to: 9 }),
    parseShanghaiDateTimeInput: value => value
  })
  mockModule('console-api/services/tencentMapService.js', {
    geocodeAddressWithTencentMap: async () => ({}),
    searchPlacesWithTencentMap: async () => []
  })
  mockModule('console-api/services/_guards.js', {
    ensureCondition(condition, error) {
      if (!condition) {
        const err = new Error(error.message)
        Object.assign(err, error)
        throw err
      }
    },
    ensureFound(value, error) {
      if (!value) {
        const err = new Error(error.message)
        Object.assign(err, error)
        throw err
      }
    }
  })
  mockModule('console-api/services/cloudPayRefundGateway.js', {
    invokeCloudPayRefund: async () => {
      throw new Error('invokeCloudPayRefund should not be called directly in offline package flow')
    },
    queryAndSyncCloudPayRefund: async () => ({})
  })

  return require('../console-api/services/packageAdminService.js')
}

test('offlineAdminPackage sends only active paid groups into refund_pending with offline reason', async () => {
  const startAutoRefundCalls = []
  const adminLogs = []
  const repositories = {
    coursePackagesRepository: {
      findPackageById: async () => ({
        id: 'pkg-1',
        name: '测试课包',
        status: 1,
        publish_time: '2026-06-01T10:00:00.000Z',
        updated_at: '2026-06-01T10:00:00.000Z'
      }),
      updatePackage: async (_packageId, patch) => ({
        id: 'pkg-1',
        name: '测试课包',
        status: 0,
        publish_time: '2026-06-01T10:00:00.000Z',
        unpublish_time: patch.unpublish_time,
        updated_at: patch.updated_at
      })
    },
    ordersRepository: {
      listOrdersByPackageGroupId: async ({ packageGroupId, status }) => {
        if (packageGroupId !== 'group-active-1') {
          return []
        }
        if (status === 'pending') {
          return [{ id: 'order-pending-1' }]
        }
        if (status === 'success') {
          return [{ id: 'order-success-1', package_group_id: 'group-active-1' }]
        }
        return []
      }
    },
    packageGroupsRepository: {
      listPackageGroups: async ({ statuses }) => {
        assert.deepEqual(statuses, ['active'])
        return [{ id: 'group-active-1', package_id: 'pkg-1', status: 'active' }]
      },
      bulkUpdatePackageGroupStatus: async ({ packageGroupIds, status }) => {
        assert.deepEqual(packageGroupIds, ['group-active-1'])
        assert.equal(status, 'failed')
      }
    },
    paymentRecordsRepository: {},
    usersRepository: {}
  }
  const packageGroupStore = {
    cleanupExpiredPackageGroups: async () => ({
      groupIds: [],
      refundPendingOrderIds: [],
      refundFailedOrderIds: [],
      closedOrderIds: []
    }),
    closePendingPackageOrdersByIds: async ({ orderIds }) => {
      assert.deepEqual(orderIds, ['order-pending-1'])
      return [{ id: 'order-pending-1' }]
    },
    startAutoRefundForPackageOrder: async ({ order, reason }) => {
      startAutoRefundCalls.push({ order, reason })
      return {
        orderId: order.id,
        status: 'refund_pending'
      }
    }
  }

  const service = loadService({
    repositories,
    packageGroupStore,
    writeAdminLog: async payload => {
      adminLogs.push(payload)
    }
  })

  const now = new Date('2026-06-04T09:00:00.000Z')
  const result = await service.offlineAdminPackage({
    packageId: 'pkg-1',
    admin: { id: 'admin-1' },
    ip: '127.0.0.1',
    now
  })

  assert.equal(result.status, 'inactive')
  assert.equal(startAutoRefundCalls.length, 1)
  assert.equal(startAutoRefundCalls[0].order.id, 'order-success-1')
  assert.equal(startAutoRefundCalls[0].reason, '当前课程已下架')
  assert.equal(adminLogs.length, 1)
  assert.deepEqual(adminLogs[0].detail.auto_failed_group_ids, ['group-active-1'])
  assert.deepEqual(adminLogs[0].detail.auto_refund_pending_order_ids, ['order-success-1'])
  assert.deepEqual(adminLogs[0].detail.auto_refund_failed_order_ids, [])
  assert.deepEqual(adminLogs[0].detail.auto_closed_order_ids, ['order-pending-1'])
})
