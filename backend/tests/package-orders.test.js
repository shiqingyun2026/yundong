const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const backendRoot = path.resolve(__dirname, '..')

const mockModule = (relativePath, exports) => {
  const modulePath = require.resolve(path.join(backendRoot, relativePath))
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

const clearModules = relativePaths => {
  relativePaths.forEach(relativePath => {
    const modulePath = require.resolve(path.join(backendRoot, relativePath))
    delete require.cache[modulePath]
  })
}

test('package orders allow the same user to join the same package group multiple times', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/packageGroupStore.js',
    'shared/services/paymentShell.js',
    'shared/services/packageOrders.js'
  ])

  const state = {
    nextOrderNumber: 1,
    closedOrderIds: [],
    orders: [],
    group: {
      id: 'group-1',
      package_id: 'pkg-1',
      status: 'active',
      target_count: 4,
      current_count: 1,
      deadline: '2026-04-24T10:00:00.000Z',
      weekday: 6,
      hour: 10,
      success_time: null,
      first_class_time: null
    }
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackageById: async () => ({
        id: 'pkg-1',
        status: 1,
        total_price: 12000,
        supported_people: [4],
        group_price_config: [{ target_count: 4, price_fen: 3000 }],
        deadline_hours: 48
      })
    },
    ordersRepository: {
      listPendingOrderIdsByUserAndPackage: async () => [],
      closeOrdersByIds: async ({ orderIds }) => {
        state.closedOrderIds.push(...orderIds)
        return []
      },
      createOrder: async payload => {
        const order = {
          id: `order-${state.nextOrderNumber}`,
          status: 'pending',
          ...payload
        }
        state.nextOrderNumber += 1
        state.orders.push(order)
        return order
      },
      findOrderForUser: async ({ userId, orderId }) =>
        state.orders.find(order => order.id === orderId && order.user_id === userId) || null,
      updateOrder: async (orderId, patch) => {
        const order = state.orders.find(item => item.id === orderId)
        Object.assign(order, patch)
        return order
      }
    },
    packageGroupsRepository: {
      listPackageGroups: async () => [],
      findPackageGroupById: async groupId => (groupId === state.group.id ? { ...state.group } : null),
      updatePackageGroup: async (groupId, patch) => {
        Object.assign(state.group, patch)
        return { ...state.group }
      }
    }
  })

  mockModule('shared/services/packageGroupStore.js', {
    cleanupExpiredPackageGroups: async () => ({ groupIds: [], refundedOrderIds: [], closedOrderIds: [] }),
    closePendingPackageOrdersByIds: async ({ orderIds }) => {
      state.closedOrderIds.push(...orderIds)
      return []
    },
    listPendingOrderIdsForPackage: async () => []
  })

  mockModule('shared/services/paymentShell.js', {
    markPaymentRecordRefunded: async () => ({})
  })

  const {
    createPackageJoinOrder,
    markPackageOrderPaymentSuccess
  } = require(path.join(backendRoot, 'shared/services/packageOrders.js'))

  const firstJoin = await createPackageJoinOrder({
    userId: 'user-1',
    packageId: 'pkg-1',
    packageGroupId: 'group-1',
    childNickname: '小满',
    childAge: 6,
    now: new Date('2026-04-22T10:00:00.000Z')
  })
  await markPackageOrderPaymentSuccess({
    userId: 'user-1',
    orderId: firstJoin.order.id,
    now: new Date('2026-04-22T10:01:00.000Z')
  })

  const secondJoin = await createPackageJoinOrder({
    userId: 'user-1',
    packageId: 'pkg-1',
    packageGroupId: 'group-1',
    childNickname: '乐乐',
    childAge: 5,
    now: new Date('2026-04-22T10:02:00.000Z')
  })
  const secondPayment = await markPackageOrderPaymentSuccess({
    userId: 'user-1',
    orderId: secondJoin.order.id,
    now: new Date('2026-04-22T10:03:00.000Z')
  })

  assert.equal(firstJoin.memberAmountFen, 3000)
  assert.equal(secondJoin.memberAmountFen, 3000)
  assert.equal(state.orders.length, 2)
  assert.equal(state.orders[0].package_context.child_nickname, '小满')
  assert.equal(state.orders[1].package_context.child_nickname, '乐乐')
  assert.equal(state.orders[0].status, 'success')
  assert.equal(state.orders[1].status, 'success')
  assert.equal(state.group.current_count, 3)
  assert.equal(state.group.status, 'active')
  assert.equal(secondPayment.packageGroupId, 'group-1')
})
