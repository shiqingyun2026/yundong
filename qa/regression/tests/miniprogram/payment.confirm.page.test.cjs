const test = require('node:test')
const assert = require('node:assert/strict')

const { createPageHarness, createWxMock, loadPageDefinition } = require('./helpers.cjs')

const packageUtils = require('../../../../miniprogram/utils/package')
const authUtils = require('../../../../miniprogram/utils/auth')

const buildPackageDetail = () => ({
  id: 'package_seed_active_002',
  name: '[测试] 深圳宝安体能进阶·等待上课',
  totalPriceFen: 198000,
  groupPriceConfig: [{ targetCount: 4, priceFen: 49500 }],
  supportedPeople: [4]
})

test('miniprogram payment confirm page: join flow validates parent fields before creating order', async () => {
  const originalFetchPackageDetail = packageUtils.fetchPackageDetail
  const originalFetchPackageGroupDetail = packageUtils.fetchPackageGroupDetail
  const originalLoginAndStoreSession = authUtils.loginAndStoreSession

  const { wx, calls, storage } = createWxMock()
  global.wx = wx
  global.getApp = () => ({})
  storage.set('token', 'seed-token')

  packageUtils.fetchPackageDetail = async () => buildPackageDetail()
  packageUtils.fetchPackageGroupDetail = async () => ({
    id: 'PG-20260428-00001',
    targetCount: 4,
    currentCount: 2,
    memberAmountFen: 49500,
    status: 'active',
    scheduleText: '每周六 10:00，共5次，成团后锁定首课日期',
    scheduleDisplayText: '每周六 10:00 共5节课',
    members: [{ displayText: '小雨   10岁', avatar_url: '/assets/member-default-avatar.jpg' }],
    packageInfo: { id: 'package_seed_active_002', name: '课包' }
  })
  authUtils.loginAndStoreSession = async () => ({ token: 'seed-token' })

  const page = createPageHarness(loadPageDefinition('pages/payment/confirm/index.js'))
  await page.onLoad({
    action: 'join',
    packageId: 'package_seed_active_002',
    packageGroupId: 'PG-20260428-00001'
  })

  await assert.rejects(
    page.createOrderIfNeeded(),
    /请填写学生昵称/
  )

  assert.equal(page.data.paymentAmountButtonText, '495元')
  assert.equal(page.data.packageGroupDetail.scheduleDisplayText, '每周六 10:00 共5节课')
  assert.equal(calls.setNavigationBarTitle[0].title, '参与拼团')

  packageUtils.fetchPackageDetail = originalFetchPackageDetail
  packageUtils.fetchPackageGroupDetail = originalFetchPackageGroupDetail
  authUtils.loginAndStoreSession = originalLoginAndStoreSession
})

test('miniprogram payment confirm page: canceling payment closes order and redirects to result page', async () => {
  const originalFetchPackageDetail = packageUtils.fetchPackageDetail
  const originalCreatePackageStartOrder = packageUtils.createPackageStartOrder
  const originalPreparePayment = packageUtils.preparePayment
  const originalClosePaymentOrder = packageUtils.closePaymentOrder
  const originalLoginAndStoreSession = authUtils.loginAndStoreSession

  const { wx, calls, storage } = createWxMock()
  global.wx = wx
  global.getApp = () => ({})
  storage.set('token', 'seed-token')

  wx.requestPayment = ({ fail }) => fail({ errMsg: 'requestPayment:fail cancel' })

  packageUtils.fetchPackageDetail = async () => buildPackageDetail()
  packageUtils.createPackageStartOrder = async () => ({
    orderId: 'order-start-1',
    packageGroupId: 'PG-20260428-00002'
  })
  packageUtils.preparePayment = async () => ({
    canUseRequestPayment: true,
    paymentParams: { timeStamp: '1', nonceStr: '2', package: 'prepay_id=3', signType: 'RSA', paySign: 'sig' }
  })
  packageUtils.closePaymentOrder = async ({ orderId }) => ({ orderId })
  authUtils.loginAndStoreSession = async () => ({ token: 'seed-token' })

  const page = createPageHarness(loadPageDefinition('pages/payment/confirm/index.js'))
  await page.onLoad({
    action: 'start',
    packageId: 'package_seed_active_002',
    targetCount: '4',
    weekday: '6',
    hour: '10'
  })

  page.setData({
    childNickname: '小满',
    childAge: '6',
    parentMobile: '13800000000'
  })

  await page.handleConfirmPay()

  assert.equal(calls.showToast.at(-1).title, '已取消支付')
  assert.match(calls.redirectTo.at(-1).url, /\/pages\/payment\/result\/index\?status=cancel/)
  assert.match(calls.redirectTo.at(-1).url, /childNickname=%E5%B0%8F%E6%BB%A1/)

  packageUtils.fetchPackageDetail = originalFetchPackageDetail
  packageUtils.createPackageStartOrder = originalCreatePackageStartOrder
  packageUtils.preparePayment = originalPreparePayment
  packageUtils.closePaymentOrder = originalClosePaymentOrder
  authUtils.loginAndStoreSession = originalLoginAndStoreSession
})

test('miniprogram payment confirm page: mock payment success redirects to group detail success entry', async () => {
  const originalFetchPackageDetail = packageUtils.fetchPackageDetail
  const originalCreatePackageJoinOrder = packageUtils.createPackageJoinOrder
  const originalPreparePayment = packageUtils.preparePayment
  const originalMockPaymentSuccess = packageUtils.mockPaymentSuccess
  const originalFetchPackageGroupDetail = packageUtils.fetchPackageGroupDetail
  const originalLoginAndStoreSession = authUtils.loginAndStoreSession

  const { wx, calls, storage } = createWxMock()
  global.wx = wx
  global.getApp = () => ({})
  storage.set('token', 'seed-token')

  packageUtils.fetchPackageDetail = async () => buildPackageDetail()
  packageUtils.fetchPackageGroupDetail = async () => ({
    id: 'PG-20260428-00001',
    targetCount: 4,
    currentCount: 2,
    memberAmountFen: 49500,
    status: 'active',
    packageInfo: { id: 'package_seed_active_002', name: '课包' }
  })
  packageUtils.createPackageJoinOrder = async () => ({
    orderId: 'order-join-1',
    packageGroupId: 'PG-20260428-00001'
  })
  packageUtils.preparePayment = async () => ({
    canUseRequestPayment: false,
    paymentMode: 'mock'
  })
  packageUtils.mockPaymentSuccess = async () => ({
    packageGroupId: 'PG-20260428-00003'
  })
  authUtils.loginAndStoreSession = async () => ({ token: 'seed-token' })

  const page = createPageHarness(loadPageDefinition('pages/payment/confirm/index.js'))
  await page.onLoad({
    action: 'join',
    packageId: 'package_seed_active_002',
    packageGroupId: 'PG-20260428-00001'
  })

  page.setData({
    childNickname: '小满',
    childAge: '6',
    parentMobile: '13800000000'
  })

  await page.handleConfirmPay()

  assert.match(calls.redirectTo.at(-1).url, /\/pages\/group\/detail\/index\?packageGroupId=PG-20260428-00003/)
  assert.match(calls.redirectTo.at(-1).url, /entry=paymentSuccess/)
  assert.match(calls.redirectTo.at(-1).url, /action=join/)

  packageUtils.fetchPackageDetail = originalFetchPackageDetail
  packageUtils.createPackageJoinOrder = originalCreatePackageJoinOrder
  packageUtils.preparePayment = originalPreparePayment
  packageUtils.mockPaymentSuccess = originalMockPaymentSuccess
  packageUtils.fetchPackageGroupDetail = originalFetchPackageGroupDetail
  authUtils.loginAndStoreSession = originalLoginAndStoreSession
})

test('miniprogram payment confirm page: join flow builds multi-class schedule preview and compact summary', async () => {
  const originalFetchPackageDetail = packageUtils.fetchPackageDetail
  const originalFetchPackageGroupDetail = packageUtils.fetchPackageGroupDetail
  const originalLoginAndStoreSession = authUtils.loginAndStoreSession

  const { wx, storage } = createWxMock()
  global.wx = wx
  global.getApp = () => ({})
  storage.set('token', 'seed-token')

  packageUtils.fetchPackageDetail = async () => ({
    ...buildPackageDetail(),
    classDurationMinutes: 90
  })
  packageUtils.fetchPackageGroupDetail = async () => ({
    id: 'PG-20260428-00001',
    targetCount: 4,
    currentCount: 2,
    memberAmountFen: 49500,
    status: 'active',
    scheduleList: [
      { index: 1, class_time: '2026-06-19 09:00:00' },
      { index: 2, display_text: '2026-06-24 周三 13:30' }
    ],
    packageInfo: {
      id: 'package_seed_active_002',
      name: '课包',
      classCount: 5
    }
  })
  authUtils.loginAndStoreSession = async () => ({ token: 'seed-token' })

  const page = createPageHarness(loadPageDefinition('pages/payment/confirm/index.js'))
  await page.onLoad({
    action: 'join',
    packageId: 'package_seed_active_002',
    packageGroupId: 'PG-20260428-00001'
  })

  assert.equal(page.data.joinScheduleSummaryText, '5节课，详见课表')
  assert.equal(page.data.paymentScheduleList.length, 2)
  assert.equal(page.data.paymentScheduleList[0].displayText, '2026-06-19 周五09:00 - 10:30')
  assert.equal(page.data.paymentScheduleList[1].displayText, '2026-06-24 周三 13:30')

  packageUtils.fetchPackageDetail = originalFetchPackageDetail
  packageUtils.fetchPackageGroupDetail = originalFetchPackageGroupDetail
  authUtils.loginAndStoreSession = originalLoginAndStoreSession
})
