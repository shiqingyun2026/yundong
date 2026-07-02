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
    'config/db.js',
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
      id: 'PG-20260422-00001',
      package_id: 'PKG-20260422-0001',
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

  mockModule('config/db.js', {
    withTransaction: async run =>
      run({
        query: async (sql, params = []) => {
          if (sql.includes('from orders')) {
            const [orderId, userId] = params
            const order = state.orders.find(item => item.id === orderId && item.user_id === userId)
            return order ? [{ ...order }] : []
          }

          if (sql.includes('from package_groups')) {
            const [packageGroupId] = params
            return packageGroupId === state.group.id ? [{ ...state.group }] : []
          }

          return []
        },
        execute: async (sql, params = []) => {
          if (sql.includes('update orders')) {
            const orderId = params[params.length - 1]
            const order = state.orders.find(item => item.id === orderId)
            if (order) {
              order.status = params[0]
              order.pay_time = params[1]
              order.updated_at = params[2]
            }
          }

          if (sql.includes('update package_groups')) {
            state.group.current_count = params[0]
            state.group.status = params[1]
            state.group.success_time = params[2]
            state.group.first_class_time = params[3]
          }

          return {}
        }
      })
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackageById: async () => ({
        id: 'PKG-20260422-0001',
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
      findOrderById: async orderId => state.orders.find(order => order.id === orderId) || null,
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
    packageId: 'PKG-20260422-0001',
    packageGroupId: 'PG-20260422-00001',
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
    packageId: 'PKG-20260422-0001',
    packageGroupId: 'PG-20260422-00001',
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
  assert.equal(secondPayment.packageGroupId, 'PG-20260422-00001')
})

test('expired package group succeeds at deadline when minimum success count is reached', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/groupResultNotifications.js',
    'shared/services/paymentShell.js',
    'shared/services/wechatMiniProgram.js',
    'shared/services/packageGroupStore.js'
  ])

  const state = {
    group: {
      id: 'PG-20260422-00004',
      package_id: 'PKG-20260422-0001',
      creator_id: 'user-1',
      target_count: 4,
      min_success_count: 3,
      current_count: 3,
      status: 'active',
      weekday: 6,
      hour: 10,
      schedule_config: {
        schedule_type: 'weekly',
        schedule_date: '2026-04-24',
        schedule_time: '10:00',
        schedule_days: [6],
        class_count: 5
      },
      first_class_time: null,
      deadline: '2026-04-22T10:00:00.000Z',
      success_time: null
    },
    successNotifications: [],
    failedNotifications: [],
    refundStarted: false,
    closedOrderIds: []
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('repositories/index.js', {
    groupsRepository: {},
    ordersRepository: {
      listOrdersByPackageGroupId: async ({ status }) => {
        if (status === 'pending') {
          return [{ id: 'pending-order-1' }]
        }
        if (status === 'success') {
          return [
            { id: 'paid-order-1', user_id: 'user-1', package_group_id: state.group.id },
            { id: 'paid-order-2', user_id: 'user-2', package_group_id: state.group.id },
            { id: 'paid-order-3', user_id: 'user-3', package_group_id: state.group.id }
          ]
        }
        return []
      },
      closeOrdersByIds: async ({ orderIds }) => {
        state.closedOrderIds.push(...orderIds)
        return orderIds.map(id => ({ id }))
      },
      updateOrder: async () => {
        state.refundStarted = true
        return {}
      }
    },
    packageGroupsRepository: {
      listPackageGroups: async () => [{ ...state.group }],
      updatePackageGroup: async (groupId, patch) => {
        if (groupId === state.group.id) {
          Object.assign(state.group, patch)
        }
        return { ...state.group }
      },
      bulkUpdatePackageGroupStatus: async ({ status }) => {
        state.group.status = status
        return [{ ...state.group }]
      }
    },
    paymentRecordsRepository: {
      findPaymentRecordByOrderId: async () => null
    }
  })

  mockModule('shared/services/groupResultNotifications.js', {
    enqueueNotificationsForGroups: async ({ groupIds, resultType }) => {
      if (resultType === 'success') {
        state.successNotifications.push(...groupIds)
      }
      if (resultType === 'failed') {
        state.failedNotifications.push(...groupIds)
      }
    }
  })

  mockModule('shared/services/paymentShell.js', {
    prepareCloudPayRefund: async () => {
      state.refundStarted = true
      return {}
    }
  })

  mockModule('shared/services/wechatMiniProgram.js', {
    createWechatPayRefund: async () => {
      state.refundStarted = true
      return {}
    }
  })

  const { cleanupExpiredPackageGroups } = require(path.join(backendRoot, 'shared/services/packageGroupStore.js'))
  const result = await cleanupExpiredPackageGroups({
    packageId: 'PKG-20260422-0001',
    now: new Date('2026-04-22T10:01:00.000Z')
  })

  assert.equal(state.group.status, 'success')
  assert.equal(state.group.success_time.toISOString(), '2026-04-22T10:01:00.000Z')
  assert.equal(state.group.first_class_time.toISOString(), '2026-04-25T02:00:00.000Z')
  assert.deepEqual(state.successNotifications, ['PG-20260422-00004'])
  assert.deepEqual(state.failedNotifications, [])
  assert.equal(state.refundStarted, false)
  assert.deepEqual(state.closedOrderIds, ['pending-order-1'])
  assert.deepEqual(result.successGroupIds, ['PG-20260422-00004'])
  assert.deepEqual(result.groupIds, [])
})

test('package start payment creates group with configured deadline hours', async () => {
  clearModules([
    'config/env.js',
    'config/db.js',
    'repositories/index.js',
    'shared/services/packageGroupStore.js',
    'shared/services/groupResultNotifications.js',
    'shared/services/paymentShell.js',
    'shared/services/packageOrders.js'
  ])

  const state = {
    group: null,
    paymentRecord: {
      id: 'payment-start-1',
      order_id: 'order-start-1',
      package_group_id: null,
      status: 'pending'
    },
    orders: [
      {
        id: 'order-start-1',
        user_id: 'user-1',
        order_type: 2,
        package_id: 'PKG-20260422-0001',
        package_group_id: null,
        package_action: 'start',
        package_context: {
          target_count: 4,
          weekday: 6,
          hour: 10,
          schedule_config: {
            schedule_type: 'weekly',
            schedule_date: '2026-04-24',
            schedule_time: '10:00',
            schedule_days: [6],
            class_count: 5
          }
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

  mockModule('config/db.js', {
    withTransaction: async run =>
      run({
        query: async (sql, params = []) => {
          if (sql.includes('from orders')) {
            const [orderId, userId] = params
            const order = state.orders.find(item => item.id === orderId && item.user_id === userId)
            return order ? [{ ...order }] : []
          }

          if (sql.includes('from package_groups')) {
            const [packageGroupId] = params
            return packageGroupId === state.group.id ? [{ ...state.group }] : []
          }

          return []
        },
        execute: async (sql, params = []) => {
          if (sql.includes('update orders')) {
            const orderId = params[params.length - 1]
            const order = state.orders.find(item => item.id === orderId)
            if (order) {
              order.status = params[0]
              order.pay_time = params[1]
              order.updated_at = params[2]
            }
          }

          if (sql.includes('update package_groups')) {
            state.group.current_count = params[0]
            state.group.status = params[1]
            state.group.success_time = params[2]
            state.group.first_class_time = params[3]
          }

          return {}
        }
      })
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackageById: async () => ({
        id: 'PKG-20260422-0001',
        status: 1,
        class_count: 5,
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
    paymentRecordsRepository: {
      findPaymentRecordByOrderId: async orderId => (orderId === state.paymentRecord.order_id ? { ...state.paymentRecord } : null),
      updatePaymentRecord: async (id, patch) => {
        if (id === state.paymentRecord.id) {
          Object.assign(state.paymentRecord, patch)
        }
        return { ...state.paymentRecord }
      }
    },
    packageGroupsRepository: {
      createPackageGroup: async payload => {
        state.group = {
          id: 'PG-20260422-00002',
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
  assert.equal(state.orders[0].package_group_id, 'PG-20260422-00002')
  assert.equal(state.paymentRecord.package_group_id, 'PG-20260422-00002')
})

test('package start payment reuses existing group for the same order on retry', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/packageGroupStore.js',
    'shared/services/groupResultNotifications.js',
    'shared/services/paymentShell.js',
    'shared/services/packageOrders.js'
  ])

  const state = {
    createdGroupCount: 0,
    paymentRecord: {
      id: 'payment-start-2',
      order_id: 'order-start-2',
      package_group_id: null,
      status: 'pending'
    },
    existingGroup: {
      id: 'PG-20260422-00003',
      package_id: 'PKG-20260422-0001',
      creator_id: 'user-2',
      target_count: 4,
      current_count: 1,
      status: 'active',
      hour: 10,
      deadline: new Date('2026-04-24T07:00:00.000Z'),
      first_class_time: null,
      success_time: null,
      schedule_config: {
        schedule_type: 'weekly',
        schedule_date: '2026-04-24',
        schedule_time: '10:00',
        schedule_days: [6],
        class_count: 5,
        source_order_id: 'order-start-2',
        source_order_no: 'LDPKG-20260422-000002'
      }
    },
    orders: [
      {
        id: 'order-start-2',
        order_no: 'LDPKG-20260422-000002',
        user_id: 'user-2',
        order_type: 2,
        package_id: 'PKG-20260422-0001',
        package_group_id: null,
        package_action: 'start',
        package_context: {
          target_count: 4,
          child_nickname: '小北',
          child_age: 7,
          parent_mobile: '13800138002',
          schedule_config: {
            schedule_type: 'weekly',
            schedule_date: '2026-04-24',
            schedule_time: '10:00',
            schedule_days: [6],
            class_count: 5
          }
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
        id: 'PKG-20260422-0001',
        status: 1,
        class_count: 5,
        total_price: 12000,
        supported_people: [4],
        group_price_config: [{ target_count: 4, price_fen: 3000 }],
        deadline_hours: 48
      })
    },
    ordersRepository: {
      findOrderForUser: async ({ orderId }) => {
        const order = state.orders.find(item => item.id === orderId)
        return order ? { ...order } : null
      },
      updateOrder: async (orderId, patch) => {
        const order = state.orders.find(item => item.id === orderId)
        Object.assign(order, patch)
        return { ...order }
      }
    },
    paymentRecordsRepository: {
      findPaymentRecordByOrderId: async orderId => (orderId === state.paymentRecord.order_id ? { ...state.paymentRecord } : null),
      updatePaymentRecord: async (id, patch) => {
        if (id === state.paymentRecord.id) {
          Object.assign(state.paymentRecord, patch)
        }
        return { ...state.paymentRecord }
      }
    },
    packageGroupsRepository: {
      createPackageGroup: async () => {
        state.createdGroupCount += 1
        throw new Error('createPackageGroup should not be called when an order-scoped group already exists')
      },
      listPackageGroups: async () => [{ ...state.existingGroup }]
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
  const result = await markPackageOrderPaymentSuccess({
    userId: 'user-2',
    orderId: 'order-start-2',
    now: new Date('2026-04-22T10:00:00.000Z')
  })

  assert.equal(state.createdGroupCount, 0)
  assert.equal(state.orders[0].status, 'success')
  assert.equal(state.orders[0].package_group_id, 'PG-20260422-00003')
  assert.equal(state.paymentRecord.package_group_id, 'PG-20260422-00003')
  assert.equal(result.packageGroupId, 'PG-20260422-00003')
  assert.equal(result.orderStatus, undefined)
})

test('trial package start rejects class dates earlier than three days after group start', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/packageGroupStore.js',
    'shared/services/groupResultNotifications.js',
    'shared/services/paymentShell.js',
    'shared/services/packageOrders.js'
  ])

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackageById: async () => ({
        id: 'PKG-TRIAL-0001',
        status: 1,
        package_category: '体验课',
        class_count: 1,
        total_price: 12000,
        supported_people: [4],
        group_price_config: [{ target_count: 4, price_fen: 3000 }],
        deadline_hours: 48
      })
    },
    ordersRepository: {
      listPendingOrderIdsByUserAndPackage: async () => [],
      closeOrdersByIds: async () => [],
      createOrder: async payload => payload
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

  const { createPackageStartOrder } = require(path.join(backendRoot, 'shared/services/packageOrders.js'))

  await assert.rejects(
    () =>
      createPackageStartOrder({
        userId: 'user-1',
        packageId: 'PKG-TRIAL-0001',
        targetCount: 4,
        scheduleType: 'single',
        scheduleDate: '2026-04-21',
        scheduleTime: '10:00',
        scheduleDays: [],
        childNickname: '小满',
        childAge: 6,
        parentMobile: '13800138000',
        now: new Date('2026-04-20T08:00:00.000Z')
      }),
    error => {
      assert.match(error.message, /开团后第3天|上课日期/)
      return true
    }
  )
})

test('package start accepts the first valid Shanghai date after T+2 even under UTC runtime', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/packageGroupStore.js',
    'shared/services/groupResultNotifications.js',
    'shared/services/paymentShell.js',
    'shared/services/packageOrders.js'
  ])

  const state = {
    createdOrder: null
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackageById: async () => ({
        id: 'PKG-TZ-0001',
        status: 1,
        class_count: 1,
        total_price: 12000,
        supported_people: [4],
        group_price_config: [{ target_count: 4, price_fen: 3000 }],
        deadline_hours: 48
      })
    },
    ordersRepository: {
      listPendingOrderIdsByUserAndPackage: async () => [],
      closeOrdersByIds: async () => [],
      createOrder: async payload => {
        state.createdOrder = payload
        return payload
      }
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

  const { createPackageStartOrder } = require(path.join(backendRoot, 'shared/services/packageOrders.js'))

  await createPackageStartOrder({
    userId: 'user-1',
    packageId: 'PKG-TZ-0001',
    targetCount: 4,
    scheduleType: 'single',
    scheduleDate: '2026-04-24',
    scheduleTime: '10:00',
    scheduleDays: [],
    childNickname: '小满',
    childAge: 6,
    parentMobile: '13800138000',
    now: new Date('2026-04-20T16:30:00.000Z')
  })

  assert.equal(state.createdOrder.package_context.schedule_date, '2026-04-24')
})

test('package start order stores selected package location snapshot', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/packageGroupStore.js',
    'shared/services/groupResultNotifications.js',
    'shared/services/paymentShell.js',
    'shared/services/packageOrders.js'
  ])

  const state = {
    createdOrder: null
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackageById: async () => ({
        id: 'PKG-LOC-0001',
        status: 1,
        class_count: 1,
        total_price: 12000,
        supported_people: [4],
        group_price_config: [{ target_count: 4, price_fen: 3000 }],
        deadline_hours: 48
      })
    },
    coursePackageLocationsRepository: {
      findLocationById: async id => ({
        id,
        package_id: 'PKG-LOC-0001',
        location_district: '广东省 / 深圳市 / 龙岗区',
        location_community: '大世纪水山缘',
        location_detail: '大世纪水山缘 广东省深圳市龙岗区龙山商业街1',
        longitude: 114.140977,
        latitude: 22.599326,
        status: 1
      })
    },
    ordersRepository: {
      listPendingOrderIdsByUserAndPackage: async () => [],
      closeOrdersByIds: async () => [],
      createOrder: async payload => {
        state.createdOrder = payload
        return payload
      }
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

  const { createPackageStartOrder } = require(path.join(backendRoot, 'shared/services/packageOrders.js'))

  await createPackageStartOrder({
    userId: 'user-1',
    packageId: 'PKG-LOC-0001',
    targetCount: 4,
    locationId: 'PKG-LOC-0001-loc-002',
    scheduleType: 'single',
    scheduleDate: '2026-04-24',
    scheduleTime: '10:00',
    scheduleDays: [],
    childNickname: '小满',
    childAge: 6,
    parentMobile: '13800138000',
    now: new Date('2026-04-20T16:30:00.000Z')
  })

  assert.equal(state.createdOrder.package_context.location_id, 'PKG-LOC-0001-loc-002')
  assert.equal(state.createdOrder.package_context.location_snapshot.location_community, '大世纪水山缘')
  assert.equal(state.createdOrder.package_context.schedule_config.location_id, 'PKG-LOC-0001-loc-002')
  assert.equal(state.createdOrder.package_context.schedule_config.location_snapshot.location_district, '广东省 / 深圳市 / 龙岗区')
})

test('package start accepts schedule time ranges and stores the start time', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/packageGroupStore.js',
    'shared/services/groupResultNotifications.js',
    'shared/services/paymentShell.js',
    'shared/services/packageOrders.js'
  ])

  const state = {
    createdOrder: null
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackageById: async () => ({
        id: 'PKG-RANGE-0001',
        status: 1,
        class_count: 5,
        total_price: 12000,
        supported_people: [4],
        group_price_config: [{ target_count: 4, price_fen: 3000 }],
        deadline_hours: 48
      })
    },
    ordersRepository: {
      listPendingOrderIdsByUserAndPackage: async () => [],
      closeOrdersByIds: async () => [],
      createOrder: async payload => {
        state.createdOrder = payload
        return payload
      }
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

  const { createPackageStartOrder } = require(path.join(backendRoot, 'shared/services/packageOrders.js'))

  await createPackageStartOrder({
    userId: 'user-1',
    packageId: 'PKG-RANGE-0001',
    targetCount: 4,
    scheduleType: 'daily',
    scheduleDate: '2026-04-24',
    scheduleTime: '09:00—10:30',
    scheduleDays: [],
    scheduleList: [
      { index: 1, class_time: '2026-04-24 09:00:00' },
      { index: 2, class_time: '2026-04-25 09:00:00' },
      { index: 3, class_time: '2026-04-26 09:00:00' },
      { index: 4, class_time: '2026-04-27 09:00:00' },
      { index: 5, class_time: '2026-04-28 09:00:00' }
    ],
    childNickname: '小满',
    childAge: 6,
    parentMobile: '13800138000',
    now: new Date('2026-04-20T08:00:00.000Z')
  })

  assert.equal(state.createdOrder.package_context.schedule_time, '09:00')
  assert.equal(state.createdOrder.package_context.schedule_config.schedule_time, '09:00')
})

test('package start order stores custom schedule list in schedule config', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/packageGroupStore.js',
    'shared/services/groupResultNotifications.js',
    'shared/services/paymentShell.js',
    'shared/services/packageOrders.js'
  ])

  const state = {
    createdOrder: null
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackageById: async () => ({
        id: 'PKG-START-0001',
        status: 1,
        class_count: 3,
        total_price: 12000,
        supported_people: [4],
        group_price_config: [{ target_count: 4, price_fen: 3000 }],
        deadline_hours: 48
      })
    },
    ordersRepository: {
      listPendingOrderIdsByUserAndPackage: async () => [],
      closeOrdersByIds: async () => [],
      createOrder: async payload => {
        state.createdOrder = payload
        return payload
      }
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

  const { createPackageStartOrder } = require(path.join(backendRoot, 'shared/services/packageOrders.js'))

  await createPackageStartOrder({
    userId: 'user-1',
    packageId: 'PKG-START-0001',
    targetCount: 4,
    scheduleType: 'weekly',
    scheduleDate: '2026-04-22',
    scheduleTime: '10:00',
    scheduleDays: [1, 3, 5],
    scheduleList: [
      { index: 1, class_time: '2026-04-22 10:00:00' },
      { index: 2, class_time: '2026-04-24 10:30:00' },
      { index: 3, class_time: '2026-04-26 11:00:00' }
    ],
    childNickname: '小满',
    childAge: 6,
    parentMobile: '13800138000',
    now: new Date('2026-04-19T08:00:00.000Z')
  })

  assert.deepEqual(state.createdOrder.package_context.schedule_config.schedule_list, [
    { index: 1, class_time: '2026-04-22 10:00:00', display_text: '2026-04-22 10:00:00' },
    { index: 2, class_time: '2026-04-24 10:30:00', display_text: '2026-04-24 10:30:00' },
    { index: 3, class_time: '2026-04-26 11:00:00', display_text: '2026-04-26 11:00:00' }
  ])
  assert.equal(state.createdOrder.package_context.schedule_type, 'weekly')
  assert.equal(state.createdOrder.package_context.schedule_time, '10:00')
  assert.deepEqual(state.createdOrder.package_context.schedule_days, [1, 3, 5])
  assert.equal(state.createdOrder.package_context.class_count, 3)
  assert.deepEqual(state.createdOrder.package_context.schedule_list, [
    { index: 1, class_time: '2026-04-22 10:00:00', display_text: '2026-04-22 10:00:00' },
    { index: 2, class_time: '2026-04-24 10:30:00', display_text: '2026-04-24 10:30:00' },
    { index: 3, class_time: '2026-04-26 11:00:00', display_text: '2026-04-26 11:00:00' }
  ])
})

test('package join order stores schedule snapshot from group config', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/packageGroupStore.js',
    'shared/services/groupResultNotifications.js',
    'shared/services/paymentShell.js',
    'shared/services/packageOrders.js'
  ])

  const state = {
    createdOrder: null
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackageById: async () => ({
        id: 'PKG-JOIN-0001',
        status: 1,
        class_count: 3,
        total_price: 12000,
        supported_people: [4],
        group_price_config: [{ target_count: 4, price_fen: 3000 }],
        deadline_hours: 48
      })
    },
    ordersRepository: {
      listPendingOrderIdsByUserAndPackage: async () => [],
      closeOrdersByIds: async () => [],
      createOrder: async payload => {
        state.createdOrder = payload
        return payload
      }
    },
    packageGroupsRepository: {
      listPackageGroups: async () => [],
      findPackageGroupById: async () => ({
        id: 'PG-JOIN-0001',
        package_id: 'PKG-JOIN-0001',
        status: 'active',
        target_count: 4,
        current_count: 1,
        deadline: '2026-04-24T10:00:00.000Z',
        first_class_time: null,
        schedule_config: {
          schedule_type: 'weekly',
          schedule_date: '2026-04-22',
          schedule_time: '09:30',
          schedule_days: [2, 4],
          class_count: 3,
          schedule_list: [
            { index: 1, class_time: '2026-04-22 09:30:00' },
            { index: 2, class_time: '2026-04-24 09:30:00' },
            { index: 3, class_time: '2026-04-29 09:30:00' }
          ]
        }
      })
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

  const { createPackageJoinOrder } = require(path.join(backendRoot, 'shared/services/packageOrders.js'))

  await createPackageJoinOrder({
    userId: 'user-join-1',
    packageId: 'PKG-JOIN-0001',
    packageGroupId: 'PG-JOIN-0001',
    childNickname: '乐乐',
    childAge: 5,
    parentMobile: '13800138001',
    now: new Date('2026-04-19T08:00:00.000Z')
  })

  assert.equal(state.createdOrder.package_context.schedule_type, 'weekly')
  assert.equal(state.createdOrder.package_context.schedule_time, '09:30')
  assert.deepEqual(state.createdOrder.package_context.schedule_days, [2, 4])
  assert.equal(state.createdOrder.package_context.class_count, 3)
  assert.deepEqual(state.createdOrder.package_context.schedule_list, [
    { index: 1, class_time: '2026-04-22 09:30:00', display_text: '2026-04-22 09:30:00' },
    { index: 2, class_time: '2026-04-24 09:30:00', display_text: '2026-04-24 09:30:00' },
    { index: 3, class_time: '2026-04-29 09:30:00', display_text: '2026-04-29 09:30:00' }
  ])
})

test('package orders enqueue group success notification when join payment completes the group', async () => {
  clearModules([
    'config/env.js',
    'config/db.js',
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
        package_id: 'PKG-20260422-0001',
        package_group_id: 'PG-20260422-00001',
        package_action: 'join',
        status: 'pending'
      }
    ],
    group: {
      id: 'PG-20260422-00001',
      package_id: 'PKG-20260422-0001',
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

  mockModule('config/db.js', {
    withTransaction: async run =>
      run({
        query: async (sql, params = []) => {
          if (sql.includes('from orders')) {
            const [orderId, userId] = params
            const order = state.orders.find(item => item.id === orderId && item.user_id === userId)
            return order ? [{ ...order }] : []
          }

          if (sql.includes('from package_groups')) {
            const [packageGroupId] = params
            return packageGroupId === state.group.id ? [{ ...state.group }] : []
          }

          return []
        },
        execute: async (sql, params = []) => {
          if (sql.includes('update orders')) {
            const orderId = params[params.length - 1]
            const order = state.orders.find(item => item.id === orderId)
            if (order) {
              order.status = params[0]
              order.pay_time = params[1]
              order.updated_at = params[2]
            }
          }

          if (sql.includes('update package_groups')) {
            state.group.current_count = params[0]
            state.group.status = params[1]
            state.group.success_time = params[2]
            state.group.first_class_time = params[3]
          }

          return {}
        }
      })
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackageById: async () => ({
        id: 'PKG-20260422-0001',
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
      findOrderById: async orderId => state.orders.find(order => order.id === orderId) || null,
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
  assert.equal(state.enqueueCalls[0].groupId, 'PG-20260422-00001')
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
      out_trade_no: 'LDPKG-20260422-000099',
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
      package_id: 'PKG-20260422-0001',
      package_group_id: 'PG-20260422-00001',
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
        packageGroupId: 'PG-20260422-00001'
      }
    }
  })

  const { handleWechatPaymentCallback } = require(path.join(backendRoot, 'shared/services/paymentShell.js'))
  const result = await handleWechatPaymentCallback({
    payload: {
      out_trade_no: 'LDPKG-20260422-000099',
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

test('getOrderPaymentStatus reconciles pending wechat package payment via order query', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/wechatMiniProgram.js',
    'shared/services/groupOrders.js',
    'shared/services/packageOrders.js',
    'shared/services/paymentShell.js'
  ])

  const state = {
    queryCalls: [],
    packagePaymentSuccessCalls: [],
    paymentRecord: {
      id: 'payment-record-2',
      order_id: 'package-order-2',
      user_id: 'user-2',
      out_trade_no: 'LDPKG-20260616-000001',
      transaction_id: '',
      status: 'pending',
      callback_status: '',
      callback_payload: null,
      payment_mode: 'wechat',
      paid_at: null,
      closed_at: null
    },
    order: {
      id: 'package-order-2',
      user_id: 'user-2',
      order_type: 2,
      package_id: 'PKG-20260616-0001',
      package_group_id: 'PG-20260616-00001',
      status: 'pending',
      pay_time: null,
      refund_time: null,
      refund_reason: ''
    }
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true,
      paymentProviderMode: 'wechat'
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
      findOrderForUser: async ({ orderId }) => (orderId === state.order.id ? { ...state.order } : null),
      findOrderById: async orderId => (orderId === state.order.id ? { ...state.order } : null)
    },
    usersRepository: {}
  })

  mockModule('shared/services/wechatMiniProgram.js', {
    createMiniProgramPayment: async () => ({}),
    buildMiniProgramPaymentParams: () => ({}),
    decryptWechatPayResource: resource => resource,
    queryWechatPaymentByOutTradeNo: async ({ outTradeNo }) => {
      state.queryCalls.push(outTradeNo)
      return {
        out_trade_no: outTradeNo,
        transaction_id: 'wx-transaction-2',
        trade_state: 'SUCCESS'
      }
    }
  })

  mockModule('shared/services/groupOrders.js', {
    markOrderPaymentSuccess: async () => {
      throw new Error('group payment flow should not be used for package order')
    }
  })

  mockModule('shared/services/packageOrders.js', {
    markPackageOrderPaymentSuccess: async payload => {
      state.packagePaymentSuccessCalls.push(payload)
      state.order.status = 'success'
      state.order.pay_time = '2026-06-16 15:00:00'
      return {
        order: { ...state.order },
        status: 'success',
        packageGroupId: 'PG-20260616-00001'
      }
    }
  })

  const { getOrderPaymentStatus } = require(path.join(backendRoot, 'shared/services/paymentShell.js'))
  const result = await getOrderPaymentStatus({
    userId: 'user-2',
    orderId: 'package-order-2'
  })

  assert.deepEqual(state.queryCalls, ['LDPKG-20260616-000001'])
  assert.equal(state.paymentRecord.status, 'paid')
  assert.equal(state.paymentRecord.transaction_id, 'wx-transaction-2')
  assert.equal(state.packagePaymentSuccessCalls.length, 1)
  assert.equal(result.orderStatus, 'success')
  assert.equal(result.paymentRecordStatus, 'paid')
})

test('wechat payment callback recreates missing payment record from order number', async () => {
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
    createdPaymentRecords: [],
    paymentRecord: null,
    order: {
      id: 'package-order-3',
      order_no: 'LDPKG-20260616-000123',
      user_id: 'user-3',
      order_type: 2,
      package_id: 'PKG-20260616-0003',
      package_group_id: 'PG-20260616-00003',
      course_id: '',
      group_id: '',
      amount: 39800,
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
      findPaymentRecordByOrderId: async () => (state.paymentRecord ? { ...state.paymentRecord } : null),
      findPaymentRecordByOutTradeNo: async () => null,
      createPaymentRecord: async payload => {
        state.createdPaymentRecords.push(payload)
        state.paymentRecord = {
          id: payload.id || 'payment-record-3',
          ...payload
        }
        return { ...state.paymentRecord }
      },
      updatePaymentRecord: async (id, patch) => {
        assert.equal(id, state.paymentRecord.id)
        Object.assign(state.paymentRecord, patch)
        return { ...state.paymentRecord }
      }
    },
    ordersRepository: {
      findOrderById: async orderId => (orderId === state.order.id ? { ...state.order } : null),
      findOrderByOrderNo: async orderNo => (orderNo === state.order.order_no ? { ...state.order } : null)
    },
    usersRepository: {}
  })

  mockModule('shared/services/wechatMiniProgram.js', {
    createMiniProgramPayment: async () => ({}),
    buildMiniProgramPaymentParams: () => ({}),
    decryptWechatPayResource: resource => resource
  })

  mockModule('shared/services/groupOrders.js', {
    markOrderPaymentSuccess: async () => {
      throw new Error('group payment flow should not be used for package order')
    }
  })

  mockModule('shared/services/packageOrders.js', {
    markPackageOrderPaymentSuccess: async payload => {
      state.packagePaymentSuccessCalls.push(payload)
      state.order.status = 'success'
      return {
        order: { ...state.order },
        status: 'success',
        packageGroupId: state.order.package_group_id
      }
    }
  })

  const { handleWechatPaymentCallback } = require(path.join(backendRoot, 'shared/services/paymentShell.js'))
  const result = await handleWechatPaymentCallback({
    payload: {
      out_trade_no: 'LDPKG-20260616-000123',
      transaction_id: 'wx-transaction-3',
      trade_state: 'SUCCESS'
    },
    now: new Date('2026-06-16T08:00:00.000Z')
  })

  assert.equal(state.createdPaymentRecords.length, 1)
  assert.equal(state.createdPaymentRecords[0].order_id, state.order.id)
  assert.equal(state.createdPaymentRecords[0].out_trade_no, state.order.order_no)
  assert.equal(state.paymentRecord.status, 'paid')
  assert.equal(state.paymentRecord.transaction_id, 'wx-transaction-3')
  assert.equal(state.packagePaymentSuccessCalls.length, 1)
  assert.equal(result.orderId, state.order.id)
  assert.equal(result.orderStatus, 'success')
})

test('payment shell resolves cloudpay provider mode', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/wechatMiniProgram.js',
    'shared/services/paymentShell.js'
  ])

  process.env.PAYMENT_PROVIDER_MODE = 'cloudpay'

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true,
      paymentProviderMode: 'cloudpay',
      internalPaymentSecret: 'test-secret'
    }
  })

  mockModule('repositories/index.js', {
    ordersRepository: {},
    paymentRecordsRepository: {},
    usersRepository: {}
  })

  mockModule('shared/services/wechatMiniProgram.js', {
    createMiniProgramPayment: async () => ({}),
    buildMiniProgramPaymentParams: () => ({}),
    decryptWechatPayResource: value => value
  })

  const { isCloudPayPaymentMode, isWechatPaymentMode } = require(path.join(backendRoot, 'shared/services/paymentShell.js'))

  assert.equal(isCloudPayPaymentMode(), true)
  assert.equal(isWechatPaymentMode(), false)
})

test('cloudpay preparation returns trusted unified order payload from stored order', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/wechatMiniProgram.js',
    'shared/services/paymentShell.js'
  ])

  const state = {
    paymentRecord: null,
    order: {
      id: 'package-order-prepare-1',
      order_no: 'LDPKG-20260507-000001',
      user_id: 'user-1',
      order_type: 2,
      course_id: null,
      group_id: null,
      package_id: 'PKG-20260507-0001',
      package_group_id: 'PG-20260507-0001',
      package_action: 'join',
      amount: 3000,
      status: 'pending'
    },
    user: {
      id: 'user-1',
      openid: 'wx-openid-1',
      nickname: '微信用户'
    }
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true,
      paymentProviderMode: 'cloudpay',
      internalPaymentSecret: 'test-secret'
    }
  })

  mockModule('repositories/index.js', {
    ordersRepository: {
      findOrderForUser: async ({ userId, orderId }) =>
        userId === state.order.user_id && orderId === state.order.id ? { ...state.order } : null
    },
    usersRepository: {
      findUserById: async id => (id === state.user.id ? { ...state.user } : null)
    },
    paymentRecordsRepository: {
      findPaymentRecordByOrderId: async orderId =>
        state.paymentRecord && state.paymentRecord.order_id === orderId ? { ...state.paymentRecord } : null,
      createPaymentRecord: async payload => {
        state.paymentRecord = {
          id: 'payment-record-cloudpay-1',
          ...payload
        }
        return { ...state.paymentRecord }
      }
    }
  })

  mockModule('shared/services/wechatMiniProgram.js', {
    createMiniProgramPayment: async () => ({}),
    buildMiniProgramPaymentParams: () => ({}),
    decryptWechatPayResource: value => value
  })

  const { prepareCloudPayUnifiedOrder } = require(path.join(backendRoot, 'shared/services/paymentShell.js'))
  const result = await prepareCloudPayUnifiedOrder({
    userId: 'user-1',
    openId: 'wx-openid-1',
    orderId: 'package-order-prepare-1',
    now: new Date('2026-05-07T10:00:00.000Z')
  })

  assert.equal(result.body.includes('邻动体适能课程报名'), true)
  assert.equal(result.outTradeNo, 'LDPKG-20260507-000001')
  assert.equal(result.totalFee, 3000)
  assert.equal(result.openId, 'wx-openid-1')
  assert.equal(Buffer.byteLength(result.attach, 'utf8') <= 128, true)
  assert.equal(JSON.parse(result.attach).orderNo, 'LDPKG-20260507-000001')
  assert.equal(state.paymentRecord.payment_mode, 'cloudpay')
  assert.equal(state.paymentRecord.amount, 3000)
})

test('cloudpay preparation resolves user from openid when cloud function omits user id', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/wechatMiniProgram.js',
    'shared/services/paymentShell.js'
  ])

  const state = {
    paymentRecord: null,
    order: {
      id: 'package-order-openid-1',
      order_no: 'LDPKG-20260508-000001',
      user_id: 'user-openid-1',
      order_type: 2,
      package_id: 'PKG-20260508-0001',
      package_group_id: 'PG-20260508-0001',
      amount: 3000,
      status: 'pending'
    },
    user: {
      id: 'user-openid-1',
      openid: 'wx-openid-cloudpay',
      nickname: '云支付用户'
    }
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true,
      paymentProviderMode: 'cloudpay',
      internalPaymentSecret: 'test-secret'
    }
  })

  mockModule('repositories/index.js', {
    ordersRepository: {
      findOrderForUser: async ({ userId, orderId }) =>
        userId === state.order.user_id && orderId === state.order.id ? { ...state.order } : null
    },
    usersRepository: {
      findUserById: async id => (id === state.user.id ? { ...state.user } : null),
      findUserByOpenId: async openId => (openId === state.user.openid ? { ...state.user } : null)
    },
    paymentRecordsRepository: {
      findPaymentRecordByOrderId: async orderId =>
        state.paymentRecord && state.paymentRecord.order_id === orderId ? { ...state.paymentRecord } : null,
      createPaymentRecord: async payload => {
        state.paymentRecord = {
          id: 'payment-record-openid-1',
          ...payload
        }
        return { ...state.paymentRecord }
      }
    }
  })

  mockModule('shared/services/wechatMiniProgram.js', {
    createMiniProgramPayment: async () => ({}),
    buildMiniProgramPaymentParams: () => ({}),
    decryptWechatPayResource: value => value
  })

  const { prepareCloudPayUnifiedOrder } = require(path.join(backendRoot, 'shared/services/paymentShell.js'))
  const result = await prepareCloudPayUnifiedOrder({
    openId: 'wx-openid-cloudpay',
    orderId: 'package-order-openid-1'
  })

  assert.equal(result.orderId, 'package-order-openid-1')
  assert.equal(result.openId, 'wx-openid-cloudpay')
  assert.equal(state.paymentRecord.user_id, 'user-openid-1')
})

test('cloudpay callback rejects amount mismatch before marking paid', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/wechatMiniProgram.js',
    'shared/services/groupOrders.js',
    'shared/services/packageOrders.js',
    'shared/services/paymentShell.js'
  ])

  const state = {
    paymentRecord: {
      id: 'payment-record-amount',
      order_id: 'package-order-amount',
      user_id: 'user-1',
      out_trade_no: 'LDPKG-20260507-000002',
      status: 'pending',
      amount: 3000
    },
    order: {
      id: 'package-order-amount',
      user_id: 'user-1',
      order_type: 2,
      amount: 3000,
      status: 'pending'
    },
    packagePaymentSuccessCalls: []
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true,
      paymentProviderMode: 'cloudpay',
      internalPaymentSecret: 'test-secret'
    }
  })

  mockModule('repositories/index.js', {
    paymentRecordsRepository: {
      findPaymentRecordByOutTradeNo: async outTradeNo =>
        outTradeNo === state.paymentRecord.out_trade_no ? { ...state.paymentRecord } : null,
      updatePaymentRecord: async (id, patch) => {
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
    decryptWechatPayResource: value => value
  })

  mockModule('shared/services/groupOrders.js', {
    markOrderPaymentSuccess: async () => ({})
  })

  mockModule('shared/services/packageOrders.js', {
    markPackageOrderPaymentSuccess: async payload => {
      state.packagePaymentSuccessCalls.push(payload)
      return {}
    }
  })

  const { handleCloudPayPaymentCallback } = require(path.join(backendRoot, 'shared/services/paymentShell.js'))
  await assert.rejects(
    () =>
      handleCloudPayPaymentCallback({
        payload: {
          out_trade_no: 'LDPKG-20260507-000002',
          transaction_id: 'wx-transaction-amount',
          total_fee: 1,
          return_code: 'SUCCESS',
          result_code: 'SUCCESS'
        }
      }),
    /amount mismatch/
  )

  assert.equal(state.packagePaymentSuccessCalls.length, 0)
  assert.equal(state.paymentRecord.status, 'pending')
})

test('cloudpay refund preparation returns stable refund number for paid order', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/wechatMiniProgram.js',
    'shared/services/paymentShell.js'
  ])

  const state = {
    order: {
      id: 'package-order-refund-1',
      order_no: 'LDPKG-20260507-000003',
      user_id: 'user-1',
      order_type: 2,
      amount: 3000,
      status: 'success'
    },
    paymentRecord: {
      id: 'payment-record-refund-1',
      order_id: 'package-order-refund-1',
      out_trade_no: 'LDPKG-20260507-000003',
      transaction_id: 'wx-transaction-refund-1',
      amount: 3000,
      status: 'paid'
    }
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true,
      paymentProviderMode: 'cloudpay',
      internalPaymentSecret: 'test-secret'
    }
  })

  mockModule('repositories/index.js', {
    ordersRepository: {
      findOrderById: async orderId => (orderId === state.order.id ? { ...state.order } : null)
    },
    paymentRecordsRepository: {
      findPaymentRecordByOrderId: async orderId =>
        orderId === state.paymentRecord.order_id ? { ...state.paymentRecord } : null
    },
    usersRepository: {}
  })

  mockModule('shared/services/wechatMiniProgram.js', {
    createMiniProgramPayment: async () => ({}),
    buildMiniProgramPaymentParams: () => ({}),
    decryptWechatPayResource: value => value
  })

  const { prepareCloudPayRefund } = require(path.join(backendRoot, 'shared/services/paymentShell.js'))
  const result = await prepareCloudPayRefund({
    orderId: 'package-order-refund-1',
    reason: '用户协商退款'
  })

  assert.equal(result.orderId, 'package-order-refund-1')
  assert.equal(result.outTradeNo, 'LDPKG-20260507-000003')
  assert.equal(result.outRefundNo, 'RF-LDPKG-20260507-000003')
  assert.equal(result.totalFee, 3000)
  assert.equal(result.refundFee, 3000)
})

test('expired package group cleanup starts wechat refunds and marks orders pending', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/wechatMiniProgram.js',
    'shared/services/paymentShell.js',
    'shared/services/packageGroupStore.js'
  ])

  const state = {
    refundCalls: [],
    group: {
      id: 'PG-EXPIRED-REFUND',
      package_id: 'PKG-EXPIRED-REFUND',
      status: 'active',
      target_count: 2,
      min_success_count: 2,
      current_count: 1,
      deadline: '2026-05-08T10:00:00.000Z'
    },
    orders: [
      {
        id: 'order-expired-refund-1',
        order_no: 'LDPKG-EXPIRED-001',
        user_id: 'user-1',
        order_type: 2,
        package_id: 'PKG-EXPIRED-REFUND',
        package_group_id: 'PG-EXPIRED-REFUND',
        amount: 3000,
        status: 'success'
      }
    ],
    paymentRecord: {
      id: 'payment-expired-refund-1',
      order_id: 'order-expired-refund-1',
      out_trade_no: 'LDPKG-EXPIRED-001',
      amount: 3000,
      status: 'paid',
      callback_status: 'SUCCESS',
      callback_payload: null
    }
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true,
      paymentProviderMode: 'wechat'
    }
  })

  mockModule('repositories/index.js', {
    ordersRepository: {
      listPendingOrderIdsByUserAndPackage: async () => [],
      listOrdersByPackageGroupId: async ({ packageGroupId, status }) =>
        state.orders.filter(item => item.package_group_id === packageGroupId && item.status === status),
      closeOrdersByIds: async () => [],
      findOrderById: async id => state.orders.find(item => item.id === id) || null,
      updateOrder: async (id, patch) => {
        const order = state.orders.find(item => item.id === id)
        Object.assign(order, patch)
        return { ...order }
      }
    },
    packageGroupsRepository: {
      listPackageGroups: async ({ statuses = [], beforeDeadline } = {}) =>
        [state.group]
          .filter(item => !statuses.length || statuses.includes(item.status))
          .filter(item => !beforeDeadline || new Date(item.deadline).getTime() <= new Date(beforeDeadline).getTime()),
      bulkUpdatePackageGroupStatus: async ({ packageGroupIds, status }) => {
        if (packageGroupIds.includes(state.group.id)) {
          state.group.status = status
        }
        return [{ ...state.group }]
      },
      updatePackageGroup: async (id, patch) => {
        if (id === state.group.id) {
          Object.assign(state.group, patch)
        }
        return { ...state.group }
      }
    },
    paymentRecordsRepository: {
      findPaymentRecordByOrderId: async orderId =>
        orderId === state.paymentRecord.order_id ? { ...state.paymentRecord } : null,
      updatePaymentRecord: async (id, patch) => {
        if (id === state.paymentRecord.id) {
          Object.assign(state.paymentRecord, patch)
        }
        return { ...state.paymentRecord }
      }
    },
    usersRepository: {}
  })

  mockModule('shared/services/wechatMiniProgram.js', {
    createMiniProgramPayment: async () => ({}),
    buildMiniProgramPaymentParams: () => ({}),
    decryptWechatPayResource: value => value,
    createWechatPayRefund: async payload => {
      state.refundCalls.push(payload)
      return {
        status: 'PROCESSING',
        out_refund_no: payload.outRefundNo
      }
    }
  })

  mockModule('shared/services/groupResultNotifications.js', {
    enqueueNotificationsForGroups: async () => []
  })

  const { cleanupExpiredPackageGroups } = require(path.join(backendRoot, 'shared/services/packageGroupStore.js'))
  const result = await cleanupExpiredPackageGroups({
    packageId: 'PKG-EXPIRED-REFUND',
    now: new Date('2026-05-09T10:00:00.000Z')
  })

  assert.deepEqual(result.refundPendingOrderIds, ['order-expired-refund-1'])
  assert.deepEqual(result.refundedOrderIds, [])
  assert.equal(state.group.status, 'failed')
  assert.equal(state.group.current_count, 0)
  assert.equal(state.orders[0].status, 'refund_pending')
  assert.equal(state.paymentRecord.status, 'refund_pending')
  assert.equal(state.paymentRecord.callback_status, 'REFUND_PENDING')
  assert.equal(state.refundCalls[0].outTradeNo, 'LDPKG-EXPIRED-001')
  assert.equal(state.refundCalls[0].outRefundNo, 'RF-LDPKG-EXPIRED-001')
})

test('cloudpay refund confirmation marks the order refunded and cancels an emptied active package group', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/paymentRecordStatus.js',
    'shared/services/packageRefundService.js',
    'shared/services/paymentShell.js'
  ])

  const state = {
    order: {
      id: 'order-refund-1',
      order_no: 'LDPKG-20260508-000101',
      user_id: 'user-1',
      order_type: 2,
      package_id: 'PKG-20260508-0001',
      package_group_id: 'PG-20260508-00001',
      package_action: 'join',
      amount: 3000,
      status: 'refund_pending',
      refund_reason: '客服发起退款'
    },
    group: {
      id: 'PG-20260508-00001',
      package_id: 'PKG-20260508-0001',
      status: 'active',
      target_count: 4,
      current_count: 1,
      weekday: 6,
      hour: 10,
      deadline: '2026-05-10T10:00:00.000Z',
      first_class_time: null
    },
    orders: [],
    paymentRecord: {
      id: 'payment-record-1',
      order_id: 'order-refund-1',
      amount: 3000,
      status: 'paid',
      callback_status: 'SUCCESS',
      out_trade_no: 'LDPKG-20260508-000101'
    }
  }

  state.orders = [state.order]

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true,
      paymentProviderMode: 'cloudpay',
      internalPaymentSecret: 'test-secret'
    }
  })

  mockModule('repositories/index.js', {
    ordersRepository: {
      findOrderById: async id => state.orders.find(item => item.id === id) || null,
      listOrdersByPackageGroupId: async ({ packageGroupId, status }) =>
        state.orders.filter(item => item.package_group_id === packageGroupId && item.status === status),
      updateOrder: async (id, patch) => {
        const order = state.orders.find(item => item.id === id)
        Object.assign(order, patch)
        return { ...order }
      },
      closeOrdersByIds: async () => []
    },
    packageGroupsRepository: {
      findPackageGroupById: async id => (id === state.group.id ? { ...state.group } : null),
      updatePackageGroup: async (id, patch) => {
        if (id === state.group.id) {
          Object.assign(state.group, patch)
        }
        return { ...state.group }
      }
    },
    paymentRecordsRepository: {
      findPaymentRecordByOrderId: async orderId =>
        orderId === state.paymentRecord.order_id ? { ...state.paymentRecord } : null,
      updatePaymentRecord: async (id, patch) => {
        if (id === state.paymentRecord.id) {
          Object.assign(state.paymentRecord, patch)
        }
        return { ...state.paymentRecord }
      }
    },
    usersRepository: {}
  })

  const { markCloudPayRefundResult } = require(path.join(backendRoot, 'shared/services/paymentShell.js'))
  const result = await markCloudPayRefundResult({
    payload: {
      orderId: 'order-refund-1',
      reason: '客服发起退款'
    },
    now: new Date('2026-05-08T12:00:00.000Z')
  })

  assert.equal(result.order.status, 'refunded')
  assert.equal(result.group.status, 'canceled')
  assert.equal(result.group.current_count, 0)
  assert.equal(result.paymentRecord.status, 'refunded')
})

test('cloudpay refund confirmation keeps a full-refund success group in refund_pending until all members settle', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/paymentRecordStatus.js',
    'shared/services/packageRefundService.js',
    'shared/services/paymentShell.js'
  ])

  const state = {
    orders: [
      {
        id: 'order-refund-group-1',
        order_no: 'LDPKG-20260508-000201',
        user_id: 'user-1',
        order_type: 2,
        package_id: 'PKG-20260508-0002',
        package_group_id: 'PG-20260508-00002',
        package_action: 'start',
        amount: 3000,
        status: 'refund_pending',
        refund_reason: '整团退款'
      },
      {
        id: 'order-refund-group-2',
        order_no: 'LDPKG-20260508-000202',
        user_id: 'user-2',
        order_type: 2,
        package_id: 'PKG-20260508-0002',
        package_group_id: 'PG-20260508-00002',
        package_action: 'join',
        amount: 3000,
        status: 'refund_pending',
        refund_reason: '整团退款'
      }
    ],
    group: {
      id: 'PG-20260508-00002',
      package_id: 'PKG-20260508-0002',
      status: 'refund_pending',
      target_count: 2,
      current_count: 2,
      weekday: 6,
      hour: 10,
      deadline: '2026-05-10T10:00:00.000Z',
      success_time: '2026-05-08T09:00:00.000Z',
      first_class_time: '2026-05-11T10:00:00.000Z'
    },
    paymentRecord: {
      id: 'payment-record-group-1',
      order_id: 'order-refund-group-1',
      amount: 3000,
      status: 'paid',
      callback_status: 'SUCCESS',
      out_trade_no: 'LDPKG-20260508-000201'
    }
  }

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true,
      paymentProviderMode: 'cloudpay',
      internalPaymentSecret: 'test-secret'
    }
  })

  mockModule('repositories/index.js', {
    ordersRepository: {
      findOrderById: async id => state.orders.find(item => item.id === id) || null,
      listOrdersByPackageGroupId: async ({ packageGroupId, status }) =>
        state.orders.filter(item => item.package_group_id === packageGroupId && (!status || item.status === status)),
      updateOrder: async (id, patch) => {
        const order = state.orders.find(item => item.id === id)
        Object.assign(order, patch)
        return { ...order }
      },
      closeOrdersByIds: async () => []
    },
    packageGroupsRepository: {
      findPackageGroupById: async id => (id === state.group.id ? { ...state.group } : null),
      updatePackageGroup: async (id, patch) => {
        if (id === state.group.id) {
          Object.assign(state.group, patch)
        }
        return { ...state.group }
      }
    },
    paymentRecordsRepository: {
      findPaymentRecordByOrderId: async orderId =>
        orderId === state.paymentRecord.order_id ? { ...state.paymentRecord } : null,
      updatePaymentRecord: async (id, patch) => {
        if (id === state.paymentRecord.id) {
          Object.assign(state.paymentRecord, patch)
        }
        return { ...state.paymentRecord }
      }
    },
    usersRepository: {}
  })

  const { markCloudPayRefundResult } = require(path.join(backendRoot, 'shared/services/paymentShell.js'))
  const result = await markCloudPayRefundResult({
    payload: {
      orderId: 'order-refund-group-1',
      reason: '整团退款'
    },
    now: new Date('2026-05-08T12:10:00.000Z')
  })

  assert.equal(result.order.status, 'refunded')
  assert.equal(result.group.status, 'refund_pending')
  assert.equal(result.group.current_count, 1)
  assert.equal(result.paymentRecord.status, 'refunded')
})
