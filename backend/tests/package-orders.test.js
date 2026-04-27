const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const backendRoot = path.resolve(__dirname, '..', 'lindong-api')

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
    'shared/services/groupResultNotifications.js',
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

  mockModule('shared/services/groupResultNotifications.js', {
    enqueueGroupResultNotifications: async () => ({})
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
    parentMobile: '13800138000',
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
    parentMobile: '13800138001',
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
  assert.equal(state.orders[0].package_context.parent_mobile, '13800138000')
  assert.equal(state.orders[1].package_context.child_nickname, '乐乐')
  assert.equal(state.orders[1].package_context.parent_mobile, '13800138001')
  assert.equal(state.orders[0].status, 'success')
  assert.equal(state.orders[1].status, 'success')
  assert.equal(state.group.current_count, 3)
  assert.equal(state.group.status, 'active')
  assert.equal(secondPayment.packageGroupId, 'group-1')
})

test('package start payment creates group with configured deadline hours', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/packageGroupStore.js',
    'shared/services/groupResultNotifications.js',
    'shared/services/paymentShell.js',
    'shared/services/packageOrders.js'
  ])

  const state = {
    group: null,
    orders: [
      {
        id: 'order-start-1',
        user_id: 'user-1',
        order_type: 2,
        package_id: 'pkg-1',
        package_group_id: null,
        package_action: 'start',
        package_context: {
          target_count: 4,
          weekday: 6,
          hour: 10
        },
        status: 'pending'
      }
    ]
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
        deadline_hours: 45
      })
    },
    ordersRepository: {
      findOrderForUser: async ({ userId, orderId }) =>
        state.orders.find(order => order.id === orderId && order.user_id === userId) || null,
      updateOrder: async (orderId, patch) => {
        const order = state.orders.find(item => item.id === orderId)
        Object.assign(order, patch)
        return { ...order }
      }
    },
    packageGroupsRepository: {
      createPackageGroup: async payload => {
        state.group = {
          id: 'group-start-1',
          ...payload
        }
        return { ...state.group }
      },
      listPackageGroups: async () => []
    }
  })

  mockModule('shared/services/packageGroupStore.js', {
    cleanupExpiredPackageGroups: async () => ({ groupIds: [], refundedOrderIds: [], closedOrderIds: [] }),
    closePendingPackageOrdersByIds: async () => [],
    listPendingOrderIdsForPackage: async () => []
  })

  mockModule('shared/services/groupResultNotifications.js', {
    enqueueGroupResultNotifications: async () => ({})
  })

  mockModule('shared/services/paymentShell.js', {
    markPaymentRecordRefunded: async () => ({})
  })

  const { markPackageOrderPaymentSuccess } = require(path.join(backendRoot, 'shared/services/packageOrders.js'))
  await markPackageOrderPaymentSuccess({
    userId: 'user-1',
    orderId: 'order-start-1',
    now: new Date('2026-04-22T10:00:00.000Z')
  })

  assert.equal(state.group.deadline.toISOString(), '2026-04-24T07:00:00.000Z')
  assert.equal(state.orders[0].status, 'success')
  assert.equal(state.orders[0].package_group_id, 'group-start-1')
})

test('package orders enqueue group success notification when join payment completes the group', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/packageGroupStore.js',
    'shared/services/groupResultNotifications.js',
    'shared/services/paymentShell.js',
    'shared/services/packageOrders.js'
  ])

  const state = {
    orders: [
      {
        id: 'order-join-success',
        user_id: 'user-2',
        order_type: 2,
        package_id: 'pkg-1',
        package_group_id: 'group-1',
        package_action: 'join',
        status: 'pending'
      }
    ],
    group: {
      id: 'group-1',
      package_id: 'pkg-1',
      status: 'active',
      target_count: 4,
      current_count: 3,
      deadline: '2026-04-24T10:00:00.000Z',
      weekday: 6,
      hour: 10,
      success_time: null,
      first_class_time: null
    },
    enqueueCalls: []
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
    closePendingPackageOrdersByIds: async () => [],
    listPendingOrderIdsForPackage: async () => []
  })

  mockModule('shared/services/groupResultNotifications.js', {
    enqueueGroupResultNotifications: async payload => {
      state.enqueueCalls.push(payload)
      return {}
    }
  })

  mockModule('shared/services/paymentShell.js', {
    markPaymentRecordRefunded: async () => ({})
  })

  const { markPackageOrderPaymentSuccess } = require(path.join(backendRoot, 'shared/services/packageOrders.js'))

  const result = await markPackageOrderPaymentSuccess({
    userId: 'user-2',
    orderId: 'order-join-success',
    now: new Date('2026-04-22T10:03:00.000Z')
  })

  assert.equal(result.groupStatus, 'success')
  assert.equal(state.group.status, 'success')
  assert.equal(state.group.current_count, 4)
  assert.equal(state.enqueueCalls.length, 1)
  assert.equal(state.enqueueCalls[0].groupId, 'group-1')
  assert.equal(state.enqueueCalls[0].resultType, 'success')
})

test('wechat payment callback marks package order paid through package flow', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/wechatMiniProgram.js',
    'shared/services/groupOrders.js',
    'shared/services/packageOrders.js',
    'shared/services/paymentShell.js'
  ])

  const state = {
    packagePaymentSuccessCalls: [],
    groupPaymentSuccessCalls: [],
    paymentRecord: {
      id: 'payment-record-1',
      order_id: 'package-order-1',
      user_id: 'user-1',
      out_trade_no: 'PKG-ORDER-1',
      transaction_id: '',
      status: 'pending',
      callback_status: '',
      callback_payload: null,
      paid_at: null,
      closed_at: null
    },
    order: {
      id: 'package-order-1',
      user_id: 'user-1',
      order_type: 2,
      package_id: 'pkg-1',
      package_group_id: 'group-1',
      status: 'pending'
    }
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('repositories/index.js', {
    paymentRecordsRepository: {
      findPaymentRecordByOrderId: async orderId => (orderId === state.paymentRecord.order_id ? { ...state.paymentRecord } : null),
      findPaymentRecordByOutTradeNo: async outTradeNo => (outTradeNo === state.paymentRecord.out_trade_no ? { ...state.paymentRecord } : null),
      updatePaymentRecord: async (id, patch) => {
        assert.equal(id, state.paymentRecord.id)
        Object.assign(state.paymentRecord, patch)
        return { ...state.paymentRecord }
      }
    },
    ordersRepository: {
      findOrderById: async orderId => (orderId === state.order.id ? { ...state.order } : null)
    },
    usersRepository: {}
  })

  mockModule('shared/services/wechatMiniProgram.js', {
    createMiniProgramPayment: async () => ({}),
    buildMiniProgramPaymentParams: () => ({}),
    decryptWechatPayResource: resource => resource
  })

  mockModule('shared/services/groupOrders.js', {
    markOrderPaymentSuccess: async payload => {
      state.groupPaymentSuccessCalls.push(payload)
      return {}
    }
  })

  mockModule('shared/services/packageOrders.js', {
    markPackageOrderPaymentSuccess: async payload => {
      state.packagePaymentSuccessCalls.push(payload)
      state.order.status = 'success'
      return {
        order: { ...state.order },
        status: 'success',
        packageGroupId: 'group-1'
      }
    }
  })

  const { handleWechatPaymentCallback } = require(path.join(backendRoot, 'shared/services/paymentShell.js'))
  const result = await handleWechatPaymentCallback({
    payload: {
      out_trade_no: 'PKG-ORDER-1',
      transaction_id: 'wx-transaction-1',
      trade_state: 'SUCCESS'
    },
    now: new Date('2026-04-22T11:00:00.000Z')
  })

  assert.equal(result.orderId, 'package-order-1')
  assert.equal(result.orderStatus, 'success')
  assert.equal(state.paymentRecord.status, 'paid')
  assert.equal(state.paymentRecord.transaction_id, 'wx-transaction-1')
  assert.equal(state.packagePaymentSuccessCalls.length, 1)
  assert.equal(state.packagePaymentSuccessCalls[0].userId, 'user-1')
  assert.equal(state.packagePaymentSuccessCalls[0].orderId, 'package-order-1')
  assert.equal(state.groupPaymentSuccessCalls.length, 0)
})
