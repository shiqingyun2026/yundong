const test = require('node:test')
const assert = require('node:assert/strict')

const { createPageHarness, createWxMock, loadPageDefinition } = require('./helpers.cjs')

const bannerUtils = require('../../../../miniprogram/utils/banner')
const packageUtils = require('../../../../miniprogram/utils/package')
const locationUtils = require('../../../../miniprogram/utils/location')

test('miniprogram home page: share to friend uses default home share title and home path', async () => {
  const originalFetchHomeBannerList = bannerUtils.fetchHomeBannerList
  const originalFetchPackageList = packageUtils.fetchPackageList

  const { wx } = createWxMock()
  global.wx = {
    ...wx,
    getLocation({ fail }) {
      fail({
        errMsg: 'getLocation:fail auth deny'
      })
    },
    getSetting() {},
    openSetting() {}
  }
  global.getApp = () => ({
    globalData: {
      systemInfo: {}
    },
    setGpsLocation() {},
    setSelectedLocation() {},
    getCurrentLocation() {
      return locationUtils.DEFAULT_LOCATION
    }
  })

  bannerUtils.fetchHomeBannerList = async () => []
  packageUtils.fetchPackageList = async () => ({
    list: [],
    hasMore: false
  })

  const page = createPageHarness(loadPageDefinition('pages/home/index.js'))
  page.onLoad()
  await new Promise(resolve => setTimeout(resolve, 0))

  assert.deepEqual(page.onShareAppMessage(), {
    title: '家门口的少儿运动团课',
    path: '/pages/home/index'
  })

  bannerUtils.fetchHomeBannerList = originalFetchHomeBannerList
  packageUtils.fetchPackageList = originalFetchPackageList
})

test('miniprogram home page: share to timeline uses default home share title', async () => {
  const originalFetchHomeBannerList = bannerUtils.fetchHomeBannerList
  const originalFetchPackageList = packageUtils.fetchPackageList

  const { wx } = createWxMock()
  global.wx = {
    ...wx,
    getLocation({ fail }) {
      fail({
        errMsg: 'getLocation:fail auth deny'
      })
    },
    getSetting() {},
    openSetting() {}
  }
  global.getApp = () => ({
    globalData: {
      systemInfo: {}
    },
    setGpsLocation() {},
    setSelectedLocation() {},
    getCurrentLocation() {
      return locationUtils.DEFAULT_LOCATION
    }
  })

  bannerUtils.fetchHomeBannerList = async () => []
  packageUtils.fetchPackageList = async () => ({
    list: [],
    hasMore: false
  })

  const page = createPageHarness(loadPageDefinition('pages/home/index.js'))
  page.onLoad()
  await new Promise(resolve => setTimeout(resolve, 0))

  assert.deepEqual(page.onShareTimeline(), {
    title: '家门口的少儿运动团课'
  })

  bannerUtils.fetchHomeBannerList = originalFetchHomeBannerList
  packageUtils.fetchPackageList = originalFetchPackageList
})
