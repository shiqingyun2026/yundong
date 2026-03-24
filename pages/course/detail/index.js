const { fetchCourseDetail, fetchActiveGroup, createOrder } = require('../../../utils/course')

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

const getExpireMeta = expireTime => {
  const expireDate = safeDate(expireTime)
  if (!expireDate) {
    return {
      text: '已结束',
      tone: 'ended',
      hint: '该拼团已截止，可重新开团'
    }
  }

  const diff = expireDate.getTime() - Date.now()
  if (diff <= 0) {
    return {
      text: '已结束',
      tone: 'ended',
      hint: '该拼团已截止，可重新开团'
    }
  }

  const totalHours = Math.floor(diff / 3600000)
  if (totalHours < 1) {
    return {
      text: formatExpireTime(expireTime),
      tone: 'urgent',
      hint: '即将截止，邀请好友一起拼更稳妥'
    }
  }

  if (totalHours < 24) {
    return {
      text: formatExpireTime(expireTime),
      tone: 'warning',
      hint: '拼团正在进行中，尽快凑齐人数'
    }
  }

  return {
    text: formatExpireTime(expireTime),
    tone: 'normal',
    hint: '拼团仍在进行中，可邀请好友加入'
  }
}

const resolveExpireTime = activeGroup => {
  const expireDate = safeDate(activeGroup && activeGroup.expireTime)
  if (expireDate) {
    return expireDate.toISOString()
  }

  const remainingSeconds = Math.max(0, Number(activeGroup && activeGroup.remainingSeconds) || 0)
  if (remainingSeconds > 0) {
    return new Date(Date.now() + remainingSeconds * 1000).toISOString()
  }

  return ''
}

const buildActiveGroupViewModel = activeGroup => {
  if (!activeGroup) {
    return null
  }

  const currentCount = Number(activeGroup.currentCount) || 0
  const targetCount = Number(activeGroup.targetCount) || 0
  const expireTime = resolveExpireTime(activeGroup)
  const expireMeta = getExpireMeta(expireTime)

  return {
    ...activeGroup,
    expireTime,
    expireTimeText: expireMeta.text,
    expireTone: expireMeta.tone,
    expireHint: expireMeta.hint,
    isExpired: expireMeta.text === '已结束',
    remainingCount: Math.max(0, targetCount - currentCount),
    progressText: `${currentCount}/${targetCount}`,
    progressPercent: targetCount > 0 ? `${(currentCount / targetCount) * 100}%` : '0%'
  }
}

const normalizeCourseDetail = detail => {
  if (!detail) {
    return null
  }

  return {
    ...detail,
    title: detail.title || detail.name || '',
    images: Array.isArray(detail.images) && detail.images.length ? detail.images : (detail.cover ? [detail.cover] : []),
    groupPriceText:
      detail.groupPriceText !== undefined
        ? `${detail.groupPriceText}`
        : Number(detail.group_price || detail.groupPrice || 0).toFixed(2),
    originalPriceText:
      detail.originalPriceText !== undefined
        ? `${detail.originalPriceText}`
        : Number(detail.original_price || detail.originalPrice || 0).toFixed(2),
    targetCount: Number(detail.targetCount ?? detail.target_count) || 0,
    joinedCount: Number(detail.current_count ?? detail.joinedCount ?? detail.joined_count) || 0,
    timeText: detail.timeText || detail.start_time || '',
    locationText: detail.locationText || detail.address || detail.location || '',
    ageRange: detail.ageRange || detail.age_range || detail.age_limit || '',
    descriptionNodes: detail.descriptionNodes || [],
    groupRuleNodes: detail.groupRuleNodes || [],
    insuranceText: detail.insuranceText || detail.insurance_text || detail.insurance_desc || '',
    serviceQrCode: detail.serviceQrCode || '',
    coach: {
      name: (detail.coach && detail.coach.name) || detail.coach_name || '教练待定',
      intro: (detail.coach && detail.coach.intro) || detail.coach_intro || '',
      certificates:
        (detail.coach && Array.isArray(detail.coach.certificates) && detail.coach.certificates) ||
        detail.coach_certificates ||
        []
    }
  }
}

Page({
  data: {
    courseId: '',
    courseDetail: null,
    activeGroup: null,
    loading: true,
    showServiceModal: false,
    creatingOrder: false
  },

  async onLoad(options) {
    this._expireTimer = null
    const courseId = options.id || ''
    this.setData({
      courseId
    })

    await this.loadPageData(courseId)
  },

  onUnload() {
    this.clearExpireTimer()
  },

  clearExpireTimer() {
    if (this._expireTimer) {
      clearInterval(this._expireTimer)
      this._expireTimer = null
    }
  },

  startExpireTimer() {
    this.clearExpireTimer()

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
      this.setData({
        activeGroup: nextActiveGroup
      })

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

      this.setData({
        courseDetail: normalizeCourseDetail(courseDetail),
        activeGroup: buildActiveGroupViewModel(activeGroup)
      })

      this.startExpireTimer()
    } catch (error) {
      wx.showToast({
        title: '课程详情加载失败',
        icon: 'none'
      })
    } finally {
      if (!this.data.activeGroup) {
        this.clearExpireTimer()
      }

      this.setData({
        loading: false
      })
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

  handleConfirmService() {
    this.setData({
      showServiceModal: false
    })
  },

  async handleGoPayment() {
    const { courseId, courseDetail, activeGroup, creatingOrder } = this.data

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

    const joinableGroup = activeGroup && !activeGroup.isExpired ? activeGroup : null
    const groupId = joinableGroup ? joinableGroup.groupId : ''

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
      wx.showToast({
        title: '下单失败，请稍后再试',
        icon: 'none'
      })
    } finally {
      this.setData({
        creatingOrder: false
      })
    }
  }
})
