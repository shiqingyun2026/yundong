const { getMiniProgramEnvVersion, resolveBaseURLByEnv } = require('./config/env')

App({
  onLaunch() {
    this.initRuntimeEnv()
    this.initSystemInfo()
    this.syncAgreementState()
    wx.removeStorageSync('phoneNumber')
  },

  onShow() {
    this.ensureAgreementAccepted()
  },

  initRuntimeEnv() {
    const envVersion = getMiniProgramEnvVersion()
    this.globalData.envVersion = envVersion
    this.globalData.baseURL = resolveBaseURLByEnv(envVersion)
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

  setLocation(location) {
    this.globalData.location = location || null

    if (location) {
      wx.setStorageSync('location', location)
      return
    }

    wx.removeStorageSync('location')
  },

  globalData: {
    envVersion: 'develop',
    baseURL: resolveBaseURLByEnv('develop'),
    token: wx.getStorageSync('token') || '',
    userInfo: wx.getStorageSync('userInfo') || null,
    pendingOrder: null,
    location: wx.getStorageSync('location') || null,
    agreementAccepted: !!wx.getStorageSync('agreementAccepted'),
    systemInfo: null,
    navbarHeight: 64
  }
})
