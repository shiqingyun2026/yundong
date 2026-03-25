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

const safeDate = value => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatExpireTime = expireTime => {
  const expireDate = safeDate(expireTime)
  if (!expireDate) {
    return '已结束'
  }

  const diff = expireDate.getTime() - Date.now()
  if (diff <= 0) {
    return '已结束'
  }

  const totalMinutes = Math.floor(diff / 60000)
  const totalHours = Math.floor(diff / 3600000)
  const days = Math.floor(totalHours / 24)

  if (days >= 1) {
    const hours = totalHours % 24
    return `剩余 ${days} 天 ${hours} 小时`
  }

  if (totalHours >= 1) {
    return `剩余 ${totalHours} 小时`
  }

  if (totalMinutes >= 1) {
    return `剩余 ${totalMinutes} 分钟`
  }

  return '已结束'
}

const resolveExpireTime = groupDetail => {
  const expireDate = safeDate(groupDetail && groupDetail.expireTime)
  if (expireDate) {
    return expireDate.toISOString()
  }

  const remainingSeconds = Math.max(0, Number(groupDetail && groupDetail.remainingSeconds) || 0)
  if (remainingSeconds > 0) {
    return new Date(Date.now() + remainingSeconds * 1000).toISOString()
  }

  return ''
}

const buildGroupDetailViewModel = groupDetail => {
  if (!groupDetail) {
    return null
  }

  const currentCount = Number(groupDetail.currentCount) || 0
  const targetCount = Number(groupDetail.targetCount) || 0
  const expireTime = resolveExpireTime(groupDetail)
  const expireTimeText = formatExpireTime(expireTime)
  const effectiveStatus = groupDetail.status === 'ongoing' && expireTimeText === '已结束' ? 'failed' : groupDetail.status

  return {
    ...groupDetail,
    status: effectiveStatus,
    expireTime,
    progressText: `${currentCount}/${targetCount}`,
    progressPercent: targetCount > 0 ? `${(currentCount / targetCount) * 100}%` : '0%',
    expireTimeText
  }
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
    statusClassName: '',
    bottomStatusText: '拼团失败，已退款'
  },

  async onLoad(options) {
    this._isAlive = true
    this._timers = []
    this._expireStartTimer = null
    this._hasLoadedOnce = false

    this.safeSetData({
      groupId: options.groupId || '',
      courseId: options.courseId || ''
    })

    await this.loadGroupDetail(options.groupId || '')
  },

  async onShow() {
    if (!this._hasLoadedOnce || !this.data.groupId) {
      return
    }

    await this.loadGroupDetail(this.data.groupId)
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
    if (this._expireStartTimer) {
      clearTimeout(this._expireStartTimer)
      this._expireStartTimer = null
    }

    ;(this._timers || []).forEach(timerId => clearInterval(timerId))
    this._timers = []
  },

  updateGroupPresentation(groupDetail) {
    const statusInfo = STATUS_MAP[(groupDetail && groupDetail.status) || 'ongoing'] || STATUS_MAP.ongoing

    this.safeSetData({
      groupDetail,
      statusText: statusInfo.text,
      statusClassName: statusInfo.className,
      bottomStatusText: groupDetail && groupDetail.status === 'success' ? '已成团，等待上课' : '拼团失败，已退款'
    })
  },

  scheduleExpireTimer() {
    this.clearTimers()

    if (this.data.loading || !this.data.groupDetail || !this.data.groupDetail.expireTime) {
      return
    }

    this._expireStartTimer = setTimeout(() => {
      this._expireStartTimer = null
      this.startExpireTimer()
    }, 300)
  },

  startExpireTimer() {
    if (!this.data.groupDetail || !this.data.groupDetail.expireTime) {
      return
    }

    const timerId = setInterval(() => {
      if (!this._isAlive) {
        this.clearTimers()
        return
      }

      const { groupDetail } = this.data
      if (!groupDetail) {
        this.clearTimers()
        return
      }

      const nextGroupDetail = buildGroupDetailViewModel(groupDetail)
      this.updateGroupPresentation(nextGroupDetail)

      if (nextGroupDetail.status !== 'ongoing') {
        this.clearTimers()
      }
    }, 1000)

    this._timers.push(timerId)
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
      const nextGroupDetail = buildGroupDetailViewModel(groupDetail)

      if (!this._isAlive) {
        return
      }

      this.safeSetData({
        courseId: nextGroupDetail.courseId
      })

      this.updateGroupPresentation(nextGroupDetail)
    } catch (error) {
      if (!this._isAlive) {
        return
      }

      wx.showToast({
        title: '拼团详情加载失败',
        icon: 'none'
      })
    } finally {
      this._hasLoadedOnce = true

      if (!this.data.groupDetail) {
        this.clearTimers()
      }

      this.safeSetData({
        loading: false
      })

      this.scheduleExpireTimer()
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
      path: `/pages/course/detail/index?id=${groupDetail.courseId}&groupId=${groupDetail.groupId}`,
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

    if (groupDetail.status !== 'ongoing') {
      wx.showToast({
        title: groupDetail.status === 'success' ? '该拼团已成团' : '该拼团已结束',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: `/pages/payment/confirm/index?courseId=${groupDetail.courseId}&groupId=${groupDetail.groupId}`
    })
  }
})
