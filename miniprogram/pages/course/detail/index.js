const { fetchCourseDetail, fetchActiveGroup, createOrder } = require('../../../utils/course')
const { loginWithUserProfile, authDebugConfig } = require('../../../utils/auth')
const {
  buildActiveGroupViewModel,
  buildGroupPresentationState,
  buildSharePayload,
  normalizeCourseDetail
} = require('./detailHelpers')

Page({
  data: {
    courseId: '',
    sharedGroupId: '',
    courseDetail: null,
    activeGroup: null,
    hasActiveGroup: false,
    groupTargetCount: 0,
    groupCurrentCount: 0,
    displayJoinedCount: 0,
    showJoinedCount: false,
    courseGroupList: [],
    loading: true,
    showServiceModal: false,
    showLoginModal: false,
    loginLoading: false,
    loginAgreementChecked: true,
    creatingOrder: false,
    actionButtonMode: 'create',
    actionButtonText: '立即开团',
    actionButtonDisabled: false,
    emptyGroupText: '暂无进行中的拼团，立即开团吧'
  },

  async onLoad(options) {
    this._expireTimer = null
    this._expireStartTimer = null
    this._hasLoadedOnce = false
    const courseId = options.id || ''
    this.setData({
      courseId,
      sharedGroupId: options.groupId || ''
    })

    await this.loadPageData(courseId)
  },

  async onShow() {
    if (!this._hasLoadedOnce || !this.data.courseId) {
      return
    }

    await this.loadPageData(this.data.courseId)
  },

  onUnload() {
    this.clearExpireTimer()
  },

  promptLogin() {
    this.setData({
      showLoginModal: true,
      loginAgreementChecked: true
    })
  },

  handleCloseLoginModal() {
    if (this.data.loginLoading) {
      return
    }

    this.setData({
      showLoginModal: false
    })
  },

  handleOpenAgreement() {
    wx.navigateTo({
      url: '/pages/agreement-content/index?key=user'
    })
  },

  handleOpenPrivacy() {
    wx.navigateTo({
      url: '/pages/agreement-content/index?key=privacy'
    })
  },

  handleToggleLoginAgreement() {
    this.setData({
      loginAgreementChecked: !this.data.loginAgreementChecked
    })
  },

  async handleConfirmLogin() {
    if (this.data.loginLoading) {
      return
    }

    if (!this.data.loginAgreementChecked) {
      wx.showToast({
        title: '请先阅读并同意相关协议',
        icon: 'none'
      })
      return
    }

    this.setData({
      loginLoading: true
    })

    try {
      const result = await loginWithUserProfile()
      const app = getApp()

      app.setUserInfo(result.userInfo)
      app.setToken(result.token)

      this.setData({
        showLoginModal: false
      })

      wx.showToast({
        title:
          authDebugConfig.USE_MOCK_USER && !result.mock
            ? `登录成功(${authDebugConfig.MOCK_OPEN_ID || 'mock'})`
            : result.mock
              ? '已登录，当前为 mock 模式'
              : '登录成功',
        icon: 'success'
      })

      if (this.data.courseId) {
        await this.loadPageData(this.data.courseId)
      }
    } catch (error) {
      const message =
        error && /cancel|deny|auth deny/i.test(error.errMsg || '')
          ? '你已取消微信授权，可稍后再登录'
          : '登录未完成，请稍后再试'

      wx.showToast({
        title: message,
        icon: 'none'
      })
    } finally {
      this.setData({
        loginLoading: false
      })
    }
  },

  clearExpireTimer() {
    if (this._expireStartTimer) {
      clearTimeout(this._expireStartTimer)
      this._expireStartTimer = null
    }

    if (this._expireTimer) {
      clearInterval(this._expireTimer)
      this._expireTimer = null
    }
  },

  updateGroupPresentation(courseDetail, activeGroup) {
    this.setData(buildGroupPresentationState({ courseDetail, activeGroup }))
  },

  scheduleExpireTimer() {
    this.clearExpireTimer()

    if (this.data.loading || !this.data.activeGroup || !this.data.activeGroup.expireTime) {
      return
    }

    this._expireStartTimer = setTimeout(() => {
      this._expireStartTimer = null
      this.startExpireTimer()
    }, 300)
  },

  startExpireTimer() {
    if (!this.data.activeGroup || !this.data.activeGroup.expireTime) {
      return
    }

    this._expireTimer = setInterval(() => {
      const { activeGroup } = this.data
      if (!activeGroup) {
        this.clearExpireTimer()
        return
      }

      const nextActiveGroup = buildActiveGroupViewModel(activeGroup)
      this.updateGroupPresentation(this.data.courseDetail, nextActiveGroup)

      if (nextActiveGroup.expireTimeText === '已结束') {
        this.clearExpireTimer()
      }
    }, 1000)
  },

  async loadPageData(courseId) {
    if (!courseId) {
      wx.showToast({
        title: '课程信息不存在',
        icon: 'none'
      })
      return
    }

    this.setData({
      loading: true
    })

    try {
      const [courseDetail, activeGroup] = await Promise.all([
        fetchCourseDetail(courseId),
        fetchActiveGroup(courseId)
      ])

      const normalizedCourseDetail = normalizeCourseDetail(courseDetail)

      this.setData({
        courseDetail: normalizedCourseDetail
      })

      this.updateGroupPresentation(normalizedCourseDetail, buildActiveGroupViewModel(activeGroup))
    } catch (error) {
      wx.showToast({
        title: '课程详情加载失败',
        icon: 'none'
      })
    } finally {
      this._hasLoadedOnce = true

      if (!this.data.activeGroup) {
        this.clearExpireTimer()
      }

      this.setData({
        loading: false
      })

      this.scheduleExpireTimer()
    }
  },

  handlePreviewCertificate(event) {
    const { url } = event.currentTarget.dataset
    const { courseDetail } = this.data

    if (!url || !courseDetail || !courseDetail.coach) {
      return
    }

    wx.previewImage({
      current: url,
      urls: courseDetail.coach.certificates
    })
  },

  handleOpenService() {
    this.setData({
      showServiceModal: true
    })
  },

  handleCloseService() {
    this.setData({
      showServiceModal: false
    })
  },

  noop() {},

  handleConfirmService() {
    this.setData({
      showServiceModal: false
    })
  },

  onShareAppMessage() {
    return buildSharePayload(this.data)
  },

  async handleGoPayment() {
    const { courseId, courseDetail, activeGroup, creatingOrder, sharedGroupId, actionButtonMode } = this.data

    if (creatingOrder) {
      return
    }

    if (!courseId) {
      wx.showToast({
        title: '课程信息不存在',
        icon: 'none'
      })
      return
    }

    const token = wx.getStorageSync('token')
    console.log('token:', token)

    if (!token) {
      this.promptLogin()
      return
    }

    if (actionButtonMode === 'completed') {
      wx.showToast({
        title: '当前拼团已成团',
        icon: 'none'
      })
      return
    }

    if (actionButtonMode === 'joined') {
      wx.showToast({
        title: '你已参团，请等待成团',
        icon: 'none'
      })
      return
    }

    if (actionButtonMode === 'full') {
      wx.showToast({
        title: '课程已满员，暂不可开团',
        icon: 'none'
      })
      return
    }

    const joinableGroup = activeGroup && !activeGroup.isExpired ? activeGroup : null
    const groupId =
      joinableGroup && sharedGroupId && sharedGroupId === joinableGroup.groupId
        ? sharedGroupId
        : joinableGroup
          ? joinableGroup.groupId
          : ''

    this.setData({
      creatingOrder: true
    })

    try {
      const order = await createOrder({
        courseId,
        groupId,
        totalFee: courseDetail ? parseInt(courseDetail.groupPriceFen, 10) : 0
      })

      const nextGroupId = order && order.groupId ? order.groupId : groupId
      const orderId = order && order.orderId ? order.orderId : ''

      getApp().globalData.pendingOrder = order || null

      wx.navigateTo({
        url: `/pages/payment/confirm/index?courseId=${courseId}&groupId=${nextGroupId}&orderId=${orderId}`
      })
    } catch (error) {
      if (error && error.statusCode === 401) {
        wx.removeStorageSync('token')
        const app = getApp()
        if (app && typeof app.setToken === 'function') {
          app.setToken('')
        }

        this.promptLogin()
        return
      }

      wx.showToast({
        title: (error && error.message) || '下单失败，请稍后再试',
        icon: 'none'
      })
    } finally {
      this.setData({
        creatingOrder: false
      })
    }
  }
})
