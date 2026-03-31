const {
  DEFAULT_CITY,
  DEFAULT_LOCATION,
  normalizeLocation,
  resolveLocationDetails,
  searchLocationPOI
} = require('../../utils/location')

const SEARCH_DEBOUNCE_MS = 300
const RESULT_ICON_CLASS = ['blue', 'blue', 'warm', 'violet', 'blue', 'green']
const RESULT_ICON_SRC = {
  blue: '/assets/ant-icons/environment-blue.svg',
  warm: '/assets/ant-icons/environment-orange.svg',
  violet: '/assets/ant-icons/environment-violet.svg',
  green: '/assets/ant-icons/environment-green.svg'
}

const formatDistance = distance => {
  const value = Number(distance)
  if (!Number.isFinite(value) || value <= 0) {
    return ''
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}km`
  }

  return `${Math.round(value)}m`
}

Page({
  data: {
    city: DEFAULT_CITY,
    keyword: '',
    gpsLocation: null,
    currentLocation: null,
    resultList: [],
    loading: false,
    searchState: 'idle',
    statusBarHeight: 20
  },

  onLoad(options) {
    this._searchTimer = null
    const app = getApp()
    const systemInfo = app.globalData.systemInfo || {}
    const city = decodeURIComponent((options && options.city) || '') || this.resolveCurrentCity()

    this.setData({
      city,
      gpsLocation: app.globalData.gpsLocation || wx.getStorageSync('gpsLocation') || null,
      currentLocation: app.getCurrentLocation() || DEFAULT_LOCATION,
      statusBarHeight: systemInfo.statusBarHeight || 20
    })
  },

  onUnload() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer)
      this._searchTimer = null
    }
  },

  resolveCurrentCity() {
    const app = getApp()
    const selectedLocation = app.globalData.selectedLocation || wx.getStorageSync('selectedLocation')
    const gpsLocation = app.globalData.gpsLocation || wx.getStorageSync('gpsLocation')
    return (selectedLocation && selectedLocation.city) || (gpsLocation && gpsLocation.city) || DEFAULT_CITY
  },

  handleBack() {
    wx.navigateBack()
  },

  handleInput(event) {
    const keyword = `${event.detail.value || ''}`.trim()
    this.setData({
      keyword
    })

    if (this._searchTimer) {
      clearTimeout(this._searchTimer)
    }

    if (!keyword) {
      this.setData({
        resultList: [],
        searchState: 'idle',
        loading: false
      })
      return
    }

    this._searchTimer = setTimeout(() => {
      this.search(keyword)
    }, SEARCH_DEBOUNCE_MS)
  },

  handleClear() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer)
      this._searchTimer = null
    }

    this.setData({
      keyword: '',
      resultList: [],
      loading: false,
      searchState: 'idle'
    })
  },

  async search(keyword) {
    this.setData({
      loading: true,
      searchState: 'loading'
    })

    try {
      const resultList = await searchLocationPOI({
        keyword,
        city: this.data.city
      })

      this.setData({
        resultList: resultList.map((item, index) => ({
          ...item,
          distanceText: formatDistance(item.distance),
          iconClass: RESULT_ICON_CLASS[index % RESULT_ICON_CLASS.length],
          iconSrc: RESULT_ICON_SRC[RESULT_ICON_CLASS[index % RESULT_ICON_CLASS.length]]
        })),
        loading: false,
        searchState: resultList.length ? 'result' : 'empty'
      })
    } catch (error) {
      wx.showToast({
        title: '搜索失败，请稍后再试',
        icon: 'none'
      })
      this.setData({
        resultList: [],
        loading: false,
        searchState: 'empty'
      })
    }
  },

  applySelectedLocation(location) {
    const app = getApp()
    app.setSelectedLocation(location)
    wx.navigateBack()
  },

  handleSelectResult(event) {
    const index = Number(event.currentTarget.dataset.index)
    const target = this.data.resultList[index]
    if (!target) {
      return
    }

    this.applySelectedLocation({
      ...DEFAULT_LOCATION,
      ...target,
      source: 'manual'
    })
  },

  handleUseCurrentLocation() {
    const gpsLocation = this.data.gpsLocation
    if (!gpsLocation) {
      this.handleRefreshLocation()
      return
    }

    this.applySelectedLocation({
      ...gpsLocation,
      source: 'gps'
    })
  },

  async handleRefreshLocation() {
    try {
      wx.showLoading({
        title: '定位中',
        mask: true
      })

      const res = await new Promise((resolve, reject) => {
        wx.getLocation({
          type: 'gcj02',
          success: resolve,
          fail: reject
        })
      })

      const location = normalizeLocation(
        await resolveLocationDetails({
          latitude: res.latitude,
          longitude: res.longitude
        }),
        DEFAULT_LOCATION,
        'gps'
      )

      const app = getApp()
      app.setGpsLocation(location)
      this.setData({
        gpsLocation: location,
        currentLocation: location,
        city: location.city || this.data.city
      })

      this.applySelectedLocation(location)
    } catch (error) {
      wx.showToast({
        title: '定位失败，请稍后再试',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  }
})
