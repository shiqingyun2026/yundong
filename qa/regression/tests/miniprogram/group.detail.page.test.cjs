const test = require('node:test')
const assert = require('node:assert/strict')

const { createPageHarness, createWxMock, loadPageDefinition } = require('./helpers.cjs')

const packageUtils = require('../../../../miniprogram/utils/package')
const authUtils = require('../../../../miniprogram/utils/auth')
const notificationUtils = require('../../../../miniprogram/utils/notification')

const activeGroupDetail = {
  id: 'pkg-group-active-1',
  status: 'active',
  targetCount: 4,
  currentCount: 2,
  userJoined: true,
  members: [
    {
      user_id: 'user-1',
      nickname: '小满',
      displayText: '小满   6岁'
    }
  ],
  packageInfo: {
    id: 'package_seed_active_002',
    name: '[测试] 深圳宝安体能进阶·等待上课',
    description: '<p>课程介绍</p>',
    coachName: '王教练',
    coachIntro: '<p>教练介绍</p>',
    coachCertificates: ['https://example.com/cert.jpg']
  }
}

test('miniprogram group detail page: payment success entry shows active status presentation and share CTA', async () => {
  const originalFetchPackageGroupDetail = packageUtils.fetchPackageGroupDetail
  const originalLoginAndStoreSession = authUtils.loginAndStoreSession

  const { wx, storage } = createWxMock()
  global.wx = wx
  global.getApp = () => ({
    globalData: {
      subscribeTemplateIds: {
        groupSuccess: 'tmpl-success',
        groupFail: 'tmpl-fail'
      }
    }
  })
  storage.set('token', 'seed-token')
  wx.requestSubscribeMessage = ({ success }) => success({ 'tmpl-success': 'accept', 'tmpl-fail': 'reject' })

  packageUtils.fetchPackageGroupDetail = async () => activeGroupDetail
  authUtils.loginAndStoreSession = async () => ({ token: 'seed-token' })

  const page = createPageHarness(loadPageDefinition('pages/group/detail/index.js'))
  await page.onLoad({
    packageGroupId: 'pkg-group-active-1',
    packageId: 'package_seed_active_002',
    entry: 'paymentSuccess',
    action: 'join'
  })

  assert.equal(page.data.statusText, '进行中')
  assert.equal(page.data.showSuccessEntry, true)
  assert.equal(page.data.showSubscribeCard, true)
  assert.equal(page.data.primaryActionText, '邀请好友参团')
  assert.equal(page.data.successSummaryText, '已参团 · 还差2人成团')
  assert.equal(page.data.groupDetail.members[0].displayText, '小满   6岁')
  assert.equal(page.data.groupDetail.packageInfo.description, '<p>课程介绍</p>')
  assert.equal(page.data.groupDetail.packageInfo.coachName, '王教练')
  assert.deepEqual(page.data.groupDetail.packageInfo.coachCertificates, ['https://example.com/cert.jpg'])

  packageUtils.fetchPackageGroupDetail = originalFetchPackageGroupDetail
  authUtils.loginAndStoreSession = originalLoginAndStoreSession
})

test('miniprogram group detail page: subscribe flow reports success state', async () => {
  const originalFetchPackageGroupDetail = packageUtils.fetchPackageGroupDetail
  const originalLoginAndStoreSession = authUtils.loginAndStoreSession
  const originalReportGroupResultSubscription = notificationUtils.reportGroupResultSubscription

  const { wx, storage } = createWxMock()
  global.wx = wx
  global.getApp = () => ({
    globalData: {
      subscribeTemplateIds: {
        groupSuccess: 'tmpl-success',
        groupFail: 'tmpl-fail'
      }
    }
  })
  storage.set('token', 'seed-token')
  wx.requestSubscribeMessage = ({ success }) => success({ 'tmpl-success': 'accept', 'tmpl-fail': 'reject' })

  packageUtils.fetchPackageGroupDetail = async () => activeGroupDetail
  authUtils.loginAndStoreSession = async () => ({ token: 'seed-token' })
  notificationUtils.reportGroupResultSubscription = async () => {}

  const page = createPageHarness(loadPageDefinition('pages/group/detail/index.js'))
  await page.onLoad({
    packageGroupId: 'pkg-group-active-1',
    packageId: 'package_seed_active_002',
    entry: 'paymentSuccess',
    action: 'join'
  })

  await page.handleSubscribeTap()

  assert.equal(page.data.subscribed, true)
  assert.equal(page.data.subscribeStatusTone, 'success')
  assert.match(page.data.subscribeStatusText, /订阅成功/)

  packageUtils.fetchPackageGroupDetail = originalFetchPackageGroupDetail
  authUtils.loginAndStoreSession = originalLoginAndStoreSession
  notificationUtils.reportGroupResultSubscription = originalReportGroupResultSubscription
})

test('miniprogram group detail page: shared package group opens with join CTA and share path carries join entry', async () => {
  const originalFetchPackageGroupDetail = packageUtils.fetchPackageGroupDetail
  const originalLoginAndStoreSession = authUtils.loginAndStoreSession

  const { wx, storage } = createWxMock()
  global.wx = wx
  global.getApp = () => ({})
  storage.set('token', 'seed-token')

  packageUtils.fetchPackageGroupDetail = async () => activeGroupDetail
  authUtils.loginAndStoreSession = async () => ({ token: 'seed-token' })

  const page = createPageHarness(loadPageDefinition('pages/group/detail/index.js'))
  await page.onLoad({
    packageGroupId: 'pkg-group-active-1',
    packageId: 'package_seed_active_002',
    entry: 'share',
    action: 'join'
  })

  assert.equal(page.data.primaryActionText, '立即参团')
  assert.equal(page.data.showPrimaryShareAction, false)
  assert.equal(page.data.showJoinAction, true)

  const sharePayload = page.onShareAppMessage()
  assert.match(sharePayload.path, /packageGroupId=pkg-group-active-1/)
  assert.match(sharePayload.path, /packageId=package_seed_active_002/)
  assert.match(sharePayload.path, /entry=share/)
  assert.match(sharePayload.path, /action=join/)

  packageUtils.fetchPackageGroupDetail = originalFetchPackageGroupDetail
  authUtils.loginAndStoreSession = originalLoginAndStoreSession
})

test('miniprogram group detail page: ended shared group redirects to package detail with ended toast marker', async () => {
  const originalFetchPackageGroupDetail = packageUtils.fetchPackageGroupDetail
  const originalFetchPackageDetail = packageUtils.fetchPackageDetail
  const originalLoginAndStoreSession = authUtils.loginAndStoreSession

  const { wx, calls, storage } = createWxMock()
  global.wx = wx
  global.getApp = () => ({})
  storage.set('token', 'seed-token')

  packageUtils.fetchPackageGroupDetail = async () => ({
    ...activeGroupDetail,
    status: 'failed',
    currentCount: 0
  })
  packageUtils.fetchPackageDetail = async () => ({
    id: 'package_seed_active_002'
  })
  authUtils.loginAndStoreSession = async () => ({ token: 'seed-token' })

  const page = createPageHarness(loadPageDefinition('pages/group/detail/index.js'))
  await page.onLoad({
    packageGroupId: 'pkg-group-active-1',
    packageId: 'package_seed_active_002',
    entry: 'share',
    action: 'join'
  })

  assert.deepEqual(calls.redirectTo[0], {
    url: '/pages/course/detail/index?id=package_seed_active_002&groupEndedToast=1'
  })

  packageUtils.fetchPackageGroupDetail = originalFetchPackageGroupDetail
  packageUtils.fetchPackageDetail = originalFetchPackageDetail
  authUtils.loginAndStoreSession = originalLoginAndStoreSession
})

test('miniprogram group detail page: ended shared group with offline package falls back home', async () => {
  const originalFetchPackageGroupDetail = packageUtils.fetchPackageGroupDetail
  const originalFetchPackageDetail = packageUtils.fetchPackageDetail
  const originalLoginAndStoreSession = authUtils.loginAndStoreSession

  const { wx, calls, storage } = createWxMock()
  global.wx = wx
  global.getApp = () => ({})
  storage.set('token', 'seed-token')

  packageUtils.fetchPackageGroupDetail = async () => {
    throw {
      code: 2002,
      message: '拼团不存在'
    }
  }
  packageUtils.fetchPackageDetail = async () => {
    throw {
      code: 2001,
      message: '课包不存在'
    }
  }
  authUtils.loginAndStoreSession = async () => ({ token: 'seed-token' })

  const page = createPageHarness(loadPageDefinition('pages/group/detail/index.js'))
  await page.onLoad({
    packageGroupId: 'pkg-group-ended-1',
    packageId: 'package_offline_001',
    entry: 'share',
    action: 'join'
  })

  assert.deepEqual(calls.switchTab[0], {
    url: '/pages/home/index'
  })
  assert.equal(calls.redirectTo.length, 0)

  packageUtils.fetchPackageGroupDetail = originalFetchPackageGroupDetail
  packageUtils.fetchPackageDetail = originalFetchPackageDetail
  authUtils.loginAndStoreSession = originalLoginAndStoreSession
})

test('miniprogram group detail page: shared refunded-viewer error redirects by nested business code payload', async () => {
  const originalFetchPackageGroupDetail = packageUtils.fetchPackageGroupDetail
  const originalFetchPackageDetail = packageUtils.fetchPackageDetail
  const originalLoginAndStoreSession = authUtils.loginAndStoreSession

  const { wx, calls, storage } = createWxMock()
  global.wx = wx
  global.getApp = () => ({})
  storage.set('token', 'seed-token')

  packageUtils.fetchPackageGroupDetail = async () => {
    throw {
      message: '退款订单不可查看拼团详情',
      statusCode: 403,
      data: {
        code: 2006,
        message: '退款订单不可查看拼团详情'
      }
    }
  }
  packageUtils.fetchPackageDetail = async () => ({
    id: 'package_seed_active_002'
  })
  authUtils.loginAndStoreSession = async () => ({ token: 'seed-token' })

  const page = createPageHarness(loadPageDefinition('pages/group/detail/index.js'))
  await page.onLoad({
    packageGroupId: 'pkg-group-refunded-1',
    packageId: 'package_seed_active_002',
    entry: 'share',
    action: 'join'
  })

  assert.deepEqual(calls.redirectTo[0], {
    url: '/pages/course/detail/index?id=package_seed_active_002&groupEndedToast=1'
  })
  assert.equal(calls.showToast.length, 0)

  packageUtils.fetchPackageGroupDetail = originalFetchPackageGroupDetail
  packageUtils.fetchPackageDetail = originalFetchPackageDetail
  authUtils.loginAndStoreSession = originalLoginAndStoreSession
})

test('miniprogram group detail page: enriches fetched schedule rows with package duration before rendering', async () => {
  const originalFetchPackageGroupDetail = packageUtils.fetchPackageGroupDetail
  const originalFetchPackageDetail = packageUtils.fetchPackageDetail
  const originalLoginAndStoreSession = authUtils.loginAndStoreSession

  const { wx, storage } = createWxMock()
  global.wx = wx
  global.getApp = () => ({})
  storage.set('token', 'seed-token')

  packageUtils.fetchPackageGroupDetail = async () => ({
    id: 'pkg-group-active-2',
    status: 'active',
    targetCount: 6,
    currentCount: 2,
    userJoined: true,
    target_count: 6,
    current_count: 2,
    member_amount_fen: 39800,
    remaining_seconds: 166463,
    scheduleList: [
      { index: 1, display_text: '2026-06-19 09:00:00' },
      { index: 2, display_text: '2026-06-24 周三 13:30' }
    ],
    members: [],
    packageInfo: {
      id: 'package_seed_active_002',
      name: '[测试] 深圳宝安体能进阶·等待上课',
      wechatShareCover: 'https://example.com/original-cover.png'
    }
  })
  packageUtils.fetchPackageDetail = async () => ({
    id: 'package_seed_active_002',
    classDurationMinutes: 90,
    wechatShareCover: 'https://example.com/enriched-cover.png'
  })
  authUtils.loginAndStoreSession = async () => ({ token: 'seed-token' })

  const page = createPageHarness(loadPageDefinition('pages/group/detail/index.js'))
  await page.onLoad({
    packageGroupId: 'pkg-group-active-2',
    packageId: 'package_seed_active_002',
    entry: 'paymentSuccess',
    action: 'join'
  })

  assert.equal(page.data.groupDetail.scheduleList[0].display_text, '2026-06-19 周五09:00 - 10:30')
  assert.equal(page.data.groupDetail.scheduleList[1].display_text, '2026-06-24 周三13:30 - 15:00')
  assert.equal(page.data.groupDetail.packageInfo.classDurationMinutes, 90)
  assert.equal(page.data.groupDetail.packageInfo.wechatShareCover, 'https://example.com/enriched-cover.png')

  packageUtils.fetchPackageGroupDetail = originalFetchPackageGroupDetail
  packageUtils.fetchPackageDetail = originalFetchPackageDetail
  authUtils.loginAndStoreSession = originalLoginAndStoreSession
})
