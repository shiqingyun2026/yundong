const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const loadAppDefinition = () => {
  const captured = { definition: null }
  const previousApp = global.App
  global.App = definition => {
    captured.definition = definition
  }

  const resolved = path.resolve('/Users/yun/lindong/miniprogram/app.js')
  delete require.cache[resolved]
  require(resolved)
  global.App = previousApp

  if (!captured.definition) {
    throw new Error('App definition not captured for miniprogram/app.js')
  }

  return captured.definition
}

const createWxMock = () => {
  const storage = new Map()
  const calls = {
    reLaunch: []
  }

  const wx = {
    cloud: {
      init: async () => {}
    },
    getStorageSync(key) {
      return storage.get(key)
    },
    setStorageSync(key, value) {
      storage.set(key, value)
    },
    removeStorageSync(key) {
      storage.delete(key)
    },
    getAccountInfoSync() {
      return {
        miniProgram: {
          envVersion: 'develop'
        }
      }
    },
    reLaunch(payload) {
      calls.reLaunch.push(payload)
    }
  }

  return { wx, calls, storage }
}

test('miniprogram app: reopening from recent usage list resets non-home page to home', () => {
  const { wx, calls } = createWxMock()
  global.wx = wx
  global.getCurrentPages = () => [
    {
      route: 'pages/group/detail/index'
    }
  ]

  const appDefinition = loadAppDefinition()
  appDefinition.onShow({
    scene: 1001
  })

  assert.deepEqual(calls.reLaunch[0], {
    url: '/pages/home/index'
  })
})

test('miniprogram app: explicit share entry keeps target page on reopen', () => {
  const { wx, calls } = createWxMock()
  global.wx = wx
  global.getCurrentPages = () => [
    {
      route: 'pages/group/detail/index'
    }
  ]

  const appDefinition = loadAppDefinition()
  appDefinition.onShow({
    scene: 1007,
    path: 'pages/group/detail/index',
    query: {
      packageGroupId: 'pkg-group-1'
    }
  })

  assert.equal(calls.reLaunch.length, 0)
})
