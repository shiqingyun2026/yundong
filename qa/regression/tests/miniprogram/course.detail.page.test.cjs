const test = require('node:test')
const assert = require('node:assert/strict')

const { createPageHarness, createWxMock, loadPageDefinition } = require('./helpers.cjs')

const packageUtils = require('../../../../miniprogram/utils/package')

test('miniprogram course detail page: unauthenticated start group opens login sheet and hides tab bar', async () => {
  const originalFetchPackageDetail = packageUtils.fetchPackageDetail
  const { wx, calls } = createWxMock()
  global.wx = wx
  global.getApp = () => ({})

  packageUtils.fetchPackageDetail = async () => ({
    id: 'package_seed_active_002',
    name: '[测试] 深圳宝安体能进阶·等待上课',
    images: ['https://example.com/a.png'],
    coachCertificates: [],
    cover: 'https://example.com/a.png'
  })

  const page = createPageHarness(loadPageDefinition('pages/course/detail/index.js'))
  await page.onLoad({ id: 'package_seed_active_002' })

  page.handleStartGroup()

  assert.equal(page.data.showLoginSheet, true)
  assert.equal(page.data.pendingLoginAction.type, 'start-group')
  assert.equal(calls.hideTabBar.length, 1)

  packageUtils.fetchPackageDetail = originalFetchPackageDetail
})

test('miniprogram course detail page: authenticated join group navigates to payment confirm', async () => {
  const originalFetchPackageDetail = packageUtils.fetchPackageDetail
  const { wx, calls, storage } = createWxMock()
  global.wx = wx
  global.getApp = () => ({})

  storage.set('token', 'seed-token')
  storage.set('userInfo', {
    phone: '13800138000'
  })
  packageUtils.fetchPackageDetail = async () => ({
    id: 'package_seed_active_002',
    name: '[测试] 深圳宝安体能进阶·等待上课',
    images: ['https://example.com/a.png'],
    coachCertificates: [],
    cover: 'https://example.com/a.png'
  })

  const page = createPageHarness(loadPageDefinition('pages/course/detail/index.js'))
  await page.onLoad({ id: 'package_seed_active_002' })

  page.handleJoinGroup({
    currentTarget: {
      dataset: {
        groupId: 'pkg-group-joined-1'
      }
    }
  })

  assert.deepEqual(calls.navigateTo[0], {
    url: '/pages/payment/confirm/index?action=join&packageId=package_seed_active_002&packageGroupId=pkg-group-joined-1'
  })

  packageUtils.fetchPackageDetail = originalFetchPackageDetail
})

test('miniprogram course detail page: share timeline uses course name cover and current detail query', async () => {
  const originalFetchPackageDetail = packageUtils.fetchPackageDetail
  const { wx } = createWxMock()
  global.wx = wx
  global.getApp = () => ({})

  packageUtils.fetchPackageDetail = async () => ({
    id: 'package_seed_active_003',
    name: '[测试] 深圳南山体适能课',
    images: ['https://example.com/a.png'],
    coachCertificates: [],
    cover: 'https://example.com/course-cover.png'
  })

  const page = createPageHarness(loadPageDefinition('pages/course/detail/index.js'))
  await page.onLoad({ id: 'package_seed_active_003' })

  assert.deepEqual(page.onShareTimeline(), {
    title: '[测试] 深圳南山体适能课｜家门口组团上课',
    query: 'id=package_seed_active_003',
    imageUrl: 'https://example.com/course-cover.png'
  })

  packageUtils.fetchPackageDetail = originalFetchPackageDetail
})

test('miniprogram course detail page: unavailable course shows toast and switches to home tab', async () => {
  const originalFetchPackageDetail = packageUtils.fetchPackageDetail
  const { wx, calls } = createWxMock()
  global.wx = wx
  global.getApp = () => ({})

  packageUtils.fetchPackageDetail = async () => {
    throw {
      message: '课包不存在',
      statusCode: 404
    }
  }

  const page = createPageHarness(loadPageDefinition('pages/course/detail/index.js'))
  await page.onLoad({ id: 'package_offline_001' })

  assert.deepEqual(calls.showToast[0], {
    title: '课包不存在',
    icon: 'none'
  })
  assert.deepEqual(calls.switchTab[0], {
    url: '/pages/home/index'
  })

  packageUtils.fetchPackageDetail = originalFetchPackageDetail
})

test('miniprogram course detail page: fallback customer service entry opens qr modal', async () => {
  const originalFetchPackageDetail = packageUtils.fetchPackageDetail
  const { wx } = createWxMock()
  global.wx = wx
  global.getApp = () => ({})

  packageUtils.fetchPackageDetail = async () => ({
    id: 'package_seed_active_004',
    name: '[测试] 深圳福田体适能课',
    images: ['https://example.com/a.png'],
    coachCertificates: [],
    cover: 'https://example.com/a.png'
  })

  const page = createPageHarness(loadPageDefinition('pages/course/detail/index.js'))
  await page.onLoad({ id: 'package_seed_active_004' })

  page.handleOpenServiceFallback()

  assert.equal(page.data.showServiceModal, true)

  packageUtils.fetchPackageDetail = originalFetchPackageDetail
})
