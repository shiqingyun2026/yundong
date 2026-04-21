Page({
  data: {
    status: 'success',
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
    this.setData({
      status: options.status || 'success',
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
