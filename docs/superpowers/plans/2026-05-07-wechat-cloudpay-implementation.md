# Wechat Cloudpay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in this session. Do not use subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the production payment path with WeChat CloudBase cloud pay calls while preserving the existing `lindong-api` order, package group, payment record, and refund business rules.

**Architecture:** The miniprogram creates orders through the existing CloudBase container API, then calls a new `wechat-pay` cloud function for `cloud.cloudPay.unifiedOrder()`. WeChat calls a new callback cloud function, which confirms payment through internal `lindong-api` endpoints. Refunds use the same cloud function adapter and keep all validation and state changes in `lindong-api`.

**Tech Stack:** WeChat miniprogram JavaScript, WeChat cloud functions with `wx-server-sdk`, Node.js `node:test`, Express-compatible `mini-express`, MySQL repositories, CloudBase cloud hosting.

---

## File Structure

- Modify `backend/lindong-api/config/env.js`: expose `paymentProviderMode` and internal payment secret.
- Modify `backend/lindong-api/shared/services/paymentShell.js`: add cloudpay mode, cloud payment preparation, cloud callback handling, refund preparation, and refund finalization helpers.
- Modify `backend/lindong-api/routes/payments.js`: add internal cloudpay endpoints and keep public status/close endpoints stable.
- Modify `backend/lindong-api/shared/services/wechatMiniProgram.js`: remove production dependency on direct v3 pay helpers from the cloudpay path and keep login/phone helpers.
- Create `cloudfunctions/wechat-pay/package.json`: cloud function dependencies.
- Create `cloudfunctions/wechat-pay/index.js`: payment adapter for `prepare`, `refund`, `queryOrder`, and `queryRefund`.
- Create `cloudfunctions/wechat-pay-callback/package.json`: callback cloud function dependencies.
- Create `cloudfunctions/wechat-pay-callback/index.js`: payment callback adapter.
- Modify `miniprogram/utils/package.js`: add `prepareCloudPayment()` helper using `wx.cloud.callFunction`.
- Modify `miniprogram/pages/payment/confirm/index.js`: call cloudpay helper when configured, then invoke `wx.requestPayment`.
- Modify `miniprogram/config/env.js`: add a payment provider resolver if one does not already exist.
- Modify `backend/tests/package-orders.test.js`: cover cloudpay preparation and callback behavior.
- Modify `backend/tests/miniprogram-routes.mysql.test.js`: cover internal cloudpay route behavior without Supabase.
- Modify `docs/2026-04-28-邻动项目1.0交接说明.md` or add a focused deploy note under `docs/deploy/`: document required cloudpay environment variables and smoke checks.

## Task 1: Backend Cloudpay Configuration

**Files:**
- Modify: `backend/lindong-api/config/env.js`
- Test: `backend/tests/package-orders.test.js`

- [ ] **Step 1: Write the failing config test**

Append this test to `backend/tests/package-orders.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/package-orders.test.js --test-name-pattern "cloudpay provider"`

Expected: FAIL with `isCloudPayPaymentMode is not a function`.

- [ ] **Step 3: Add env fields**

In `backend/lindong-api/config/env.js`, add these fields to the exported `env` object:

```js
paymentProviderMode: pickFirst(process.env.PAYMENT_PROVIDER_MODE, 'mock').toLowerCase(),
internalPaymentSecret: getOptionalEnv('INTERNAL_PAYMENT_SECRET'),
```

- [ ] **Step 4: Add cloudpay mode resolution**

In `backend/lindong-api/shared/services/paymentShell.js`, add the constant and update mode resolution:

```js
const PAYMENT_MODE_CLOUDPAY = 'cloudpay'
```

Replace `resolvePaymentMode()` with:

```js
const resolvePaymentMode = () => {
  const mode = `${env.paymentProviderMode || process.env.PAYMENT_PROVIDER_MODE || PAYMENT_MODE_MOCK}`.trim().toLowerCase()
  if (mode === PAYMENT_MODE_WECHAT) {
    return PAYMENT_MODE_WECHAT
  }
  if (mode === PAYMENT_MODE_CLOUDPAY) {
    return PAYMENT_MODE_CLOUDPAY
  }
  return PAYMENT_MODE_MOCK
}

const isCloudPayPaymentMode = () => resolvePaymentMode() === PAYMENT_MODE_CLOUDPAY
```

Export `isCloudPayPaymentMode`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && node --test tests/package-orders.test.js --test-name-pattern "cloudpay provider"`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/lindong-api/config/env.js backend/lindong-api/shared/services/paymentShell.js backend/tests/package-orders.test.js
git commit -m "feat: add cloudpay payment mode"
```

## Task 2: Backend Cloud Payment Preparation

**Files:**
- Modify: `backend/lindong-api/shared/services/paymentShell.js`
- Test: `backend/tests/package-orders.test.js`

- [ ] **Step 1: Write failing preparation test**

Append this test to `backend/tests/package-orders.test.js`:

```js
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
  assert.equal(JSON.parse(result.attach).orderId, 'package-order-prepare-1')
  assert.equal(state.paymentRecord.payment_mode, 'cloudpay')
  assert.equal(state.paymentRecord.amount, 3000)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/package-orders.test.js --test-name-pattern "cloudpay preparation"`

Expected: FAIL with `prepareCloudPayUnifiedOrder is not a function`.

- [ ] **Step 3: Implement preparation helper**

In `backend/lindong-api/shared/services/paymentShell.js`, add:

```js
const prepareCloudPayUnifiedOrder = async ({ supabase, userId, openId, orderId, now = new Date() }) => {
  const order = await getOrderForUser({
    supabase,
    userId,
    orderId
  })

  ensureOrderPayable(order)

  const user = await getUserById({
    supabase,
    userId: order.user_id
  })

  const resolvedOpenId = `${openId || (user && user.openid) || ''}`.trim()
  if (!resolvedOpenId) {
    throw createServiceError(400, 'user openid is required for cloudpay')
  }

  if (user && user.openid && user.openid !== resolvedOpenId) {
    throw createServiceError(403, 'openid does not match order user')
  }

  const paymentRecord = await upsertPaymentRecord({
    supabase,
    order,
    paymentMode: PAYMENT_MODE_CLOUDPAY,
    payload: {
      orderId: order.id,
      courseId: order.course_id,
      groupId: order.group_id,
      packageId: order.package_id,
      packageGroupId: order.package_group_id
    },
    now
  })

  const attach = JSON.stringify({
    orderId: order.id,
    groupId: order.group_id || '',
    courseId: order.course_id || '',
    packageId: order.package_id || '',
    packageGroupId: order.package_group_id || ''
  })

  return {
    orderId: order.id,
    openId: resolvedOpenId,
    body: buildPaymentDescription({ order, user }),
    outTradeNo: paymentRecord.out_trade_no,
    totalFee: Number(order.amount) || 0,
    attach,
    paymentRecordId: paymentRecord.id
  }
}
```

Export `prepareCloudPayUnifiedOrder`.

- [ ] **Step 4: Make public prepare return cloudpay metadata**

In `prepareOrderPayment()`, add a branch before the mock fallback:

```js
if (paymentMode === PAYMENT_MODE_CLOUDPAY) {
  paymentRecord = await upsertPaymentRecord({
    supabase,
    order,
    paymentMode,
    payload: {
      orderId: order.id,
      courseId: order.course_id,
      groupId: order.group_id,
      packageId: order.package_id,
      packageGroupId: order.package_group_id
    },
    now
  })
}
```

Keep `canUseRequestPayment` as `false` for `cloudpay`; the miniprogram will use the cloud function instead.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && node --test tests/package-orders.test.js --test-name-pattern "cloudpay preparation"`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/lindong-api/shared/services/paymentShell.js backend/tests/package-orders.test.js
git commit -m "feat: prepare cloudpay unified order payloads"
```

## Task 3: Internal Backend Routes for Cloudpay

**Files:**
- Modify: `backend/lindong-api/routes/payments.js`
- Modify: `backend/lindong-api/shared/services/paymentShell.js`
- Test: `backend/tests/miniprogram-routes.mysql.test.js`

- [ ] **Step 1: Write failing internal route test**

Append this test to `backend/tests/miniprogram-routes.mysql.test.js`:

```js
test('internal cloudpay prepare route requires secret and returns trusted payload', async () => {
  const app = loadAppForMySqlRoutes({ paymentProviderMode: 'cloudpay' })

  const forbidden = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/payments/internal/cloudpay/prepare',
    body: {
      orderId: 'package-order-start-1',
      openId: 'wx-openid-1'
    }
  })

  const prepared = await requestJson({
    app,
    method: 'POST',
    pathname: '/api/payments/internal/cloudpay/prepare',
    headers: {
      'x-internal-payment-secret': 'test-secret'
    },
    body: {
      orderId: 'package-order-start-1',
      openId: 'wx-openid-1',
      userId: 'user-from-cloudbase'
    }
  })

  assert.equal(forbidden.status, 403)
  assert.equal(prepared.status, 200)
  assert.equal(prepared.body.orderId, 'package-order-start-1')
  assert.equal(prepared.body.outTradeNo.length > 0, true)
})
```

Update the existing `mockModule('config/env.js', ...)` inside `loadAppForMySqlRoutes()` to include:

```js
paymentProviderMode,
internalPaymentSecret: 'test-secret'
```

Update its mocked `shared/services/paymentShell.js` with:

```js
prepareCloudPayUnifiedOrder: async ({ orderId, openId, userId }) => ({
  orderId,
  openId,
  userId,
  body: '邻动体适能课程报名-LDPKG-20260428-000001',
  outTradeNo: 'LDPKG-20260428-000001',
  totalFee: 33333,
  attach: JSON.stringify({ orderId })
}),
handleCloudPayPaymentCallback: async ({ payload }) => ({
  orderId: payload.orderId || 'package-order-start-1',
  orderStatus: 'success',
  paymentRecordStatus: 'paid'
}),
isCloudPayPaymentMode: () => `${process.env.PAYMENT_PROVIDER_MODE || ''}`.trim().toLowerCase() === 'cloudpay',
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/miniprogram-routes.mysql.test.js --test-name-pattern "internal cloudpay prepare"`

Expected: FAIL with 404 for `/api/payments/internal/cloudpay/prepare`.

- [ ] **Step 3: Add internal guard**

In `backend/lindong-api/routes/payments.js`, add:

```js
const requireInternalPaymentSecret = (req, res) => {
  const expected = `${env.internalPaymentSecret || ''}`.trim()
  const actual = `${req.headers['x-internal-payment-secret'] || ''}`.trim()
  if (!expected || actual !== expected) {
    res.status(403).json({
      message: 'invalid internal payment secret'
    })
    return false
  }
  return true
}
```

- [ ] **Step 4: Add prepare route**

Import `prepareCloudPayUnifiedOrder` from `paymentShell`, then add:

```js
router.post('/internal/cloudpay/prepare', async (req, res) => {
  if (!requireInternalPaymentSecret(req, res)) {
    return
  }

  const { orderId, openId, userId } = req.body || {}
  if (!orderId || !openId || !userId) {
    return res.status(400).json({
      message: 'orderId, openId and userId are required'
    })
  }

  try {
    return res.json(
      await prepareCloudPayUnifiedOrder({
        supabase: resolveSupabase(),
        orderId,
        openId,
        userId
      })
    )
  } catch (error) {
    console.error('[payments/internal/cloudpay/prepare] failed', { orderId, userId, error })
    return res.status(isServiceError(error) ? error.status : 500).json({
      message: error.message || 'failed to prepare cloudpay payment'
    })
  }
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && node --test tests/miniprogram-routes.mysql.test.js --test-name-pattern "internal cloudpay prepare"`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/lindong-api/routes/payments.js backend/tests/miniprogram-routes.mysql.test.js
git commit -m "feat: expose internal cloudpay prepare route"
```

## Task 4: Cloudpay Payment Callback

**Files:**
- Modify: `backend/lindong-api/shared/services/paymentShell.js`
- Modify: `backend/lindong-api/routes/payments.js`
- Test: `backend/tests/package-orders.test.js`

- [ ] **Step 1: Write failing callback amount test**

Append this test to `backend/tests/package-orders.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/package-orders.test.js --test-name-pattern "amount mismatch"`

Expected: FAIL with `handleCloudPayPaymentCallback is not a function`.

- [ ] **Step 3: Implement cloud callback normalizer**

In `backend/lindong-api/shared/services/paymentShell.js`, add:

```js
const normalizeCloudPayCallbackPayload = payload => {
  const source = payload || {}
  return {
    outTradeNo: `${source.out_trade_no || source.outTradeNo || ''}`.trim(),
    transactionId: `${source.transaction_id || source.transactionId || ''}`.trim(),
    totalFee: Number(source.total_fee ?? source.totalFee ?? 0),
    returnCode: `${source.return_code || source.returnCode || ''}`.trim().toUpperCase(),
    resultCode: `${source.result_code || source.resultCode || ''}`.trim().toUpperCase(),
    openId: `${source.openid || source.openId || ''}`.trim(),
    attach: source.attach || ''
  }
}
```

- [ ] **Step 4: Implement `handleCloudPayPaymentCallback()`**

Add:

```js
const handleCloudPayPaymentCallback = async ({ supabase, payload, now = new Date() }) => {
  const normalized = normalizeCloudPayCallbackPayload(payload)
  if (!normalized.outTradeNo) {
    throw createServiceError(400, 'out_trade_no is required')
  }

  const paymentRecord = await getPaymentRecordByOutTradeNo({
    supabase,
    outTradeNo: normalized.outTradeNo
  })
  if (!paymentRecord) {
    throw createServiceError(404, 'payment record not found')
  }

  const order = await getOrderById({
    supabase,
    orderId: paymentRecord.order_id
  })
  if (!order) {
    throw createServiceError(404, 'order not found')
  }

  if (Number(order.amount) !== Number(normalized.totalFee)) {
    throw createServiceError(400, 'amount mismatch')
  }

  const tradeSuccess = normalized.returnCode === 'SUCCESS' && normalized.resultCode === 'SUCCESS'
  if (!tradeSuccess) {
    return {
      orderId: order.id,
      orderStatus: order.status,
      paymentRecordStatus: paymentRecord.status || 'pending'
    }
  }

  if (paymentRecord.status === 'paid' || order.status === 'success') {
    return {
      orderId: order.id,
      orderStatus: 'success',
      paymentRecordStatus: 'paid'
    }
  }

  await (env.useMySqlRepositories
    ? paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, {
        status: 'paid',
        transaction_id: normalized.transactionId || paymentRecord.transaction_id || '',
        callback_status: 'SUCCESS',
        callback_payload: payload || null,
        paid_at: now,
        updated_at: now
      })
    : paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, {
        status: 'paid',
        transaction_id: normalized.transactionId || paymentRecord.transaction_id || '',
        callback_status: 'SUCCESS',
        callback_payload: payload || null,
        paid_at: now.toISOString(),
        updated_at: now.toISOString()
      }))

  if (Number(order.order_type) === 2) {
    await markPackageOrderPaymentSuccess({
      userId: order.user_id,
      orderId: order.id,
      now
    })
  } else {
    await markOrderPaymentSuccess({
      supabase,
      userId: order.user_id,
      orderId: order.id,
      groupId: order.group_id,
      now
    })
  }

  return {
    orderId: order.id,
    orderStatus: 'success',
    paymentRecordStatus: 'paid'
  }
}
```

If the Supabase branch cannot call `paymentRecordsRepository`, mirror the existing Supabase update style from `handleWechatPaymentCallback()` instead of using the repository.

- [ ] **Step 5: Add internal callback route**

In `backend/lindong-api/routes/payments.js`, import `handleCloudPayPaymentCallback` and add:

```js
router.post('/internal/cloudpay/callback', async (req, res) => {
  if (!requireInternalPaymentSecret(req, res)) {
    return
  }

  try {
    return res.json(
      await handleCloudPayPaymentCallback({
        supabase: resolveSupabase(),
        payload: req.body || {}
      })
    )
  } catch (error) {
    console.error('[payments/internal/cloudpay/callback] failed', { payload: req.body || {}, error })
    return res.status(isServiceError(error) ? error.status : 500).json({
      message: error.message || 'failed to process cloudpay callback'
    })
  }
})
```

- [ ] **Step 6: Run callback tests**

Run: `cd backend && node --test tests/package-orders.test.js --test-name-pattern "callback"`

Expected: PASS for existing WeChat callback test and new cloudpay mismatch test.

- [ ] **Step 7: Commit**

```bash
git add backend/lindong-api/shared/services/paymentShell.js backend/lindong-api/routes/payments.js backend/tests/package-orders.test.js
git commit -m "feat: handle cloudpay payment callbacks"
```

## Task 5: WeChat Pay Cloud Function

**Files:**
- Create: `cloudfunctions/wechat-pay/package.json`
- Create: `cloudfunctions/wechat-pay/index.js`

- [ ] **Step 1: Create package file**

Create `cloudfunctions/wechat-pay/package.json`:

```json
{
  "name": "wechat-pay",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "latest"
  }
}
```

- [ ] **Step 2: Create cloud function implementation**

Create `cloudfunctions/wechat-pay/index.js`:

```js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const readEnv = key => `${process.env[key] || ''}`.trim()

const requestBackend = async ({ pathname, body }) => {
  const baseUrl = readEnv('LINDONG_API_BASE_URL').replace(/\/+$/, '')
  const secret = readEnv('INTERNAL_PAYMENT_SECRET')
  if (!baseUrl) {
    throw new Error('LINDONG_API_BASE_URL is required')
  }
  if (!secret) {
    throw new Error('INTERNAL_PAYMENT_SECRET is required')
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Payment-Secret': secret
    },
    body: JSON.stringify(body || {})
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || `backend request failed: ${response.status}`)
  }
  return payload
}

const preparePayment = async event => {
  const wxContext = cloud.getWXContext()
  const prepared = await requestBackend({
    pathname: '/api/payments/internal/cloudpay/prepare',
    body: {
      orderId: event.orderId,
      openId: wxContext.OPENID,
      userId: event.userId
    }
  })

  const paymentResult = await cloud.cloudPay.unifiedOrder({
    body: prepared.body,
    outTradeNo: prepared.outTradeNo,
    spbillCreateIp: event.clientIp || '127.0.0.1',
    subMchId: readEnv('WX_PAY_SUB_MCH_ID'),
    totalFee: Number(prepared.totalFee) || 0,
    envId: readEnv('WX_CLOUD_ENV_ID') || wxContext.ENV,
    functionName: readEnv('WX_PAY_CALLBACK_FUNCTION') || 'wechat-pay-callback',
    attach: prepared.attach || ''
  })

  return {
    code: 0,
    data: {
      orderId: prepared.orderId,
      outTradeNo: prepared.outTradeNo,
      payment: paymentResult.payment
    }
  }
}

const refundPayment = async event => {
  const prepared = await requestBackend({
    pathname: '/api/payments/internal/cloudpay/refund/prepare',
    body: {
      orderId: event.orderId,
      reason: event.reason,
      operatorId: event.operatorId
    }
  })

  const refundResult = await cloud.cloudPay.refund({
    subMchId: readEnv('WX_PAY_SUB_MCH_ID'),
    outTradeNo: prepared.outTradeNo,
    outRefundNo: prepared.outRefundNo,
    totalFee: Number(prepared.totalFee) || 0,
    refundFee: Number(prepared.refundFee) || 0,
    refundDesc: prepared.refundDesc || '课程退款'
  })

  await requestBackend({
    pathname: '/api/payments/internal/cloudpay/refund/confirm',
    body: {
      orderId: prepared.orderId,
      outRefundNo: prepared.outRefundNo,
      refundResult
    }
  })

  return {
    code: 0,
    data: refundResult
  }
}

exports.main = async event => {
  const type = `${event && event.type || ''}`.trim()
  if (type === 'prepare') {
    return preparePayment(event || {})
  }
  if (type === 'refund') {
    return refundPayment(event || {})
  }
  if (type === 'queryOrder') {
    return cloud.cloudPay.queryOrder({
      subMchId: readEnv('WX_PAY_SUB_MCH_ID'),
      outTradeNo: event.outTradeNo
    })
  }
  if (type === 'queryRefund') {
    return cloud.cloudPay.refundQuery({
      subMchId: readEnv('WX_PAY_SUB_MCH_ID'),
      outRefundNo: event.outRefundNo
    })
  }
  throw new Error('unsupported wechat-pay type')
}
```

- [ ] **Step 3: Syntax check**

Run: `node --check cloudfunctions/wechat-pay/index.js`

Expected: no output and exit code 0.

- [ ] **Step 4: Commit**

```bash
git add cloudfunctions/wechat-pay/package.json cloudfunctions/wechat-pay/index.js
git commit -m "feat: add wechat pay cloud function"
```

## Task 6: WeChat Pay Callback Cloud Function

**Files:**
- Create: `cloudfunctions/wechat-pay-callback/package.json`
- Create: `cloudfunctions/wechat-pay-callback/index.js`

- [ ] **Step 1: Create package file**

Create `cloudfunctions/wechat-pay-callback/package.json`:

```json
{
  "name": "wechat-pay-callback",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "latest"
  }
}
```

- [ ] **Step 2: Create callback implementation**

Create `cloudfunctions/wechat-pay-callback/index.js`:

```js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const readEnv = key => `${process.env[key] || ''}`.trim()

const postBackendCallback = async payload => {
  const baseUrl = readEnv('LINDONG_API_BASE_URL').replace(/\/+$/, '')
  const secret = readEnv('INTERNAL_PAYMENT_SECRET')
  const response = await fetch(`${baseUrl}/api/payments/internal/cloudpay/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Payment-Secret': secret
    },
    body: JSON.stringify(payload || {})
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.message || `backend callback failed: ${response.status}`)
  }
  return body
}

exports.main = async event => {
  try {
    await postBackendCallback(event || {})
    return {
      errcode: 0,
      errmsg: 'SUCCESS'
    }
  } catch (error) {
    console.error('[wechat-pay-callback] failed', {
      event,
      message: error && error.message
    })
    return {
      errcode: -1,
      errmsg: (error && error.message) || 'FAILED'
    }
  }
}
```

- [ ] **Step 3: Syntax check**

Run: `node --check cloudfunctions/wechat-pay-callback/index.js`

Expected: no output and exit code 0.

- [ ] **Step 4: Commit**

```bash
git add cloudfunctions/wechat-pay-callback/package.json cloudfunctions/wechat-pay-callback/index.js
git commit -m "feat: add wechat pay callback cloud function"
```

## Task 7: Miniprogram Payment Integration

**Files:**
- Modify: `miniprogram/config/env.js`
- Modify: `miniprogram/utils/package.js`
- Modify: `miniprogram/pages/payment/confirm/index.js`

- [ ] **Step 1: Add payment provider config**

In `miniprogram/config/env.js`, add `paymentProvider: 'cloudpay'` for the target CloudBase environment config. Export:

```js
const resolvePaymentProviderByEnv = envVersion => {
  const config = resolveConfigByEnv(envVersion)
  return `${config.paymentProvider || 'mock'}`.trim().toLowerCase()
}
```

Add `resolvePaymentProviderByEnv` to `module.exports`.

- [ ] **Step 2: Wire app global data**

In `miniprogram/app.js`, import `resolvePaymentProviderByEnv`, set:

```js
this.globalData.paymentProvider = resolvePaymentProviderByEnv(envVersion)
```

Also add the default:

```js
paymentProvider: resolvePaymentProviderByEnv('develop'),
```

- [ ] **Step 3: Add cloudpay helper**

In `miniprogram/utils/package.js`, add:

```js
const prepareCloudPayment = ({ orderId, userId = '' }) =>
  new Promise((resolve, reject) => {
    const app = getApp()
    if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
      reject(new Error('当前微信版本不支持云支付'))
      return
    }

    wx.cloud.callFunction({
      name: 'wechat-pay',
      data: {
        type: 'prepare',
        orderId,
        userId
      },
      success(result) {
        const data = result && result.result && (result.result.data || result.result)
        if (!data || !data.payment) {
          reject(new Error('支付参数生成失败'))
          return
        }
        resolve(data)
      },
      fail(error) {
        reject(error)
      }
    })
  })
```

Export `prepareCloudPayment`.

- [ ] **Step 4: Use cloudpay in payment confirm page**

In `miniprogram/pages/payment/confirm/index.js`, import `prepareCloudPayment`. In `handleConfirmPay()`, replace the payment preparation block with:

```js
const app = getApp()
const paymentProvider = `${app.globalData.paymentProvider || ''}`.trim().toLowerCase()

if (paymentProvider === 'cloudpay') {
  const cloudPayment = await prepareCloudPayment({
    orderId
  })
  await invokeWechatPayment(cloudPayment.payment || {})
  wx.showLoading({
    title: '确认支付中',
    mask: true
  })
  const confirmation = await waitForPaymentConfirmation({
    orderId,
    fallbackPackageGroupId: nextPackageGroupId
  })
  wx.hideLoading()
  nextPackageGroupId = confirmation.packageGroupId || nextPackageGroupId
  if (!confirmation.confirmed) {
    wx.redirectTo({
      url:
        `/pages/payment/result/index?status=processing` +
        `&packageId=${this.data.packageId}` +
        `&packageGroupId=${encodeURIComponent(nextPackageGroupId)}` +
        `&action=${this.data.action}` +
        `&targetCount=${this.data.targetCount}` +
        `&weekday=${this.data.weekday}` +
        `&hour=${this.data.hour}` +
        `&childNickname=${encodeURIComponent(this.data.childNickname.trim())}` +
        `&childAge=${encodeURIComponent(this.data.childAge)}` +
        `&parentMobile=${encodeURIComponent(this.data.parentMobile)}`
    })
    return
  }
} else {
  const paymentPreparation = await preparePayment({
    orderId
  })
  if (paymentPreparation && paymentPreparation.canUseRequestPayment) {
    await invokeWechatPayment(paymentPreparation.paymentParams || {})
    wx.showLoading({
      title: '确认支付中',
      mask: true
    })
    const confirmation = await waitForPaymentConfirmation({
      orderId,
      fallbackPackageGroupId: nextPackageGroupId
    })
    wx.hideLoading()
    nextPackageGroupId = confirmation.packageGroupId || nextPackageGroupId
    if (!confirmation.confirmed) {
      wx.redirectTo({
        url:
          `/pages/payment/result/index?status=processing` +
          `&packageId=${this.data.packageId}` +
          `&packageGroupId=${encodeURIComponent(nextPackageGroupId)}` +
          `&action=${this.data.action}` +
          `&targetCount=${this.data.targetCount}` +
          `&weekday=${this.data.weekday}` +
          `&hour=${this.data.hour}` +
          `&childNickname=${encodeURIComponent(this.data.childNickname.trim())}` +
          `&childAge=${encodeURIComponent(this.data.childAge)}` +
          `&parentMobile=${encodeURIComponent(this.data.parentMobile)}`
      })
      return
    }
  } else {
    if (paymentPreparation && paymentPreparation.paymentMode === 'wechat') {
      throw new Error('支付暂不可用，请稍后重试')
    }
    const paymentResult = await mockPaymentSuccess({
      orderId
    })
    nextPackageGroupId = (paymentResult && paymentResult.packageGroupId) || nextPackageGroupId
  }
}
```

Keep this change scoped to the cloudpay branch and existing payment flow. Do not refactor unrelated page structure or shared UI helpers.

- [ ] **Step 5: Syntax-style smoke**

Run: `cd miniprogram && npm test`

If no test script exists, run: `node --check pages/payment/confirm/index.js`

Expected: syntax check succeeds.

- [ ] **Step 6: Commit**

```bash
git add miniprogram/config/env.js miniprogram/app.js miniprogram/utils/package.js miniprogram/pages/payment/confirm/index.js
git commit -m "feat: call cloudpay from miniprogram payment page"
```

## Task 8: Refund Backend and Cloud Function Flow

**Files:**
- Modify: `backend/lindong-api/shared/services/paymentShell.js`
- Modify: `backend/lindong-api/routes/payments.js`
- Modify: `backend/console-api-service/console-api/services/ordersService.js`
- Test: `backend/tests/package-orders.test.js`
- Test: `backend/tests/package-group-admin.test.js`

- [ ] **Step 1: Write failing refund preparation test**

Append to `backend/tests/package-orders.test.js`:

```js
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
```

- [ ] **Step 2: Implement refund helpers**

In `paymentShell.js`, add:

```js
const buildOutRefundNo = order => `RF-${buildOutTradeNo(order)}`.slice(0, 64)

const prepareCloudPayRefund = async ({ supabase, orderId, reason }) => {
  const order = await getOrderById({
    supabase,
    orderId
  })
  if (!order) {
    throw createServiceError(404, 'order not found')
  }
  if (order.status !== 'success') {
    throw createServiceError(400, 'only paid order can be refunded')
  }

  const paymentRecord = await getPaymentRecordByOrderId({
    supabase,
    orderId: order.id
  })
  if (!paymentRecord || paymentRecord.status !== 'paid') {
    throw createServiceError(400, 'paid payment record is required')
  }

  return {
    orderId: order.id,
    outTradeNo: paymentRecord.out_trade_no || buildOutTradeNo(order),
    outRefundNo: buildOutRefundNo(order),
    totalFee: Number(order.amount) || Number(paymentRecord.amount) || 0,
    refundFee: Number(order.amount) || Number(paymentRecord.amount) || 0,
    refundDesc: `${reason || '课程退款'}`.slice(0, 80)
  }
}
```

Also add `markCloudPayRefundResult()` to update `payment_records.status='refunded'` when cloud refund succeeds, mirroring the existing `markPaymentRecordRefunded` helper.

- [ ] **Step 3: Add refund internal routes**

In `routes/payments.js`, add:

```js
router.post('/internal/cloudpay/refund/prepare', async (req, res) => {
  if (!requireInternalPaymentSecret(req, res)) {
    return
  }
  const { orderId, reason } = req.body || {}
  if (!orderId) {
    return res.status(400).json({ message: 'orderId is required' })
  }
  try {
    return res.json(
      await prepareCloudPayRefund({
        supabase: resolveSupabase(),
        orderId,
        reason
      })
    )
  } catch (error) {
    return res.status(isServiceError(error) ? error.status : 500).json({
      message: error.message || 'failed to prepare cloudpay refund'
    })
  }
})

router.post('/internal/cloudpay/refund/confirm', async (req, res) => {
  if (!requireInternalPaymentSecret(req, res)) {
    return
  }
  try {
    return res.json(
      await markCloudPayRefundResult({
        supabase: resolveSupabase(),
        payload: req.body || {}
      })
    )
  } catch (error) {
    return res.status(isServiceError(error) ? error.status : 500).json({
      message: error.message || 'failed to confirm cloudpay refund'
    })
  }
})
```

- [ ] **Step 4: Connect admin refund to cloudpay**

In `backend/console-api-service/console-api/services/ordersService.js`, keep current validation and rollback logic. Before locally marking `status='refunded'`, call a shared helper or internal cloudpay refund endpoint when `env.paymentProviderMode === 'cloudpay'`. Use the same `orderId` and `reason`. If the cloud refund call fails, throw and leave the order as `success`.

The minimal helper shape:

```js
const requestCloudPayRefund = async ({ orderId, reason, admin }) => {
  const baseUrl = `${process.env.LINDONG_API_BASE_URL || process.env.APP_ORIGIN || ''}`.replace(/\/+$/, '')
  const secret = `${process.env.INTERNAL_PAYMENT_SECRET || ''}`.trim()
  if (!baseUrl || !secret) {
    throw new Error('cloudpay refund backend config is incomplete')
  }
  const response = await fetch(`${baseUrl}/api/payments/internal/cloudpay/refund/prepare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Payment-Secret': secret
    },
    body: JSON.stringify({
      orderId,
      reason,
      operatorId: admin && admin.id
    })
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'cloudpay refund failed')
  }
  return payload
}
```

If the console API cannot call the cloud function directly, defer admin refund cloud invocation to Task 9 and keep this task scoped to backend payment routes.

- [ ] **Step 5: Run refund tests**

Run: `cd backend && node --test tests/package-orders.test.js --test-name-pattern "refund preparation"`

Expected: PASS.

Also run: `cd backend && node --test tests/package-group-admin.test.js`

Expected: existing admin refund tests still pass.

- [ ] **Step 6: Commit**

```bash
git add backend/lindong-api/shared/services/paymentShell.js backend/lindong-api/routes/payments.js backend/console-api-service/console-api/services/ordersService.js backend/tests/package-orders.test.js backend/tests/package-group-admin.test.js
git commit -m "feat: prepare cloudpay refunds"
```

## Task 9: Documentation and Environment Runbook

**Files:**
- Create: `docs/deploy/2026-05-07-wechat-cloudpay-runbook.md`

- [ ] **Step 1: Write runbook**

Create `docs/deploy/2026-05-07-wechat-cloudpay-runbook.md`:

```md
# 微信支付云调用部署 Runbook

## 环境变量

云函数 `wechat-pay` 和 `wechat-pay-callback`：

- `LINDONG_API_BASE_URL`
- `INTERNAL_PAYMENT_SECRET`
- `WX_PAY_SUB_MCH_ID`
- `WX_CLOUD_ENV_ID`
- `WX_PAY_CALLBACK_FUNCTION=wechat-pay-callback`

云托管 `lindong-api`：

- `PAYMENT_PROVIDER_MODE=cloudpay`
- `INTERNAL_PAYMENT_SECRET`

## 发布顺序

1. 部署 `lindong-api`。
2. 上传并部署 `cloudfunctions/wechat-pay`。
3. 上传并部署 `cloudfunctions/wechat-pay-callback`。
4. 发布小程序体验版。

## 支付冒烟

1. 使用体验版登录。
2. 选择课包并开团。
3. 确认支付并完成 1 分钱或正式金额支付。
4. 核对 `orders.status=success`。
5. 核对 `payment_records.status=paid`。
6. 核对 `orders.transaction_id` 或 `payment_records.transaction_id` 能在微信商户后台查到。

## 退款冒烟

1. 后台选择一笔未成团已支付订单。
2. 发起手动退款。
3. 核对微信商户后台退款单。
4. 核对 `orders.status=refunded`。
5. 核对 `payment_records.status=refunded`。

## 回滚

1. 将 `PAYMENT_PROVIDER_MODE` 改回 `mock`。
2. 重新部署 `lindong-api`。
3. 小程序配置改回 mock 支付模式并重新发布体验版。
```

- [ ] **Step 2: Link from handoff doc**

In `docs/2026-04-28-邻动项目1.0交接说明.md`, add a short line in the payment handoff section:

```md
正式微信支付云调用接入和部署检查见 `docs/deploy/2026-05-07-wechat-cloudpay-runbook.md`。
```

- [ ] **Step 3: Commit**

```bash
git add docs/deploy/2026-05-07-wechat-cloudpay-runbook.md docs/2026-04-28-邻动项目1.0交接说明.md
git commit -m "docs: add cloudpay deployment runbook"
```

## Task 10: Full Verification

**Files:**
- No source changes unless tests reveal defects.

- [ ] **Step 1: Run backend payment tests**

Run: `cd backend && node --test tests/package-orders.test.js`

Expected: all tests pass.

- [ ] **Step 2: Run miniprogram route smoke**

Run: `cd backend && node --test tests/miniprogram-routes.mysql.test.js`

Expected: all tests pass.

- [ ] **Step 3: Run admin package tests**

Run: `cd backend && node --test tests/package-group-admin.test.js`

Expected: all tests pass.

- [ ] **Step 4: Syntax-check cloud functions**

Run:

```bash
node --check cloudfunctions/wechat-pay/index.js
node --check cloudfunctions/wechat-pay-callback/index.js
```

Expected: both commands exit 0.

- [ ] **Step 5: Manual CloudBase verification**

In WeChat DevTools:

1. Upload and deploy `wechat-pay`.
2. Upload and deploy `wechat-pay-callback`.
3. Open the miniprogram experience build.
4. Complete one open-group payment.
5. Complete one join-group payment.
6. Cancel one payment and verify order closure.
7. Trigger one backend refund.

Expected:

- Paid orders become `success`.
- `payment_records` become `paid`.
- Package group member count changes only after callback confirmation.
- Refunded orders become `refunded`.
- No mock payment call is accepted in `cloudpay` mode.

- [ ] **Step 6: Commit verification-only fixes if needed**

If verification required code changes:

```bash
git add <changed-files>
git commit -m "fix: stabilize cloudpay verification"
```

If no changes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: the plan covers cloudpay mode, payment preparation, payment cloud function, callback cloud function, miniprogram invocation, refund preparation, deployment docs, and verification.
- Placeholder scan: no `TBD`, `TODO`, or open-ended implementation placeholders remain. The one branch about console API refund invocation states an explicit fallback boundary for Task 8.
- Type consistency: endpoint names use `/api/payments/internal/cloudpay/*`; provider mode is consistently `cloudpay`; cloud functions are consistently named `wechat-pay` and `wechat-pay-callback`.
- User constraints: execution is inline only, with no subagents and no extra refactoring beyond the payment/refund integration.
