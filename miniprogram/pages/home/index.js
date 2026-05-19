const { fetchHomeBannerList } = require('../../utils/banner')
const { fetchPackageList } = require('../../utils/package')
const {
  DEFAULT_LOCATION,
  LOCATION_RESOLUTION_FALLBACK_REASON,
  resolveLocationDetails
} = require('../../utils/location')

const HOME_TABS = [
  { key: 'all', label: '全部课程' },
  { key: 'fitness', label: '体适能', category: '体适能' },
  { key: 'jump_rope', label: '跳绳', category: '跳绳' }
]

const HOME_BANNERS = [
  {
    id: 'banner-1',
    theme: 'teal',
    title: '体适能春季课程',
    kicker: 'PROMOTIONAL WORK',
    desc: '本次先以展位图形式占位，后续可替换为真实 Banner 数据源。',
    image: '',
    jumpType: 'none',
    jumpTarget: ''
  },
  {
    id: 'banner-2',
    theme: 'cream',
    title: '连续 5 次训练计划',
    kicker: 'PACKAGE HOME',
    desc: '支持多人拼团与周度排课，首页重点展示当前主推课程。',
    image: '',
    jumpType: 'none',
    jumpTarget: ''
  },
  {
    id: 'banner-3',
    theme: 'blue',
    title: '品牌活动位预留',
    kicker: 'BRAND BANNER',
    desc: '后续可接入运营配置，按活动、门店或地区动态切换内容。',
    image: '',
    jumpType: 'none',
    jumpTarget: ''
  }
]

const LOCATION_TIMEOUT_MS = 5000
const HOME_SHARE_TITLE = '家门口的少儿运动团课'

const buildLocationKey = location =>
  location ? `${location.latitude || ''}:${location.longitude || ''}:${location.source || ''}:${location.name || ''}` : ''

const trimLocationDisplay = value => `${value || ''}`.replace(/^[\s·,，、\-]+|[\s·,，、\-]+$/g, '').trim()

const formatHomeLocationText = location => {
  if (!location) {
    return '定位中...'
  }

  const name = trimLocationDisplay(location.name || '')
  const district = trimLocationDisplay(location.district || '')

  if (!name) {
    return '定位中...'
  }

  if (district && name.indexOf(district) === 0) {
    return trimLocationDisplay(name.slice(district.length)) || name
  }

  return name
}

const buildLocationFallbackFeedback = location => {
  if (!location || location.source !== 'coordinates') {
    return {
      denied: false,
      tip: '',
      toast: ''
    }
  }

  if (location.resolutionFallbackReason === LOCATION_RESOLUTION_FALLBACK_REASON.cloudFunctionUnavailable) {
    return {
      denied: false,
      tip: '当前微信基础库不支持云函数逆地理编码，已先使用坐标定位。可点击顶部定位栏手动选址。',
      toast: '已获取坐标位置，可手动补充地址'
    }
  }

  return {
    denied: false,
    tip: '当前位置坐标已获取，但地址解析服务暂不可用。可点击顶部定位栏手动选址或重试。',
    toast: '定位成功，但地址解析失败'
  }
}

const buildPackageCard = item => ({
  ...item,
  classCountTagText: item.classCount > 0 ? `包含${item.classCount}节课` : '',
  showLimitedTimeOfferTag: !!item.showLimitedTimeOfferTag,
  locationText: item.locationDisplayText || item.locationText || '',
  perMemberText: `¥${item.minMemberAmountDisplayText || item.minMemberAmountText}`,
  coverLoadFailed: false,
  distanceText:
    Number.isFinite(item.distanceMeters) && Number(item.distanceMeters) >= 0
      ? Number(item.distanceMeters) >= 1000
        ? `${(Number(item.distanceMeters) / 1000).toFixed(1)}km`
        : `${Math.round(Number(item.distanceMeters))}m`
      : ''
})

const filterPackageListByTab = (list, activeTab) => {
  const source = list || []

  if (activeTab === 'fitness') {
    return source.filter(item => (item.packageCategory || '体适能') === '体适能')
  }

  if (activeTab === 'jump_rope') {
    return source.filter(item => item.packageCategory === '跳绳')
  }

  return source
}

Page({
  data: {
    tabs: HOME_TABS,
    bannerList: HOME_BANNERS,
    activeBannerIndex: 0,
    activeTab: 'all',
    statusBarHeight: 20,
    navBarHeight: 88,
    navBarBodyHeight: 44,
    locationText: '定位中...',
    locationDenied: false,
    locationTip: '',
    packageList: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    initialLoading: true
  },

  onLoad() {
    const app = getApp()
    this._hasLoadedOnce = false
    this._currentLocationKey = ''
    this.setData({
      statusBarHeight: (app.globalData.systemInfo && app.globalData.systemInfo.statusBarHeight) || 20,
      navBarHeight: (app.globalData.systemInfo && app.globalData.systemInfo.navBarHeight) || 88,
      navBarBodyHeight: (app.globalData.systemInfo && app.globalData.systemInfo.navBarBodyHeight) || 44
    })
    this.initLocationAndPackages()
  },

  onShow() {
    if (!this._hasLoadedOnce) {
      return
    }

    const previousLocationKey = this._currentLocationKey
    const location = this.syncCurrentLocationFromStore()

    if (buildLocationKey(location) !== previousLocationKey) {
      this.loadPackageList({ page: 1, showLoading: false })
    }
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) {
      return
    }

    this.loadPackageList({
      page: this.data.page + 1,
      showLoading: false
    })
  },

  async onPullDownRefresh() {
    await this.loadPackageList({
      page: 1,
      showLoading: false
    })
    wx.stopPullDownRefresh()
  },

  async initLocationAndPackages() {
    const location = this.syncCurrentLocationFromStore()

    if (!location || location.source === 'default') {
      await this.tryGetLocation({
        applyToSelected: !location || location.source !== 'manual'
      })
    }

    await this.loadBannerList()
    await this.loadPackageList({
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

    this._currentLocationKey = buildLocationKey(nextLocation)
    this.setData({
      locationText: formatHomeLocationText(nextLocation)
    })

    return nextLocation
  },

  async loadBannerList() {
    const app = getApp()
    const currentLocation = app.getCurrentLocation() || DEFAULT_LOCATION
    const city = (currentLocation && currentLocation.city) || ''

    try {
      const bannerList = await fetchHomeBannerList({ city })
      if (Array.isArray(bannerList) && bannerList.length) {
        this.setData({
          bannerList,
          activeBannerIndex: 0
        })
        return
      }
    } catch (error) {
      console.warn('[home] loadBannerList fallback to local banners', error)
    }

    this.setData({
      bannerList: HOME_BANNERS,
      activeBannerIndex: 0
    })
  },

  tryGetLocation({ applyToSelected = false } = {}) {
    return new Promise(resolve => {
      let settled = false
      const finishWithLocation = (location, { denied = false, tip = '', toast = '' } = {}) => {
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

        const currentLocation = app.getCurrentLocation() || normalizedLocation
        this._currentLocationKey = buildLocationKey(currentLocation)
        this.setData({
          locationText: formatHomeLocationText(currentLocation),
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
          tip: '定位超时，已按默认区域展示课程。',
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

          const fallbackFeedback = buildLocationFallbackFeedback(location)
          finishWithLocation(location, fallbackFeedback)
        },
        fail: error => {
          const denied = /auth deny|auth denied|authorize no response|permission/i.test(error.errMsg || '')
          finishWithLocation(DEFAULT_LOCATION, {
            denied,
            tip: denied ? '定位未授权，已按默认区域展示课程，可点击顶部定位栏手动选择。' : '定位失败，已按默认区域展示课程。',
            toast: denied ? '未开启定位，已按默认位置展示' : '定位失败，已切换默认位置'
          })
        }
      })
    })
  },

  async loadPackageList({ page = 1, showLoading = true } = {}) {
    this.setData({
      loading: true,
      initialLoading: page === 1 ? showLoading : this.data.initialLoading
    })

    try {
      const app = getApp()
      const currentLocation = app.getCurrentLocation() || DEFAULT_LOCATION
      const activeTabMeta = this.data.tabs.find(item => item.key === this.data.activeTab) || this.data.tabs[0]
      const response = await fetchPackageList({
        page,
        pageSize: this.data.pageSize,
        category: activeTabMeta && activeTabMeta.category ? activeTabMeta.category : '',
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
      })
      const nextPageList = page === 1 ? response.list : this.data.packageList.concat(response.list)
      const filteredList = filterPackageListByTab(nextPageList, this.data.activeTab).map(buildPackageCard)

      this.setData({
        packageList: filteredList,
        page,
        hasMore: response.hasMore,
        initialLoading: false
      })
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

  handleTabChange(event) {
    const key = (event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.key) || ''
    if (!key || key === this.data.activeTab) {
      return
    }

    this.setData({
      activeTab: key,
      page: 1,
      hasMore: true
    })

    this.loadPackageList({
      page: 1,
      showLoading: false
    })
  },

  async handleLocationTap() {
    wx.navigateTo({
      url: `/pages/location-search/index?city=${encodeURIComponent(DEFAULT_LOCATION.city || '深圳')}`
    })
  },

  handleManualLocationTip() {
    if (!this.data.locationDenied) {
      this.handleLocationTap()
      return
    }

    wx.getSetting({
      success: res => {
        const authSetting = (res && res.authSetting) || {}
        if (authSetting['scope.userLocation']) {
          this.tryGetLocation({
            applyToSelected: true
          }).then(() => {
            this.loadPackageList({
              page: 1,
              showLoading: false
            })
          })
          return
        }

        wx.openSetting({
          success: openRes => {
            const nextAuthSetting = (openRes && openRes.authSetting) || {}
            if (nextAuthSetting['scope.userLocation']) {
              this.tryGetLocation({
                applyToSelected: true
              }).then(() => {
                this.loadPackageList({
                  page: 1,
                  showLoading: false
                })
              })
              return
            }

            this.handleLocationTap()
          },
          fail: () => {
            this.handleLocationTap()
          }
        })
      },
      fail: () => {
        this.handleLocationTap()
      }
    })
  },

  handleCourseCoverError(event) {
    const { id } = event.currentTarget.dataset
    if (!id) {
      return
    }

    this.setData({
      packageList: this.data.packageList.map(item =>
        item.id === id
          ? {
              ...item,
              coverLoadFailed: true
            }
          : item
      )
    })
  },

  handleCourseTap(event) {
    const { id } = event.currentTarget.dataset
    if (!id) {
      return
    }

    wx.navigateTo({
      url: `/pages/course/detail/index?id=${id}`
    })
  },

  handleBannerChange(event) {
    const current = Number(event.detail && event.detail.current)
    this.setData({
      activeBannerIndex: Number.isFinite(current) ? current : 0
    })
  },

  handleBannerTap(event) {
    const { index } = event.currentTarget.dataset
    const banner = this.data.bannerList[index]

    if (!banner) {
      return
    }

    if (banner.jumpType === 'packageDetail' && banner.jumpTarget) {
      wx.navigateTo({
        url: `/pages/course/detail/index?id=${encodeURIComponent(banner.jumpTarget)}`
      })
      return
    }

    if (banner.jumpType === 'miniprogramPage' && banner.jumpTarget) {
      if (/^\/pages\/home\/index(?:\?|$)/.test(banner.jumpTarget)) {
        wx.switchTab({
          url: '/pages/home/index'
        })
        return
      }

      if (/^\/pages\/mine\/index(?:\?|$)/.test(banner.jumpTarget)) {
        wx.switchTab({
          url: '/pages/mine/index'
        })
        return
      }

      wx.navigateTo({
        url: banner.jumpTarget
      })
      return
    }

    if (banner.jumpType === 'customUrl' && banner.jumpTarget) {
      wx.showToast({
        title: '当前版本暂不支持打开外部链接',
        icon: 'none'
      })
    }
  },

  onShareAppMessage() {
    return {
      title: HOME_SHARE_TITLE,
      path: '/pages/home/index'
    }
  },

  onShareTimeline() {
    return {
      title: HOME_SHARE_TITLE
    }
  }
})
