const { fetchCourseList } = require('../../utils/course')
const {
  DEFAULT_LOCATION,
  DEFAULT_LOCATION_NAME,
  resolveLocationDetails
} = require('../../utils/location')

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
  const completedGroupsCount = Number(item && item.completedGroupsCount) || 0
  const maxGroups = Number(item && item.maxGroups) || 0
  const successJoinedCount = Number(item && item.successJoinedCount) || 0
  const canCreateGroup = maxGroups <= 0 || completedGroupsCount < maxGroups
  const courseSoldOut = !activeGroup && !canCreateGroup
  const displayJoinedCount = activeGroup ? Number(item.joinedCount) || 0 : successJoinedCount

  return {
    ...item,
    activeGroup,
    showActiveGroupCountdown: !!(activeGroup && activeGroup.expireTimeText && activeGroup.expireTimeText !== '已结束'),
    courseSoldOut,
    showSuccessBadge: courseSoldOut && completedGroupsCount > 0,
    displayJoinedCount,
    showJoinedCount: !courseSoldOut && displayJoinedCount > 0
  }
}

const HOME_TABS = [
  { key: 'all', label: '全部课程', sort: 'distance' },
  { key: 'recent', label: '最近开课', sort: 'time' }
]

const LOCATION_TIMEOUT_MS = 5000
const buildLocationKey = location =>
  location ? `${location.latitude || ''}:${location.longitude || ''}:${location.source || ''}:${location.name || ''}` : ''

Page({
  data: {
    tabs: HOME_TABS,
    activeTab: 'all',
    locationText: '定位中...',
    locationSource: '',
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
    this._hasLoadedOnce = false
    this._currentLocationKey = ''
    this.initLocationAndCourses()
  },

  onShow() {
    if (this._hasLoadedOnce) {
      const previousLocationKey = this._currentLocationKey
      const location = this.syncCurrentLocationFromStore()
      if (buildLocationKey(location) !== previousLocationKey) {
        this.loadCourseList({
          page: 1,
          showLoading: false
        })
        return
      }

      this.loadCourseList({
        page: 1,
        showLoading: false
      })
      return
    }

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
    const location = this.syncCurrentLocationFromStore()

    if (!location || location.source === 'default') {
      await this.tryGetLocation({
        applyToSelected: !location || location.source !== 'manual'
      })
    }

    await this.loadCourseList({
      page: 1
    })
    this._hasLoadedOnce = true
  },

  syncCurrentLocationFromStore() {
    const app = getApp()
    const selectedLocation = app.globalData.selectedLocation || wx.getStorageSync('selectedLocation') || null
    const gpsLocation = app.globalData.gpsLocation || wx.getStorageSync('gpsLocation') || null
    const nextLocation = selectedLocation || gpsLocation || DEFAULT_LOCATION

    app.globalData.selectedLocation = selectedLocation
    app.globalData.gpsLocation = gpsLocation
    app.globalData.location = nextLocation

    this.setData({
      locationText: nextLocation.source === 'manual' ? `${nextLocation.name}（已切换）` : nextLocation.name,
      locationSource: nextLocation.source
    })

    return nextLocation
  },

  tryGetLocation({ applyToSelected = false } = {}) {
    return new Promise(resolve => {
      let settled = false
      const finishWithLocation = (location, { denied = false, tip = '', toast } = {}) => {
        if (settled) {
          return
        }

        settled = true
        clearTimeout(timeoutId)
        const app = getApp()
        const normalizedLocation = {
          ...DEFAULT_LOCATION,
          ...location
        }
        app.setGpsLocation(normalizedLocation)
        if (applyToSelected || !app.globalData.selectedLocation) {
          app.setSelectedLocation(normalizedLocation)
        }
        this._currentLocationKey = buildLocationKey(app.getCurrentLocation() || normalizedLocation)
        this.setData({
          locationText:
            (app.getCurrentLocation() || normalizedLocation).source === 'manual'
              ? `${(app.getCurrentLocation() || normalizedLocation).name}（已切换）`
              : (app.getCurrentLocation() || normalizedLocation).name,
          locationSource: (app.getCurrentLocation() || normalizedLocation).source,
          locationDenied: denied,
          locationTip: tip
        })

        if (toast) {
          wx.showToast({
            title: toast,
            icon: 'none'
          })
        }

        resolve(normalizedLocation)
      }

      const timeoutId = setTimeout(() => {
        finishWithLocation(DEFAULT_LOCATION, {
          tip: '定位超时，已按默认位置展示课程。',
          toast: '定位超时，已切换默认位置'
        })
      }, LOCATION_TIMEOUT_MS)

      wx.getLocation({
        type: 'gcj02',
        success: async res => {
          const location = await resolveLocationDetails({
            latitude: res.latitude,
            longitude: res.longitude
          })

          finishWithLocation(location, {
            tip: location.source === 'coordinates' ? '已获取真实经纬度，但云函数地址解析未返回，先按当前位置展示课程。' : ''
          })
        },
        fail: error => {
          const denied = /auth deny|auth denied|authorize no response|permission/i.test(error.errMsg || '')
          finishWithLocation(DEFAULT_LOCATION, {
            denied,
            tip: denied
              ? '定位未授权，已按默认位置展示课程，可点击顶部定位栏重新定位或手动选择位置。'
              : '定位获取失败，已按默认位置展示课程。',
            toast: denied ? '未开启定位，已按默认位置展示' : '定位失败，已切换默认位置'
          })
        }
      })
    })
  },

  async loadCourseList({ page = 1, showLoading = true } = {}) {
    const app = getApp()
    const currentTab = this.data.tabs.find(item => item.key === this.data.activeTab) || this.data.tabs[0]
    const currentLocation = app.getCurrentLocation() || DEFAULT_LOCATION
    this._currentLocationKey = buildLocationKey(currentLocation)

    this.setData({
      locationText: currentLocation.source === 'manual' ? `${currentLocation.name}（已切换）` : currentLocation.name,
      locationSource: currentLocation.source
    })

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
      wx.navigateTo({
        url: `/pages/location-search/index?city=${encodeURIComponent(DEFAULT_LOCATION.city)}`
      })
      return
    }

    const currentLocation = getApp().getCurrentLocation() || DEFAULT_LOCATION
    wx.navigateTo({
      url: `/pages/location-search/index?city=${encodeURIComponent(currentLocation.city || DEFAULT_LOCATION.city)}`
    })
  },

  handleManualLocationTip() {
    if (!this.data.locationDenied) {
      wx.navigateTo({
        url: `/pages/location-search/index?city=${encodeURIComponent(
          (getApp().getCurrentLocation() || DEFAULT_LOCATION).city || DEFAULT_LOCATION.city
        )}`
      })
      return
    }

    wx.openSetting({
      success: async res => {
        const authSetting = (res && res.authSetting) || {}
        if (authSetting['scope.userLocation']) {
          await this.tryGetLocation({
            applyToSelected: !getApp().globalData.selectedLocation
          })
          await this.loadCourseList({
            page: 1
          })
          return
        }

        wx.showToast({
          title: '仍未开启定位权限',
          icon: 'none'
        })
      }
    })
  },

  handleCourseTap(event) {
    const { id } = event.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/course/detail/index?id=${id}`
    })
  }
})
