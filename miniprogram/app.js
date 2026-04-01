const {
  getMiniProgramEnvVersion,
  resolveApiTransportByEnv,
  resolveBaseURLByEnv,
  resolveCloudEnvByEnv,
  resolveCloudContainerServiceNameByEnv,
  resolveCloudLocationFunctionNameByEnv,
  resolveSubscribeTemplateIdsByEnv
} = require('./config/env')

App({
  onLaunch() {
    this.initRuntimeEnv()
    this.initCloud()
    this.initSystemInfo()
    this.syncAgreementState()
    this.syncLocationState()
    wx.removeStorageSync('phoneNumber')
  },

  onShow() {
    this.ensureAgreementAccepted()
  },

  initRuntimeEnv() {
    const envVersion = getMiniProgramEnvVersion()
    this.globalData.envVersion = envVersion
    this.globalData.apiTransport = resolveApiTransportByEnv(envVersion)
    this.globalData.baseURL = resolveBaseURLByEnv(envVersion)
    this.globalData.cloudEnv = resolveCloudEnvByEnv(envVersion)
    this.globalData.cloudContainerServiceName = resolveCloudContainerServiceNameByEnv(envVersion)
    this.globalData.cloudLocationFunctionName = resolveCloudLocationFunctionNameByEnv(envVersion)
    this.globalData.subscribeTemplateIds = resolveSubscribeTemplateIdsByEnv(envVersion)
  },

  initCloud() {
    const requiresCloudRuntime = this.globalData.apiTransport === 'container'

    if (!requiresCloudRuntime) {
      this.globalData.cloudReady = false
      return
    }

    if (!wx.cloud || typeof wx.cloud.init !== 'function') {
      console.warn('[app] wx.cloud is not available, fallback is required before enabling cloud transport')
      this.globalData.cloudReady = false
      return
    }

    try {
      const initOptions = {}
      if (this.globalData.cloudEnv) {
        initOptions.env = this.globalData.cloudEnv
      }

      wx.cloud.init(initOptions)
      this.globalData.cloudReady = true
    } catch (error) {
      console.warn('[app] wx.cloud.init failed', error)
      this.globalData.cloudReady = false
    }
  },

  initSystemInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      this.globalData.systemInfo = systemInfo
      this.globalData.navbarHeight = systemInfo.statusBarHeight + 44
    } catch (error) {
      console.warn('getSystemInfoSync failed', error)
    }
  },

  syncAgreementState() {
    const hasAgreed = !!wx.getStorageSync('agreementAccepted')
    this.globalData.agreementAccepted = hasAgreed
  },

  syncLocationState() {
    this.globalData.gpsLocation = wx.getStorageSync('gpsLocation') || null
    this.globalData.selectedLocation = wx.getStorageSync('selectedLocation') || null
    this.globalData.location = this.globalData.selectedLocation || null
  },

  hasAgreedAgreement() {
    return !!this.globalData.agreementAccepted
  },

  setAgreementAccepted(accepted) {
    const agreementAccepted = !!accepted
    this.globalData.agreementAccepted = agreementAccepted
    wx.setStorageSync('agreementAccepted', agreementAccepted)
    wx.setStorageSync('agreementAcceptedAt', agreementAccepted ? Date.now() : '')
  },

  ensureAgreementAccepted() {
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const currentRoute = currentPage ? `/${currentPage.route}` : ''
    const agreementRoute = '/pages/agreement/index'

    if (this.hasAgreedAgreement()) {
      if (currentRoute === agreementRoute) {
        wx.switchTab({
          url: '/pages/home/index'
        })
      }
      return
    }

    if (currentRoute === agreementRoute) {
      return
    }

    wx.reLaunch({
      url: agreementRoute
    })
  },

  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo || null

    if (userInfo) {
      wx.setStorageSync('userInfo', userInfo)
      return
    }

    wx.removeStorageSync('userInfo')
  },

  setToken(token) {
    this.globalData.token = token || ''
    if (token) {
      wx.setStorageSync('token', token)
      return
    }

    wx.removeStorageSync('token')
  },

  setGpsLocation(location) {
    this.globalData.gpsLocation = location || null

    if (location) {
      wx.setStorageSync('gpsLocation', location)
      return
    }

    wx.removeStorageSync('gpsLocation')
  },

  setSelectedLocation(location) {
    this.globalData.selectedLocation = location || null
    this.globalData.location = location || null

    if (location) {
      wx.setStorageSync('selectedLocation', location)
      wx.setStorageSync('location', location)
      return
    }

    wx.removeStorageSync('selectedLocation')
    wx.removeStorageSync('location')
  },

  setLocation(location) {
    this.setSelectedLocation(location)
  },

  getCurrentLocation() {
    return this.globalData.selectedLocation || this.globalData.gpsLocation || null
  },

  globalData: {
    envVersion: 'develop',
    apiTransport: resolveApiTransportByEnv('develop'),
    baseURL: resolveBaseURLByEnv('develop'),
    cloudEnv: resolveCloudEnvByEnv('develop'),
    cloudContainerServiceName: resolveCloudContainerServiceNameByEnv('develop'),
    cloudLocationFunctionName: resolveCloudLocationFunctionNameByEnv('develop'),
    subscribeTemplateIds: resolveSubscribeTemplateIdsByEnv('develop'),
    cloudReady: false,
    token: wx.getStorageSync('token') || '',
    userInfo: wx.getStorageSync('userInfo') || null,
    pendingOrder: null,
    location: wx.getStorageSync('selectedLocation') || wx.getStorageSync('location') || null,
    gpsLocation: wx.getStorageSync('gpsLocation') || null,
    selectedLocation: wx.getStorageSync('selectedLocation') || wx.getStorageSync('location') || null,
    agreementAccepted: !!wx.getStorageSync('agreementAccepted'),
    systemInfo: null,
    navbarHeight: 64
  }
})
