const { fetchCourseList } = require('../../utils/course')

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
    return ''
  }

  const diff = expireDate.getTime() - Date.now()
  if (diff <= 0) {
    return '已结束'
  }

  const totalMinutes = Math.floor(diff / 60000)
  const totalHours = Math.floor(diff / 3600000)
  const days = Math.floor(totalHours / 24)

  if (days >= 1) {
    return `剩余 ${days} 天 ${totalHours % 24} 小时`
  }

  if (totalHours >= 1) {
    return `剩余 ${totalHours} 小时`
  }

  if (totalMinutes >= 1) {
    return `剩余 ${totalMinutes} 分钟`
  }

  return '已结束'
}

const buildCourseCard = item => {
  const activeGroup = item && item.activeGroup
    ? {
        ...item.activeGroup,
        expireTimeText: formatExpireTime(item.activeGroup.expireTime)
      }
    : null

  return {
    ...item,
    activeGroup,
    showActiveGroupCountdown: !!(activeGroup && activeGroup.expireTimeText && activeGroup.expireTimeText !== '已结束')
  }
}

const HOME_TABS = [
  { key: 'all', label: '全部课程', sort: 'distance' },
  { key: 'recent', label: '最近开课', sort: 'time' }
]

const DEFAULT_LOCATION = {
  latitude: 39.9042,
  longitude: 116.4074,
  name: '北京市 · 默认位置'
}

const resolveLocationLabel = (latitude, longitude) => {
  if (latitude > 22 && latitude < 23 && longitude > 113 && longitude < 115) {
    return '深圳市 · 南山区'
  }

  if (latitude > 39 && latitude < 41 && longitude > 115 && longitude < 117) {
    return '北京市 · 当前定位'
  }

  return '当前位置'
}

Page({
  data: {
    tabs: HOME_TABS,
    activeTab: 'all',
    locationText: '定位中...',
    locationDenied: false,
    locationTip: '',
    courseList: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    initialLoading: true
  },

  onLoad() {
    this._countdownTimer = null
    this._countdownStartTimer = null
    this.initLocationAndCourses()
  },

  onShow() {
    this.scheduleCountdownTimer()
  },

  onHide() {
    this.clearCountdownTimer()
  },

  onUnload() {
    this.clearCountdownTimer()
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) {
      return
    }

    this.loadCourseList({
      page: this.data.page + 1
    })
  },

  async onPullDownRefresh() {
    await this.loadCourseList({
      page: 1,
      showLoading: false
    })
    wx.stopPullDownRefresh()
  },

  async initLocationAndCourses() {
    await this.tryGetLocation()
    await this.loadCourseList({
      page: 1
    })
  },

  tryGetLocation() {
    return new Promise(resolve => {
      wx.getLocation({
        type: 'gcj02',
        success: res => {
          const location = {
            latitude: res.latitude,
            longitude: res.longitude,
            name: resolveLocationLabel(res.latitude, res.longitude)
          }

          getApp().setLocation(location)
          this.setData({
            locationText: location.name,
            locationDenied: false,
            locationTip: ''
          })
          resolve(location)
        },
        fail: error => {
          const denied = /auth deny|auth denied|authorize no response|permission/i.test(error.errMsg || '')
          getApp().setLocation(DEFAULT_LOCATION)
          this.setData({
            locationText: DEFAULT_LOCATION.name,
            locationDenied: denied,
            locationTip: denied
              ? '定位未授权，已按默认位置展示课程，可点击顶部定位栏重新定位或手动选择位置。'
              : '定位获取失败，已按默认位置展示课程。'
          })

          wx.showToast({
            title: denied ? '未开启定位，已按默认位置展示' : '定位失败，已切换默认位置',
            icon: 'none'
          })
          resolve(DEFAULT_LOCATION)
        }
      })
    })
  },

  async loadCourseList({ page = 1, showLoading = true } = {}) {
    const app = getApp()
    const currentTab = this.data.tabs.find(item => item.key === this.data.activeTab) || this.data.tabs[0]
    const currentLocation = app.globalData.location || DEFAULT_LOCATION

    this.setData({
      loading: true,
      initialLoading: page === 1 ? showLoading : this.data.initialLoading
    })

    try {
      const result = await fetchCourseList({
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
        sort: currentTab.sort,
        page,
        pageSize: this.data.pageSize
      })

      const nextList = (page === 1 ? result.list : this.data.courseList.concat(result.list)).map(buildCourseCard)

      this.setData({
        courseList: nextList,
        page,
        hasMore: result.hasMore,
        initialLoading: false
      })

      this.scheduleCountdownTimer()
    } catch (error) {
      wx.showToast({
        title: '课程加载失败，请稍后再试',
        icon: 'none'
      })
      this.setData({
        initialLoading: false
      })
    } finally {
      this.setData({
        loading: false
      })
    }
  },

  clearCountdownTimer() {
    if (this._countdownStartTimer) {
      clearTimeout(this._countdownStartTimer)
      this._countdownStartTimer = null
    }

    if (this._countdownTimer) {
      clearInterval(this._countdownTimer)
      this._countdownTimer = null
    }
  },

  scheduleCountdownTimer() {
    this.clearCountdownTimer()

    if (this.data.loading || this.data.initialLoading) {
      return
    }

    if (!this.data.courseList.some(item => item.activeGroup && item.activeGroup.expireTime)) {
      return
    }

    this._countdownStartTimer = setTimeout(() => {
      this._countdownStartTimer = null
      this.startCountdownTimer()
    }, 300)
  },

  startCountdownTimer() {
    if (!this.data.courseList.some(item => item.activeGroup && item.activeGroup.expireTime)) {
      return
    }

    this._countdownTimer = setInterval(() => {
      const nextList = this.data.courseList.map(buildCourseCard)
      if (!nextList.some(item => item.showActiveGroupCountdown)) {
        this.clearCountdownTimer()
      }
      this.setData({
        courseList: nextList
      })
    }, 1000)
  },

  handleTabChange(event) {
    const { key } = event.currentTarget.dataset
    if (!key || key === this.data.activeTab) {
      return
    }

    this.setData({
      activeTab: key
    })

    this.loadCourseList({
      page: 1
    })
  },

  async handleLocationTap() {
    if (this.data.locationDenied) {
      wx.showModal({
        title: '定位未授权',
        content: '当前已按默认位置展示课程。你可以在系统设置中开启定位，或后续使用手动选择位置功能。',
        confirmText: '重新定位',
        cancelText: '手动选择',
        success: async res => {
          if (res.confirm) {
            await this.tryGetLocation()
            await this.loadCourseList({
              page: 1
            })
            return
          }

          wx.showToast({
            title: '手动选择位置功能即将上线',
            icon: 'none'
          })
        }
      })
      return
    }

    await this.tryGetLocation()
    await this.loadCourseList({
      page: 1
    })
  },

  handleManualLocationTip() {
    wx.showToast({
      title: '手动选择位置功能即将上线',
      icon: 'none'
    })
  },

  handleCourseTap(event) {
    const { id } = event.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/course/detail/index?id=${id}`
    })
  }
})
