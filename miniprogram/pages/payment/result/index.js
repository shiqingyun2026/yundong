Page({
  data: {
    status: 'success',
    packageId: '',
    packageGroupId: '',
    action: 'start',
    targetCount: 0,
    weekday: 6,
    hour: 10
  },

  onLoad(options) {
    this.setData({
      status: options.status || 'success',
      packageId: options.packageId || '',
      packageGroupId: options.packageGroupId || '',
      action: options.action || 'start',
      targetCount: Number(options.targetCount) || 0,
      weekday: Number(options.weekday) || 6,
      hour: Number(options.hour) || 10
    })
  },

  handlePrimaryAction() {
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
        `/pages/payment/confirm/index?action=start` +
        `&packageId=${this.data.packageId}` +
        `&targetCount=${this.data.targetCount}` +
        `&weekday=${this.data.weekday}` +
        `&hour=${this.data.hour}`
    })
  },

  handleSecondaryAction() {
    wx.switchTab({
      url: '/pages/home/index'
    })
  }
})
