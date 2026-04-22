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
    targetCount: 0,
    weekday: 6,
    hour: 10,
    childNickname: '',
    childAge: ''
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
      targetCount: Number(options.targetCount) || 0,
      weekday: Number(options.weekday) || 6,
      hour: Number(options.hour) || 10,
      childNickname: decodeURIComponent(options.childNickname || ''),
      childAge: decodeURIComponent(options.childAge || '')
    })
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
      desc: '本次支付未完成，你可以重新支付或返回首页。',
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
        url: `/pages/group/detail/index?packageGroupId=${this.data.packageGroupId}`
      })
      return
    }

    if (this.data.action === 'join' && this.data.packageGroupId) {
      wx.redirectTo({
        url: `/pages/payment/confirm/index?action=join&packageId=${this.data.packageId}&packageGroupId=${this.data.packageGroupId}`
      })
      return
    }

    wx.redirectTo({
      url:
        `/pages/package/start/index?packageId=${this.data.packageId}` +
        `&targetCount=${this.data.targetCount}` +
        `&weekday=${this.data.weekday}` +
        `&hour=${this.data.hour}` +
        `&childNickname=${encodeURIComponent(this.data.childNickname)}` +
        `&childAge=${encodeURIComponent(this.data.childAge)}`
    })
  },

  handleSecondaryAction() {
    wx.switchTab({
      url: '/pages/home/index'
    })
  }
})
