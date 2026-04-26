const path = require('path')

const createWxMock = () => {
  const storage = new Map()
  const calls = {
    showToast: [],
    navigateTo: [],
    redirectTo: [],
    previewImage: [],
    showTabBar: [],
    hideTabBar: [],
    showLoading: [],
    hideLoading: 0,
    setNavigationBarTitle: [],
    stopPullDownRefresh: 0
  }

  const wx = {
    requestPayment: null,
    requestSubscribeMessage: null,
    getStorageSync(key) {
      return storage.get(key)
    },
    setStorageSync(key, value) {
      storage.set(key, value)
    },
    removeStorageSync(key) {
      storage.delete(key)
    },
    showToast(payload) {
      calls.showToast.push(payload)
    },
    navigateTo(payload) {
      calls.navigateTo.push(payload)
    },
    redirectTo(payload) {
      calls.redirectTo.push(payload)
    },
    previewImage(payload) {
      calls.previewImage.push(payload)
    },
    showTabBar(payload) {
      calls.showTabBar.push(payload)
    },
    hideTabBar(payload) {
      calls.hideTabBar.push(payload)
    },
    showLoading(payload) {
      calls.showLoading.push(payload)
    },
    hideLoading() {
      calls.hideLoading += 1
    },
    setNavigationBarTitle(payload) {
      calls.setNavigationBarTitle.push(payload)
    },
    stopPullDownRefresh() {
      calls.stopPullDownRefresh += 1
    },
    getAccountInfoSync() {
      return {
        miniProgram: {
          envVersion: 'develop'
        }
      }
    },
    login({ success }) {
      success({
        code: 'mock-login-code'
      })
    }
  }

  return { wx, calls, storage }
}

const createPageHarness = pageDefinition => {
  const instance = {
    data: JSON.parse(JSON.stringify(pageDefinition.data || {})),
    setData(payload) {
      Object.assign(this.data, payload)
    }
  }

  Object.entries(pageDefinition).forEach(([key, value]) => {
    if (key === 'data') {
      return
    }

    if (typeof value === 'function') {
      instance[key] = value.bind(instance)
      return
    }

    instance[key] = value
  })

  return instance
}

const loadPageDefinition = relativeModulePath => {
  const captured = { definition: null }
  const previousPage = global.Page
  global.Page = definition => {
    captured.definition = definition
  }

  const resolved = path.resolve('/Users/yun/lindong/miniprogram', relativeModulePath)
  delete require.cache[resolved]
  require(resolved)
  global.Page = previousPage

  if (!captured.definition) {
    throw new Error(`Page definition not captured for ${relativeModulePath}`)
  }

  return captured.definition
}

module.exports = {
  createWxMock,
  createPageHarness,
  loadPageDefinition
}
