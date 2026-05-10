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
    status: 'success'
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
