const { fetchCourseDetail, fetchActiveGroup, createOrder, mockPaymentSuccess } = require('../../../utils/course')

Page({
  data: {
    courseId: '',
    groupId: '',
    orderId: '',
    courseDetail: null,
    groupDetail: null,
    paymentParams: null,
    agreementChecked: true,
    loading: true,
    paying: false
  },

  async onLoad(options) {
    this._isAlive = true
    this._timers = []

    const courseId = options.courseId || ''
    const groupId = options.groupId || ''
    const orderId = options.orderId || ''
    const pendingOrder = getApp().globalData.pendingOrder || null

    this.safeSetData({
      courseId,
      groupId,
      orderId,
      paymentParams:
        pendingOrder &&
        (!orderId || pendingOrder.orderId === orderId) &&
        pendingOrder.courseId === courseId
          ? pendingOrder.paymentParams || {}
          : null
    })

    await this.loadPageData(courseId, groupId)
  },

  onUnload() {
    this._isAlive = false
    this.clearTimers()
  },

  safeSetData(payload) {
    if (!this._isAlive) {
      return
    }

    this.setData(payload)
  },

  clearTimers() {
    ;(this._timers || []).forEach(timerId => clearTimeout(timerId))
    this._timers = []
  },

  async loadPageData(courseId, groupId) {
    if (!courseId) {
      if (!this._isAlive) {
        return
      }

      wx.showToast({
        title: '课程信息不存在',
        icon: 'none'
      })
      return
    }

    this.safeSetData({
      loading: true
    })

    try {
      const tasks = [fetchCourseDetail(courseId)]
      if (groupId) {
        tasks.push(fetchActiveGroup(courseId))
      }

      const [courseDetail, activeGroup] = await Promise.all(tasks)
      const groupDetail =
        groupId && activeGroup && activeGroup.groupId === groupId
          ? activeGroup
          : null

      if (!this._isAlive) {
        return
      }

      this.safeSetData({
        courseDetail,
        groupDetail: groupDetail || null
      })
    } catch (error) {
      if (!this._isAlive) {
        return
      }

      wx.showToast({
        title: '支付信息加载失败',
        icon: 'none'
      })
    } finally {
      this.safeSetData({
        loading: false
      })
    }
  },

  handleAgreementChange(event) {
    const values = event.detail.value || []
    this.safeSetData({
      agreementChecked: values.includes('agree')
    })
  },

  handleOpenAgreement() {
    wx.navigateTo({
      url: '/pages/service-agreement/index'
    })
  },

  async handleConfirmPay() {
    if (!this.data.agreementChecked) {
      wx.showToast({
        title: '请先同意课程服务协议',
        icon: 'none'
      })
      return
    }

    if (this.data.paying) {
      return
    }

    this.safeSetData({
      paying: true
    })

    let order = null

    if (this.data.orderId) {
      order = {
        orderId: this.data.orderId,
        groupId: this.data.groupId,
        paymentParams: this.data.paymentParams || {}
      }
    } else {
      try {
        order = await createOrder({
          courseId: this.data.courseId,
          groupId: this.data.groupId,
          totalFee: this.data.courseDetail ? parseInt(this.data.courseDetail.groupPriceFen, 10) : 0
        })
      } catch (error) {
        wx.showToast({
          title: (error && error.message) || '下单失败，请稍后再试',
          icon: 'none'
        })

        this.safeSetData({
          paying: false
        })
        return
      }
    }

    if (!this._isAlive) {
      return
    }

    try {
      const paymentResult = await mockPaymentSuccess({
        orderId: order.orderId,
        groupId: order.groupId || this.data.groupId
      })

      if (!this._isAlive) {
        return
      }

      getApp().globalData.pendingOrder = null
      this.navigateToPaymentResult('success', paymentResult.groupId || order.groupId || this.data.groupId)
    } catch (error) {
      if (!this._isAlive) {
        return
      }

      wx.showToast({
        title: '支付确认失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.safeSetData({
        paying: false
      })
    }
  },

  handleMockFail() {
    if (!this.data.agreementChecked) {
      wx.showToast({
        title: '请先同意课程服务协议',
        icon: 'none'
      })
      return
    }

    const groupId = this.data.groupId || `mock-group-${this.data.courseId}`
    this.navigateToPaymentResult('fail', groupId)
  },

  navigateToPaymentResult(status, groupId) {
    if (!this._isAlive) {
      return
    }

    wx.redirectTo({
      url: `/pages/payment/result/index?status=${status}&courseId=${this.data.courseId}&groupId=${groupId}`
    })
  }
})
