const {
  requestGroupResultSubscription,
  reportGroupResultSubscription,
  resolveGroupResultTemplateId
} = require('../../../utils/notification')

Page({
  data: {
    status: 'success',
    courseId: '',
    groupId: '',
    subscribeHintText: '拼团成功或失败后，会优先通过小程序通知你。',
    subscribeStatusText: '',
    subscribeStatusClassName: ''
  },

  onLoad(options) {
    this._isAlive = true
    this._timers = []
    this._subscribeRequested = false

    this.safeSetData({
      status: options.status || 'success',
      courseId: options.courseId || '',
      groupId: options.groupId || ''
    })
  },

  onShow() {
    this.tryAutoRequestSubscription()
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

  async tryAutoRequestSubscription() {
    if (!this._isAlive || this._subscribeRequested || this.data.status !== 'success') {
      return
    }

    this._subscribeRequested = true

    const templateId = resolveGroupResultTemplateId()
    if (!templateId) {
      this.safeSetData({
        subscribeStatusText: '当前环境尚未配置通知模板，你仍可在我的拼团中查看结果。',
        subscribeStatusClassName: 'subscribe-status-muted'
      })
      return
    }

    const result = await requestGroupResultSubscription({
      groupId: this.data.groupId,
      courseId: this.data.courseId
    })

    if (!this._isAlive) {
      return
    }

    const nextState = this.buildSubscribeState(result)
    this.safeSetData(nextState)

    if (result.ok) {
      wx.showToast({
        title: '拼团结果会第一时间通知你',
        icon: 'none'
      })
    }

    try {
      await reportGroupResultSubscription({
        ...result,
        groupId: this.data.groupId,
        courseId: this.data.courseId
      })
    } catch (error) {
      console.warn('[payment-result] failed to report subscription result', error)
    }
  },

  buildSubscribeState(result) {
    if (result && result.ok) {
      return {
        subscribeStatusText: '已开启拼团结果通知，成团或失败后会第一时间提醒你。',
        subscribeStatusClassName: 'subscribe-status-success'
      }
    }

    if (result && result.skipped && result.reason === 'api_not_supported') {
      return {
        subscribeStatusText: '当前微信基础库暂不支持结果通知订阅，请在我的拼团中查看结果。',
        subscribeStatusClassName: 'subscribe-status-muted'
      }
    }

    return {
      subscribeStatusText: '若未开启通知，也可以在我的拼团中随时查看拼团结果。',
      subscribeStatusClassName: 'subscribe-status-muted'
    }
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
