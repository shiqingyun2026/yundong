Page({
  data: {
    status: 'success',
    courseId: '',
    groupId: ''
  },

  onLoad(options) {
    this._isAlive = true
    this._timers = []

    this.safeSetData({
      status: options.status || 'success',
      courseId: options.courseId || '',
      groupId: options.groupId || ''
    })
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

  handlePrimaryAction() {
    if (!this._isAlive) {
      return
    }

    const { status, courseId, groupId } = this.data

    if (status === 'success') {
      wx.redirectTo({
        url: `/pages/group/detail/index?courseId=${courseId}&groupId=${groupId}`
      })
      return
    }

    wx.redirectTo({
      url: `/pages/payment/confirm/index?courseId=${courseId}&groupId=${groupId}`
    })
  },

  handleSecondaryAction() {
    if (!this._isAlive) {
      return
    }

    wx.switchTab({
      url: '/pages/home/index'
    })
  }
})
