const test = require('node:test')
const assert = require('node:assert/strict')

const { createPageHarness, createWxMock, loadPageDefinition } = require('./helpers.cjs')

test('miniprogram mine page: agreements menu opens agreement list', () => {
  const { wx, calls } = createWxMock()
  global.wx = wx
  global.getApp = () => ({
    globalData: {}
  })

  const page = createPageHarness(loadPageDefinition('pages/mine/index.js'))

  page.handleMenuTap({
    currentTarget: {
      dataset: {
        key: 'agreements'
      }
    }
  })

  assert.deepEqual(calls.navigateTo[0], {
    url: '/pages/agreement-list/index'
  })
})

test('miniprogram mine page: fallback customer service entry opens qr modal', () => {
  const { wx } = createWxMock()
  global.wx = wx
  global.getApp = () => ({
    globalData: {}
  })

  const page = createPageHarness(loadPageDefinition('pages/mine/index.js'))
  page.handleServiceFallbackTap()

  assert.equal(page.data.showServiceModal, true)
})
