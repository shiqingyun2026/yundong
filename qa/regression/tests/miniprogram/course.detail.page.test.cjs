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
