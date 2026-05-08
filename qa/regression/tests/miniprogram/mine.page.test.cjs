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

test('miniprogram mine page: customer service contact event keeps page state stable', () => {
  const { wx } = createWxMock()
  global.wx = wx
  global.getApp = () => ({
    globalData: {}
  })

  const page = createPageHarness(loadPageDefinition('pages/mine/index.js'))
  page.handleContact({
    detail: {
      path: '/pages/mine/index',
      query: {}
    }
  })

  assert.equal(page.data.showLoginSheet, false)
  assert.equal(page.data.pendingLoginAction, '')
})
