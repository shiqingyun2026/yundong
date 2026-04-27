const {
  getMiniProgramEnvVersion,
  resolveApiTransportByEnv,
  resolveBaseURLByEnv,
  resolveCloudEnvByEnv,
  resolveCloudContainerServiceNameByEnv,
  resolveCloudLocationFunctionNameByEnv,
  resolveSubscribeTemplateIdsByEnv
} = require('./config/env')
const { resolveRuntimeInfo } = require('./utils/util')
const { ensureSilentLogin } = require('./utils/auth')

App({
  async onLaunch() {
    this.initRuntimeEnv()
    this._cloudInitPromise = this.initCloud()
    await this._cloudInitPromise
    this.initSystemInfo()
    this.installUiFeedback()
    this.syncAgreementState()
    this.syncLocationState()
    wx.removeStorageSync('phoneNumber')
    this.bootstrapSilentLogin()
  },

  onShow() {},

  async bootstrapSilentLogin() {
    try {
      await ensureSilentLogin()
    } catch (error) {
      console.warn('[app] silent login failed', error)
    }
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

  async initCloud() {
    const requiresCloudRuntime = this.globalData.apiTransport === 'container'

    if (!requiresCloudRuntime) {
      this.globalData.cloudReady = false
      return false
    }

    if (!wx.cloud || typeof wx.cloud.init !== 'function') {
      console.warn('[app] wx.cloud is not available, fallback is required before enabling cloud transport')
      this.globalData.cloudReady = false
      return false
    }

    try {
      const initOptions = {}
      if (this.globalData.cloudEnv) {
        initOptions.env = this.globalData.cloudEnv
      }

      await wx.cloud.init(initOptions)
      this.globalData.cloudReady = true
      return true
    } catch (error) {
      console.warn('[app] wx.cloud.init failed', error)
      this.globalData.cloudReady = false
      return false
    }
  },

  async ensureCloudReady() {
    if (this.globalData.cloudReady) {
      return true
    }

    if (this._cloudInitPromise) {
      return this._cloudInitPromise
    }

    this._cloudInitPromise = this.initCloud()
    return this._cloudInitPromise
  },

  initSystemInfo() {
    try {
      const systemInfo = resolveRuntimeInfo()
      this.globalData.systemInfo = systemInfo
      this.globalData.navbarHeight = systemInfo.navBarHeight
    } catch (error) {
      console.warn('resolveRuntimeInfo failed', error)
    }
  },

  installUiFeedback() {
    if (this._uiFeedbackInstalled || !wx || typeof wx.showToast !== 'function') {
      return
    }

    const originalShowToast = wx.showToast

    wx.showToast = options => {
      const payload = options || {}
      const icon = payload.icon || 'none'
      const canUseFeedback = !payload.image && !payload.mask && ['none', 'success', 'loading'].includes(icon)
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const currentPage = pages[pages.length - 1]
      const feedback =
        currentPage && typeof currentPage.selectComponent === 'function'
          ? currentPage.selectComponent('#ui-toptips')
          : null

      if (!canUseFeedback || !feedback || typeof feedback.setData !== 'function') {
        return originalShowToast(payload)
      }

      const title = `${payload.title || payload.msg || ''}`.trim()
      if (!title) {
        return originalShowToast(payload)
      }

      const duration = typeof payload.duration === 'number' ? payload.duration : 2000
      const type = icon === 'success' ? 'success' : icon === 'loading' ? 'info' : 'error'

      if (feedback._toastShowTimer) {
        clearTimeout(feedback._toastShowTimer)
        feedback._toastShowTimer = null
      }

      feedback.setData(
        {
          show: false,
          msg: title,
          type,
          delay: duration
        },
        () => {
          feedback._toastShowTimer = setTimeout(() => {
            feedback._toastShowTimer = null
            feedback.setData({
              show: true
            })
            if (typeof payload.success === 'function') {
              payload.success({ errMsg: 'showToast:ok' })
            }
            if (typeof payload.complete === 'function') {
              payload.complete({ errMsg: 'showToast:ok' })
            }
          }, 16)
        }
      )
      return { errMsg: 'showToast:ok' }
    }

    this._uiFeedbackInstalled = true
    this.globalData.originalShowToast = originalShowToast
  },

  syncAgreementState() {
    this.globalData.agreementAccepted = true
  },

  syncLocationState() {
    this.globalData.gpsLocation = wx.getStorageSync('gpsLocation') || null
    this.globalData.selectedLocation = wx.getStorageSync('selectedLocation') || null
    this.globalData.location = this.globalData.selectedLocation || null
  },

  hasAgreedAgreement() {
    return true
  },

  setAgreementAccepted(accepted) {
    const agreementAccepted = !!accepted
    this.globalData.agreementAccepted = agreementAccepted
    wx.setStorageSync('agreementAccepted', agreementAccepted)
    wx.setStorageSync('agreementAcceptedAt', agreementAccepted ? Date.now() : '')
  },

  ensureAgreementAccepted() {},

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
    navbarHeight: 64,
    originalShowToast: null
  }
})
