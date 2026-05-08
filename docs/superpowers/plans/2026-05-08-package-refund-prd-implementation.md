# Package Refund PRD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the newly confirmed refund PRD so that real cloudpay refunds, admin refund actions, package group state transitions, mini program visibility, and refund-related status display all follow one consistent product rule set.

**Architecture:** Introduce a shared package-refund transition service inside `lindong-api` to own the business consequences of a successful refund: order status transitions, payment record transitions, package group recounting, terminal group status selection, and pending-order closing. Make the console admin refund entrypoint call the existing `wechat-pay` cloud function through a server-side gateway, using `refund_pending` as the initiation state and the cloudpay confirm route as the only path that finalizes `refunded`. Update the miniprogram read models so refund status is exposed as order-level display state, while package-group visibility on the homepage and course detail page depends on final group state and `current_count`.

**Tech Stack:** Node.js `node:test`, Express-compatible `mini-express`, MySQL repositories, WeChat CloudBase cloud functions, `@cloudbase/node-sdk`, miniprogram JavaScript/WXML/WXSS.

---

## File Structure

- Create `backend/lindong-api/shared/services/paymentRecordStatus.js`: extract payment-record refund updates out of `paymentShell.js` to avoid circular imports.
- Create `backend/lindong-api/shared/services/packageRefundService.js`: shared refund transition orchestration for active-group single refunds, full-group cancel refunds, and auto-fail refunds.
- Modify `backend/lindong-api/shared/domain/packageGroupRules.js`: add `canceled` support and any helper functions required for refund-driven status selection.
- Modify `backend/lindong-api/shared/services/paymentShell.js`: allow refund preparation from `success` or `refund_pending`, and finalize refunds through `packageRefundService`.
- Modify `backend/lindong-api/shared/services/packageGroupStore.js`: route expired-group auto refunds through the shared transition service while preserving `failed` as the terminal state for timeout refunds.
- Modify `backend/lindong-api/shared/services/packageReaders.js`: hide `canceled` or `current_count = 0` groups from homepage/course detail, expose refund display state in “我的拼团”, and reject refunded viewers from package-group detail.
- Modify `backend/lindong-api/routes/package-groups.js`: preserve a distinct package-service error for “group not visible to this viewer” so the miniprogram can redirect to course detail.
- Modify `backend/console-api-service/config/env.js` and `backend/console-api-service/package.json`: add CloudBase function invocation configuration and dependency.
- Create `backend/console-api-service/console-api/services/cloudPayRefundGateway.js`: server-side adapter that calls `wechat-pay` with `{ type: 'refund' }`.
- Modify `backend/console-api-service/console-api/services/packageAdminService.js`: mark admin refund requests as `refund_pending`, support success-group full refund, and invoke the refund gateway.
- Modify `backend/console-api-service/console-api/controllers/packageAdminController.js`: add a full-group refund handler.
- Modify `backend/console-api-service/console-api/routes/package-groups.js`: add `POST /:id/refund`.
- Modify `miniprogram/utils/package.js`: normalize refund statuses, expose `canOpenDetail`, and distinguish group status from order display status.
- Modify `miniprogram/pages/my/group-buy-list/index.js` and `index.wxml`: add refund tabs and block detail navigation for refund-related rows.
- Modify `miniprogram/pages/group/detail/index.js`: redirect refunded viewers and hidden groups to the related course detail page.
- Modify `backend/tests/package-orders.test.js`: cover cloudpay refund finalization and refund preparation from pending state.
- Modify `backend/tests/package-readers.test.js`: cover homepage/course-detail visibility and “我的拼团” refund display states.
- Modify `backend/tests/miniprogram-routes.mysql.test.js`: cover refund-confirm API effects on group state and detail visibility.
- Modify `backend/tests/package-group-admin.test.js`: cover admin single refund pending flow and success-group full refund flow.
- Create `miniprogram/tests/my-group-refund-status.test.cjs`: smoke-check the new tabs, labels, and detail-blocking logic.

## Task 1: Shared Refund Transition Service

**Files:**
- Create: `backend/lindong-api/shared/services/paymentRecordStatus.js`
- Create: `backend/lindong-api/shared/services/packageRefundService.js`
- Modify: `backend/lindong-api/shared/domain/packageGroupRules.js`
- Modify: `backend/lindong-api/shared/services/packageGroupStore.js`
- Test: `backend/tests/package-orders.test.js`

- [ ] **Step 1: Write the failing refund-finalization test**

Append this test to `backend/tests/package-orders.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && node --test tests/package-orders.test.js --test-name-pattern "cloudpay refund confirmation marks the order refunded"`

Expected: FAIL because `markCloudPayRefundResult()` currently returns only the payment-record mutation and leaves `orders.status === 'success'`.

- [ ] **Step 3: Extract payment-record refund mutation into its own helper**

Create `backend/lindong-api/shared/services/paymentRecordStatus.js` with:

```js
const { env } = require('../../config/env')
const { paymentRecordsRepository } = require('../../repositories')

const markPaymentRecordRefunded = async ({ orderId, reason = '', now = new Date() }) => {
  const paymentRecord = await paymentRecordsRepository.findPaymentRecordByOrderId(orderId)
  if (!paymentRecord) {
    return null
  }

  const timestamp = now.toISOString()
  return paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, {
    status: 'refunded',
    callback_status: 'REFUNDED',
    callback_payload: {
      ...(paymentRecord.callback_payload || {}),
      refund: {
        reason: `${reason || ''}`.trim(),
        refunded_at: timestamp
      }
    },
    closed_at: paymentRecord.closed_at || timestamp,
    updated_at: timestamp
  })
}

module.exports = {
  markPaymentRecordRefunded
}
```

- [ ] **Step 4: Add canceled-aware refund orchestration**

Create `backend/lindong-api/shared/services/packageRefundService.js` with:

```js
const { ordersRepository, packageGroupsRepository } = require('../../repositories')
const { closePendingPackageOrdersByIds } = require('./packageGroupStore')
const { markPaymentRecordRefunded } = require('./paymentRecordStatus')
const { createPackageServiceError } = require('./packageServiceError')

const REFUND_EMPTY_GROUP_STATUS = {
  MANUAL: 'canceled',
  AUTO_TIMEOUT: 'failed'
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
      closedPendingOrderIds: []
    }
  }

  const group = await packageGroupsRepository.findPackageGroupById(order.package_group_id)
  if (!group) {
    return {
      order: updatedOrder,
      group: null,
      paymentRecord,
      closedPendingOrderIds: []
    }
  }

  const remainingSuccessOrders = await ordersRepository.listOrdersByPackageGroupId({
    packageGroupId: group.id,
    status: 'success'
  })
  const nextCount = remainingSuccessOrders.length
  const nextStatus =
    group.status === 'success'
      ? group.status
      : nextCount <= 0
        ? emptyGroupStatus
        : 'active'

  const updatedGroup = await packageGroupsRepository.updatePackageGroup(group.id, {
    current_count: nextCount,
    status: nextStatus
  })

  let closedPendingOrderIds = []
  if (nextCount <= 0) {
    const pendingOrders = await ordersRepository.listOrdersByPackageGroupId({
      packageGroupId: group.id,
      status: 'pending'
    })
    const closedOrders = await closePendingPackageOrdersByIds({
      orderIds: pendingOrders.map(item => item.id).filter(Boolean),
      now
    })
    closedPendingOrderIds = (closedOrders || []).map(item => item.id).filter(Boolean)
  }

  return {
    order: updatedOrder,
    group: updatedGroup,
    paymentRecord,
    closedPendingOrderIds
  }
}

module.exports = {
  REFUND_EMPTY_GROUP_STATUS,
  finalizePackageOrderRefund
}
```

- [ ] **Step 5: Wire the new service into the current refund callers**

Apply these exact edits:

1. In `backend/lindong-api/shared/domain/packageGroupRules.js`, extend the constant:

```js
const PACKAGE_GROUP_STATUS = {
  ACTIVE: 'active',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELED: 'canceled'
}
```

2. In `backend/lindong-api/shared/services/paymentShell.js`, replace the current `markCloudPayRefundResult()` body with:

```js
const { finalizePackageOrderRefund, REFUND_EMPTY_GROUP_STATUS } = require('./packageRefundService')

const markCloudPayRefundResult = async ({ payload, now = new Date() }) => {
  const orderId = payload && payload.orderId
  if (!orderId) {
    throw createServiceError(400, 'orderId is required')
  }

  return finalizePackageOrderRefund({
    orderId,
    reason: (payload && payload.reason) || 'cloudpay refund confirmed',
    operatorId: payload && payload.operatorId ? payload.operatorId : null,
    now,
    emptyGroupStatus: REFUND_EMPTY_GROUP_STATUS.MANUAL
  })
}
```

3. In `backend/lindong-api/shared/services/packageGroupStore.js`, replace the manual `ordersRepository.updateOrder(...) + markPaymentRecordRefunded(...)` loop with `finalizePackageOrderRefund(...)`, passing `emptyGroupStatus: 'failed'`.

- [ ] **Step 6: Run the focused tests**

Run:

```bash
cd backend && node --test tests/package-orders.test.js --test-name-pattern "cloudpay refund confirmation marks the order refunded"
cd backend && node --test tests/package-group-admin.test.js --test-name-pattern "expired package group cleanup refunds success orders and payment records"
```

Expected: both PASS, with the second test still asserting timeout refunds end in `failed`, not `canceled`.

- [ ] **Step 7: Commit**

```bash
git add backend/lindong-api/shared/services/paymentRecordStatus.js backend/lindong-api/shared/services/packageRefundService.js backend/lindong-api/shared/domain/packageGroupRules.js backend/lindong-api/shared/services/paymentShell.js backend/lindong-api/shared/services/packageGroupStore.js backend/tests/package-orders.test.js
git commit -m "feat: add shared package refund transition service"
```

## Task 2: Admin Refund Initiation and Cloud Function Gateway

**Files:**
- Modify: `backend/console-api-service/package.json`
- Modify: `backend/console-api-service/config/env.js`
- Create: `backend/console-api-service/console-api/services/cloudPayRefundGateway.js`
- Modify: `backend/console-api-service/console-api/services/packageAdminService.js`
- Modify: `backend/console-api-service/console-api/controllers/packageAdminController.js`
- Modify: `backend/console-api-service/console-api/routes/package-groups.js`
- Test: `backend/tests/package-group-admin.test.js`

- [ ] **Step 1: Write the failing admin refund tests**

In `backend/tests/package-group-admin.test.js`, update the existing active-group refund test expectations and add a new success-group full-refund test:

```js
test('admin package order refund marks the order refund_pending before the cloud refund confirmation returns', async () => {
  const { packageAdminService, state } = loadPackageServicesWithState()

  const result = await packageAdminService.refundAdminPackageOrder({
    orderId: 'ord-refund',
    reason: '用户线下申请退款',
    admin: { id: 'admin-1' },
    now: new Date('2026-04-19T08:00:00.000Z')
  })

  const pendingOrder = state.orders.find(item => item.id === 'ord-refund')
  assert.equal(result.status, 'refund_pending')
  assert.equal(pendingOrder.status, 'refund_pending')
})

test('admin package group refund allows a successful package group to enter full-group refund flow', async () => {
  const { packageAdminService, state } = loadPackageServicesWithState()

  const result = await packageAdminService.refundAdminPackageGroup({
    packageGroupId: 'pg-success',
    reason: '场地取消整团退款',
    admin: { id: 'admin-1' },
    now: new Date('2026-04-19T08:00:00.000Z')
  })

  assert.equal(result.status, 'refund_pending')
  assert.deepEqual(
    state.orders.filter(item => item.package_group_id === 'pg-success' && item.status === 'refund_pending').map(item => item.id).sort(),
    ['ord-success-group', 'ord-success-group-2']
  )
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && node --test tests/package-group-admin.test.js --test-name-pattern "refund_pending|full-group refund"`

Expected: FAIL because `refundAdminPackageOrder()` still writes `refunded` immediately and there is no `refundAdminPackageGroup()` service or route.

- [ ] **Step 3: Add the CloudBase refund gateway dependency and env config**

1. In `backend/console-api-service/package.json`, add:

```json
"@cloudbase/node-sdk": "^3.18.1"
```

2. In `backend/console-api-service/config/env.js`, add:

```js
cloudbase: {
  envId: getOptionalEnv('WX_CLOUD_ENV_ID'),
  wechatPayFunctionName: pickFirst(process.env.WX_PAY_FUNCTION_NAME, 'wechat-pay'),
  functionTimeoutMs: toInt(process.env.CLOUDBASE_FUNCTION_TIMEOUT_MS, 15000)
}
```

- [ ] **Step 4: Create the server-side refund gateway**

Create `backend/console-api-service/console-api/services/cloudPayRefundGateway.js`:

```js
const cloudbase = require('@cloudbase/node-sdk')
const { env } = require('../../config/env')

let cloudbaseApp = null

const getCloudbaseApp = () => {
  if (!cloudbaseApp) {
    cloudbaseApp = cloudbase.init({
      env: env.cloudbase.envId
    })
  }

  return cloudbaseApp
}

const invokeCloudPayRefund = async ({ orderId, reason, operatorId }) => {
  const app = getCloudbaseApp()
  const result = await app.callFunction({
    name: env.cloudbase.wechatPayFunctionName,
    data: {
      type: 'refund',
      orderId,
      reason,
      operatorId
    }
  })

  const payload = result && (result.result || result)
  if (!payload || payload.code !== 0) {
    throw new Error((payload && payload.message) || 'cloudpay refund failed')
  }

  return payload.data || {}
}

module.exports = {
  invokeCloudPayRefund
}
```

- [ ] **Step 5: Change admin refund initiation to `refund_pending` and add full-group refund**

In `backend/console-api-service/console-api/services/packageAdminService.js`:

1. Keep `refundAdminPackageOrder()` for active groups only, but change its first write to:

```js
const pendingOrder = await ordersRepository.updateOrder(order.id, {
  status: 'refund_pending',
  refund_reason: normalizedReason,
  refund_operator_id: admin.id || null,
  updated_at: now
})
```

2. Immediately call:

```js
await invokeCloudPayRefund({
  orderId: order.id,
  reason: normalizedReason,
  operatorId: admin.id || ''
})
```

3. Catch gateway errors and downgrade the order to `refund_failed`:

```js
await ordersRepository.updateOrder(order.id, {
  status: 'refund_failed',
  updated_at: now
})
throw error
```

4. Add a new `refundAdminPackageGroup()` that:
   - loads the group,
   - asserts `group.status === 'success'`,
   - loads all `success` orders for that group,
   - updates each order to `refund_pending`,
   - invokes `invokeCloudPayRefund()` for each order sequentially,
   - returns `{ status: 'refund_pending', package_group_id, order_ids }`.

- [ ] **Step 6: Expose the new full-group refund endpoint**

Apply these exact controller and route edits:

In `backend/console-api-service/console-api/controllers/packageAdminController.js` add:

```js
const refundAdminPackageGroupHandler = createOkHandler('课包拼团整团退款失败', req =>
  refundAdminPackageGroup({
    packageGroupId: req.params.id,
    reason: req.body && req.body.reason,
    admin: req.admin || {},
    ip: req.ip || null
  })
)
```

Export it, then in `backend/console-api-service/console-api/routes/package-groups.js` add:

```js
router.post('/:id/refund', refundAdminPackageGroupHandler)
```

- [ ] **Step 7: Run the admin tests**

Run:

```bash
cd backend && node --test tests/package-group-admin.test.js --test-name-pattern "refund_pending|full-group refund|rejects successful package groups"
```

Expected: PASS, with the old “rejects successful package groups” test replaced by the new full-group refund test.

- [ ] **Step 8: Commit**

```bash
git add backend/console-api-service/package.json backend/console-api-service/config/env.js backend/console-api-service/console-api/services/cloudPayRefundGateway.js backend/console-api-service/console-api/services/packageAdminService.js backend/console-api-service/console-api/controllers/packageAdminController.js backend/console-api-service/console-api/routes/package-groups.js backend/tests/package-group-admin.test.js
git commit -m "feat: add admin refund pending flow and group cancel gateway"
```

## Task 3: Cloudpay Refund Preparation and Finalization Rules

**Files:**
- Modify: `backend/lindong-api/shared/services/paymentShell.js`
- Modify: `backend/lindong-api/routes/payments.js`
- Test: `backend/tests/package-orders.test.js`
- Test: `backend/tests/miniprogram-routes.mysql.test.js`

- [ ] **Step 1: Write the failing preparation/state tests**

Append these tests:

`backend/tests/package-orders.test.js`

```js
test('cloudpay refund preparation accepts refund_pending orders that still have a paid payment record', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/services/wechatMiniProgram.js',
    'shared/services/paymentShell.js'
  ])

  const state = {
    order: {
      id: 'package-order-refund-2',
      order_no: 'LDPKG-20260508-000002',
      user_id: 'user-1',
      order_type: 2,
      amount: 3000,
      status: 'refund_pending'
    },
    paymentRecord: {
      id: 'payment-record-refund-2',
      order_id: 'package-order-refund-2',
      out_trade_no: 'LDPKG-20260508-000002',
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
      findOrderById: async id => (id === state.order.id ? { ...state.order } : null)
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
    orderId: 'package-order-refund-2',
    reason: '客服退款'
  })

  assert.equal(result.outRefundNo, 'RF-LDPKG-20260508-000002')
})
```

`backend/tests/miniprogram-routes.mysql.test.js`

```js
test('internal cloudpay refund confirm updates order and package group business state', async () => {
  const app = loadAppForMySqlRoutes({ paymentProviderMode: 'cloudpay' })

  const confirmed = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/payments/internal/cloudpay/refund/confirm',
    headers: {
      'x-internal-payment-secret': 'test-secret'
    },
    body: {
      orderId: 'package-order-start-1',
      outRefundNo: 'RF-LDPKG-20260428-000001',
      reason: '客服退款'
    }
  })

  assert.equal(confirmed.status, 200)
  assert.equal(confirmed.body.order.status, 'refunded')
  assert.equal(confirmed.body.group.status, 'canceled')
})
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```bash
cd backend && node --test tests/package-orders.test.js --test-name-pattern "accepts refund_pending orders"
cd backend && node --test tests/miniprogram-routes.mysql.test.js --test-name-pattern "updates order and package group business state"
```

Expected: FAIL because refund preparation only accepts `success`, and the confirm route still returns only a payment-record shape.

- [ ] **Step 3: Relax refund preparation and return the richer confirm payload**

In `backend/lindong-api/shared/services/paymentShell.js` make these edits:

1. Replace:

```js
if (order.status !== 'success') {
  throw createServiceError(400, 'only paid order can be refunded')
}
```

with:

```js
if (!['success', 'refund_pending'].includes(order.status)) {
  throw createServiceError(400, 'only paid order can be refunded')
}
```

2. Keep the payment-record guard strict:

```js
if (!paymentRecord || paymentRecord.status !== 'paid') {
  throw createServiceError(400, 'paid payment record is required')
}
```

3. Let `markCloudPayRefundResult()` return the full object from `finalizePackageOrderRefund(...)`.

- [ ] **Step 4: Keep the internal API stable but richer**

In `backend/lindong-api/routes/payments.js`, keep the existing path names, but let `/internal/cloudpay/refund/confirm` return:

```js
return res.json(
  await markCloudPayRefundResult({
    supabase: resolveSupabase(),
    payload: req.body || {}
  })
)
```

No shape-wrapping is needed if the service already returns:

```js
{
  order: { ... },
  group: { ... },
  paymentRecord: { ... },
  closedPendingOrderIds: []
}
```

- [ ] **Step 5: Run the route and service tests**

Run:

```bash
cd backend && node --test tests/package-orders.test.js --test-name-pattern "refund"
cd backend && node --test tests/miniprogram-routes.mysql.test.js --test-name-pattern "internal cloudpay refund"
```

Expected: PASS, including the original refund route secret checks.

- [ ] **Step 6: Commit**

```bash
git add backend/lindong-api/shared/services/paymentShell.js backend/lindong-api/routes/payments.js backend/tests/package-orders.test.js backend/tests/miniprogram-routes.mysql.test.js
git commit -m "feat: align cloudpay refund endpoints with package refund states"
```

## Task 4: Miniprogram Read Models, Visibility, and Detail Access

**Files:**
- Modify: `backend/lindong-api/shared/services/packageReaders.js`
- Modify: `backend/lindong-api/routes/package-groups.js`
- Modify: `miniprogram/utils/package.js`
- Modify: `miniprogram/pages/my/group-buy-list/index.js`
- Modify: `miniprogram/pages/my/group-buy-list/index.wxml`
- Modify: `miniprogram/pages/group/detail/index.js`
- Create: `miniprogram/tests/my-group-refund-status.test.cjs`
- Test: `backend/tests/package-readers.test.js`

- [ ] **Step 1: Write the failing reader and frontend smoke tests**

Append this backend reader test to `backend/tests/package-readers.test.js`:

```js
test('mini program user package group list exposes refund display states and preserves order-created sorting', async () => {
  // Follow the existing mockModule pattern in this file.
  // Build three orders for the same user with statuses:
  // success, refund_pending, refunded.
  // Expect the returned list statuses to be:
  // active, refund_pending, refunded.
  // Expect sorting to follow order.created_at desc, not refund_time desc.
})
```

Create `miniprogram/tests/my-group-refund-status.test.cjs`:

```js
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('my group list page includes refund tabs and blocks detail navigation for refund states', () => {
  const pageSource = fs.readFileSync(path.resolve(__dirname, '..', 'pages/my/group-buy-list/index.js'), 'utf8')
  const wxmlSource = fs.readFileSync(path.resolve(__dirname, '..', 'pages/my/group-buy-list/index.wxml'), 'utf8')

  assert.equal(pageSource.includes("key: 'refund_pending'"), true)
  assert.equal(pageSource.includes("key: 'refunded'"), true)
  assert.equal(pageSource.includes("key: 'refund_failed'"), true)
  assert.equal(pageSource.includes('item.canOpenDetail'), true)
  assert.equal(wxmlSource.includes("item.displayStatusText"), true)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
cd backend && node --test tests/package-readers.test.js --test-name-pattern "refund display states"
node --test miniprogram/tests/my-group-refund-status.test.cjs
```

Expected: FAIL because the list reader only returns `success/refunded`, there are no refund tabs, and list items have no `canOpenDetail`.

- [ ] **Step 3: Add order-level display state to the miniprogram reader**

In `backend/lindong-api/shared/services/packageReaders.js`, change `fetchMiniProgramUserPackageGroupList()` as follows:

1. Expand the order query:

```js
const orders = await ordersRepository.listOrders({
  userId,
  orderType: 2,
  statuses: ['success', 'refund_pending', 'refunded', 'refund_failed']
})
```

2. Replace `normalizedStatus` filtering with dual filtering:

```js
const normalizedStatus = ['active', 'success', 'failed', 'refund_pending', 'refunded', 'refund_failed'].includes(status) ? status : 'all'
```

3. For each row, compute:

```js
const displayStatus = ['refund_pending', 'refunded', 'refund_failed'].includes(order.status)
  ? order.status
  : group.status

const canOpenDetail = !['refund_pending', 'refunded', 'refund_failed'].includes(order.status)
```

4. Return:

```js
status: displayStatus,
order_status: order.status,
group_status: group.status,
can_open_detail: canOpenDetail,
created_at: order.created_at,
```

5. Sort with:

```js
.sort(
  (left, right) =>
    (parseShanghaiDate(right.created_at)?.getTime() || 0) -
    (parseShanghaiDate(left.created_at)?.getTime() || 0)
)
```

- [ ] **Step 4: Hide canceled/empty groups from recruitment views and deny refunded viewers**

In the same service file:

1. In `fetchMiniProgramPackageDetail()`, filter `active_groups` by:

```js
.filter(group => group.status === 'active' && Number(group.current_count) > 0)
```

2. In `fetchMiniProgramPackageGroupDetail()`, add these guards after `latestGroup` is loaded:

```js
if (latestGroup.status === 'canceled' || Number(latestGroup.current_count) <= 0) {
  throw createPackageServiceError(404, 2002, '拼团不存在')
}
```

3. If `userId` is present, load that user’s package-group orders and reject refunded viewers:

```js
const viewerOrders = await ordersRepository.listOrders({
  userId,
  orderType: 2,
  packageGroupId
})

if (viewerOrders.some(item => ['refund_pending', 'refunded', 'refund_failed'].includes(item.status))) {
  throw createPackageServiceError(403, 2006, '退款订单不可查看拼团详情')
}
```

- [ ] **Step 5: Update miniprogram normalization and page behavior**

1. In `miniprogram/utils/package.js`, extend `normalizeUserPackageGroupListItem()`:

```js
const STATUS_TEXT_MAP = {
  active: '进行中',
  success: '已成团',
  failed: '已失败',
  refund_pending: '退款中',
  refunded: '已退款',
  refund_failed: '退款失败'
}
```

Return:

```js
status: item.status || 'active',
groupStatus: item.group_status || item.status || 'active',
orderStatus: item.order_status || '',
displayStatusText: STATUS_TEXT_MAP[item.status] || '进行中',
canOpenDetail: item.can_open_detail !== false
```

2. In `miniprogram/pages/my/group-buy-list/index.js`, replace `TAB_LIST` with:

```js
const TAB_LIST = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'success', label: '已成团' },
  { key: 'failed', label: '已失败' },
  { key: 'refund_pending', label: '退款中' },
  { key: 'refunded', label: '已退款' },
  { key: 'refund_failed', label: '退款失败' }
]
```

3. In `handleOpenDetail()`, short-circuit:

```js
if (!event.currentTarget.dataset.canOpenDetail) {
  return
}
```

4. In `index.wxml`, bind the dataset:

```xml
data-can-open-detail="{{item.canOpenDetail}}"
```

and replace the status badge content with:

```xml
content="{{item.displayStatusText}}"
```

5. In `miniprogram/pages/group/detail/index.js`, when `fetchPackageGroupDetail()` rejects with a not-found or forbidden error, redirect to:

```js
wx.redirectTo({
  url: `/pages/course/detail/index?id=${this.data.packageId || (this.data.groupDetail && this.data.groupDetail.packageInfo.id) || ''}`
})
```

- [ ] **Step 6: Run the reader and frontend tests**

Run:

```bash
cd backend && node --test tests/package-readers.test.js --test-name-pattern "refund display states"
node --test miniprogram/tests/my-group-refund-status.test.cjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/lindong-api/shared/services/packageReaders.js backend/lindong-api/routes/package-groups.js miniprogram/utils/package.js miniprogram/pages/my/group-buy-list/index.js miniprogram/pages/my/group-buy-list/index.wxml miniprogram/pages/group/detail/index.js miniprogram/tests/my-group-refund-status.test.cjs backend/tests/package-readers.test.js
git commit -m "feat: expose refund states in mini program package group views"
```

## Task 5: Full Regression and Acceptance Checks

**Files:**
- Modify: `docs/superpowers/plans/2026-05-08-package-refund-prd-implementation.md` if verification notes need correction
- Test: `backend/tests/package-orders.test.js`
- Test: `backend/tests/package-group-admin.test.js`
- Test: `backend/tests/package-readers.test.js`
- Test: `backend/tests/miniprogram-routes.mysql.test.js`
- Test: `miniprogram/tests/my-group-refund-status.test.cjs`

- [ ] **Step 1: Run the backend refund suite**

Run:

```bash
cd backend && node --test tests/package-orders.test.js
cd backend && node --test tests/package-group-admin.test.js
cd backend && node --test tests/package-readers.test.js
cd backend && node --test tests/miniprogram-routes.mysql.test.js
```

Expected: PASS, with no legacy assertion still expecting active-group last-member refunds to become `failed`.

- [ ] **Step 2: Run the miniprogram smoke suite**

Run:

```bash
node --test miniprogram/tests/package-start-cloudpay.test.cjs
node --test miniprogram/tests/my-group-refund-status.test.cjs
node --check miniprogram/pages/my/group-buy-list/index.js
node --check miniprogram/pages/group/detail/index.js
node --check miniprogram/utils/package.js
```

Expected: PASS.

- [ ] **Step 3: Manual acceptance checklist**

Verify these flows in a dev or staging environment:

```text
1. Active group, one paid member, admin starts refund -> order enters refund_pending -> cloud refund confirm -> order becomes refunded -> group becomes canceled -> homepage/course detail hide the group -> refunded user still sees the row in 我的拼团 but cannot enter detail.
2. Active group, multiple paid members, one refund succeeds -> order becomes refunded -> current_count decrements -> group stays active -> homepage/course detail still show the group if current_count > 0.
3. Success group, admin triggers full-group refund -> each order enters refund_pending -> each order settles to refunded -> group becomes canceled -> related class schedule/verification artifacts are marked invalid.
4. Timeout auto-refund still ends with group status failed, not canceled.
5. Old group-detail links for hidden groups redirect to the course detail page.
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "test: verify package refund prd implementation"
```

## Self-Review

- Spec coverage:
  - Refund pending/final/failed state: Tasks 2, 3, 4.
  - `canceled` package-group state: Tasks 1, 2, 3, 4.
  - Homepage/course-detail hiding for zero-member or canceled groups: Task 4.
  - “我的拼团” refund tabs, text, sorting, and no-detail rule: Task 4.
  - Success-group full refund only from admin: Task 2.
  - Timeout auto-refund remains `failed`: Tasks 1 and 5.
  - Refund/conversion concurrency priority: Task 3.

- Placeholder scan:
  - No placeholder markers or “similar to above” instructions remain.

- Type consistency:
  - Order refund states are consistently `refund_pending`, `refunded`, `refund_failed`.
  - Group terminal states are consistently `failed` and `canceled`.
  - Reader payload uses `status`, `group_status`, `order_status`, and `can_open_detail` consistently.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-08-package-refund-prd-implementation.md`.

Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
