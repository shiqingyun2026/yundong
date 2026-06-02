const {
  requestGroupResultSubscription,
  reportGroupResultSubscription,
  resolveGroupResultTemplateIds
} = require('../../../utils/notification')

Page({
  data: {
    status: 'success',
    title: '支付成功',
    desc: '订单已提交，可前往查看当前课程拼团详情。',
    primaryText: '查看拼团详情',
    showHomeButton: false,
    isSuccess: true,
    packageId: '',
    packageGroupId: '',
    action: 'start',
    successType: 'start',
    targetCount: 0,
    classDate: '',
    weekday: 6,
    hour: 10,
    childNickname: '',
    childAge: '',
    parentMobile: '',
    showSubscribeCard: false,
    subscribeEnabled: false,
    subscribeSubmitting: false,
    subscribeStatusText: '',
    subscribeStatusTone: 'muted'
  },

  onLoad(options) {
    const status = options.status || 'success'
    const viewState = this.resolveViewState(status)

    this.setData({
      status,
      ...viewState,
      packageId: options.packageId || '',
      packageGroupId: options.packageGroupId || '',
      action: options.action || 'start',
      successType: options.successType || (options.action === 'join' ? 'join' : 'start'),
      targetCount: Number(options.targetCount) || 0,
      classDate: decodeURIComponent(options.classDate || ''),
      weekday: Number(options.weekday) || 6,
      hour: Number(options.hour) || 10,
      childNickname: decodeURIComponent(options.childNickname || ''),
      childAge: decodeURIComponent(options.childAge || ''),
      parentMobile: decodeURIComponent(options.parentMobile || ''),
      showSubscribeCard: status === 'success',
      subscribeEnabled: this.resolveSubscribeEnabled(),
      subscribeStatusText: this.resolveInitialSubscribeStatus(status),
      subscribeStatusTone: 'muted'
    })
  },

  resolveSubscribeEnabled() {
    const templateIds = resolveGroupResultTemplateIds()
    return !!(templateIds.groupSuccess && templateIds.groupFail && wx.requestSubscribeMessage)
  },

  resolveInitialSubscribeStatus(status) {
    if (status !== 'success') {
      return ''
    }

    if (!wx.requestSubscribeMessage) {
      return '当前微信版本不支持订阅通知，请在“我的拼团”里留意结果。'
    }

    const templateIds = resolveGroupResultTemplateIds()
    if (!templateIds.groupSuccess || !templateIds.groupFail) {
      return '通知模板暂未配置完成，请在“我的拼团”里留意结果。'
    }

    return '订阅后可及时收到拼团成功或失败通知。'
  },

  resolveViewState(status) {
    if (status === 'success') {
      return {
        title: '支付成功',
        desc: '订单已提交，可前往查看当前课程拼团详情。',
        primaryText: '查看拼团详情',
        showHomeButton: false,
        isSuccess: true
      }
    }

    if (status === 'processing') {
      return {
        title: '支付确认中',
        desc: '微信支付已返回，系统正在确认订单结果。若稍后仍未更新，可在“我的拼团”查看进度。',
        primaryText: '返回首页',
        showHomeButton: false,
        isSuccess: false
      }
    }

    if (status === 'cancel') {
      return {
        title: '已取消支付',
        desc: '本次待支付订单已关闭，不会创建拼团或占用拼团名额。',
        primaryText: '重新支付',
        showHomeButton: true,
        isSuccess: false
      }
    }

    return {
      title: '支付失败',
      desc: '本次支付未完成，请重新支付或先返回首页。',
      primaryText: '重新支付',
      showHomeButton: true,
      isSuccess: false
    }
  },

  handlePrimaryAction() {
    if (this.data.status === 'processing') {
      wx.switchTab({
        url: '/pages/home/index'
      })
      return
    }

    if (this.data.status === 'success' && this.data.packageGroupId) {
      wx.redirectTo({
        url:
          `/pages/group/detail/index?packageGroupId=${this.data.packageGroupId}` +
          `&entry=paymentSuccess` +
          `&successType=${this.data.successType}` +
          `&action=${this.data.action}` +
          `&packageId=${this.data.packageId}`
      })
      return
    }

    if (this.data.action === 'join' && this.data.packageGroupId) {
      wx.redirectTo({
        url:
          `/pages/payment/confirm/index?action=join` +
          `&packageId=${this.data.packageId}` +
          `&packageGroupId=${this.data.packageGroupId}` +
          `&childNickname=${encodeURIComponent(this.data.childNickname)}` +
          `&childAge=${encodeURIComponent(this.data.childAge)}` +
          `&parentMobile=${encodeURIComponent(this.data.parentMobile)}`
      })
      return
    }

    wx.redirectTo({
      url:
        `/pages/package/start/index?packageId=${this.data.packageId}` +
        `&targetCount=${this.data.targetCount}` +
        `&classDate=${encodeURIComponent(this.data.classDate)}` +
        `&weekday=${this.data.weekday}` +
        `&hour=${this.data.hour}` +
        `&childNickname=${encodeURIComponent(this.data.childNickname)}` +
        `&childAge=${encodeURIComponent(this.data.childAge)}` +
        `&parentMobile=${encodeURIComponent(this.data.parentMobile)}`
    })
  },

  handleSecondaryAction() {
    wx.switchTab({
      url: '/pages/home/index'
    })
  },

  async handleSubscribeTap() {
    if (!this.data.showSubscribeCard || !this.data.subscribeEnabled || this.data.subscribeSubmitting) {
      return
    }

    this.setData({
      subscribeSubmitting: true,
      subscribeStatusText: '正在发起订阅...',
      subscribeStatusTone: 'muted'
    })

    try {
      const payload = await requestGroupResultSubscription({
        groupId: this.data.packageGroupId,
        courseId: this.data.packageId
      })

      try {
        await reportGroupResultSubscription(payload)
      } catch (reportError) {
        console.warn('[payment/result] report subscribe result failed', reportError)
      }

      if (payload.ok) {
        this.setData({
          subscribeStatusText: '订阅成功，后续会通过微信通知你拼团结果。',
          subscribeStatusTone: 'success'
        })
        return
      }

      if (payload.skipped) {
        this.setData({
          subscribeStatusText:
            payload.reason === 'template_not_configured'
              ? '通知模板暂未配置完成，请在“我的拼团”里留意结果。'
              : '当前微信版本不支持订阅通知，请在“我的拼团”里留意结果。',
          subscribeStatusTone: 'muted'
        })
        return
      }

      this.setData({
        subscribeStatusText: '你暂未订阅通知，后续可在“我的拼团”里查看拼团进度。',
        subscribeStatusTone: 'muted'
      })
    } finally {
      this.setData({
        subscribeSubmitting: false
      })
    }
  }
})
