const { fetchGroupDetail } = require('../../../utils/course')

const STATUS_MAP = {
  ongoing: {
    text: '进行中',
    className: 'status-ongoing'
  },
  success: {
    text: '已成团',
    className: 'status-success'
  },
  failed: {
    text: '已失败',
    className: 'status-failed'
  }
}

const formatRemainingTime = totalSeconds => {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  const formatNumber = value => `${value}`.padStart(2, '0')
  return `${formatNumber(hours)}:${formatNumber(minutes)}:${formatNumber(seconds)}`
}

const handleShareSuccess = () => {
  wx.showToast({
    title: '分享成功',
    icon: 'success',
    duration: 2000
  })
}

Page({
  data: {
    groupId: '',
    courseId: '',
    loading: true,
    groupDetail: null,
    statusText: '',
    statusClassName: ''
  },

  async onLoad(options) {
    this._isAlive = true
    this._timers = []

    this.safeSetData({
      groupId: options.groupId || '',
      courseId: options.courseId || ''
    })

    await this.loadGroupDetail(options.groupId || '')
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

  async loadGroupDetail(groupId) {
    if (!groupId) {
      if (!this._isAlive) {
        return
      }

      wx.showToast({
        title: '拼团信息不存在',
        icon: 'none'
      })
      return
    }

    this.safeSetData({
      loading: true
    })

    try {
      const groupDetail = await fetchGroupDetail(groupId)
      const statusInfo = STATUS_MAP[groupDetail.status] || STATUS_MAP.ongoing

      if (!this._isAlive) {
        return
      }

      this.safeSetData({
        groupDetail: {
          ...groupDetail,
          progressText: `${groupDetail.currentCount}/${groupDetail.targetCount}`,
          progressPercent: `${(groupDetail.currentCount / groupDetail.targetCount) * 100}%`,
          remainingTimeText: formatRemainingTime(groupDetail.remainingSeconds)
        },
        courseId: groupDetail.courseId,
        statusText: statusInfo.text,
        statusClassName: statusInfo.className
      })
    } catch (error) {
      if (!this._isAlive) {
        return
      }

      wx.showToast({
        title: '拼团详情加载失败',
        icon: 'none'
      })
    } finally {
      this.safeSetData({
        loading: false
      })
    }
  },

  onShareAppMessage() {
    const { groupDetail } = this.data
    if (!groupDetail) {
      return {
        title: '邻动体适能拼团',
        path: '/pages/home/index',
        success: handleShareSuccess
      }
    }

    return {
      title: `邀请你加入「${groupDetail.courseInfo.title}」拼团`,
      path: `/pages/group/detail/index?groupId=${groupDetail.groupId}`,
      imageUrl: groupDetail.courseInfo.cover,
      success: handleShareSuccess
    }
  },

  handleJoinGroup() {
    if (!this._isAlive) {
      return
    }

    const { groupDetail } = this.data
    if (!groupDetail) {
      return
    }

    wx.navigateTo({
      url: `/pages/payment/confirm/index?courseId=${groupDetail.courseId}&groupId=${groupDetail.groupId}`
    })
  }
})
