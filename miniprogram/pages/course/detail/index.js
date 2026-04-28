const { fetchPackageDetail } = require('../../../utils/package')

const HOME_PAGE_PATH = '/pages/home/index'

Page({
  data: {
    packageId: '',
    packageDetail: null,
    heroImages: [],
    heroCurrent: 0,
    loading: true,
    showServiceModal: false,
    showLoginSheet: false,
    pendingLoginAction: null
  },

  isPhoneBound() {
    const app = getApp()
    const userInfo = (app && app.globalData && app.globalData.userInfo) || wx.getStorageSync('userInfo') || {}
    return /^1\d{10}$/.test(`${userInfo.phone || ''}`)
  },

  async onLoad(options) {
    const packageId = options.id || ''
    this.setData({
      packageId
    })
    await this.loadPageData(packageId)
  },

  async onShow() {
    if (!this.data.showLoginSheet) {
      this.showTabBar()
    }

    if (!this.data.packageId) {
      return
    }

    await this.loadPageData(this.data.packageId)
  },

  onUnload() {
    this.showTabBar()
  },

  async loadPageData(packageId) {
    if (!packageId) {
      wx.showToast({
        title: '课程信息不存在',
        icon: 'none'
      })
      wx.switchTab({
        url: HOME_PAGE_PATH
      })
      return
    }

    this.setData({
      loading: true
    })

    try {
      const packageDetail = await fetchPackageDetail(packageId)
      const heroImages = (packageDetail.images || []).map((url, index) => ({
        id: `hero-${index}`,
        url,
        loadFailed: false
      }))

      this.setData({
        packageDetail,
        heroImages,
        heroCurrent: 0
      })
    } catch (error) {
      wx.showToast({
        title: error && error.message ? error.message : '课程详情加载失败',
        icon: 'none'
      })
      wx.switchTab({
        url: HOME_PAGE_PATH
      })
    } finally {
      this.setData({
        loading: false
      })
    }
  },

  handlePreviewCertificate(event) {
    const { url } = event.currentTarget.dataset
    const { packageDetail } = this.data

    if (!url || !packageDetail || !packageDetail.coachCertificates.length) {
      return
    }

    wx.previewImage({
      current: url,
      urls: packageDetail.coachCertificates
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

  noop() {},

  handleHeroImageError(event) {
    const { index } = event.currentTarget.dataset
    const targetIndex = Number(index)
    if (!Number.isInteger(targetIndex) || targetIndex < 0) {
      return
    }

    this.setData({
      heroImages: this.data.heroImages.map((item, idx) =>
        idx === targetIndex
          ? {
              ...item,
              loadFailed: true
            }
          : item
      )
    })
  },

  handleHeroSwiperChange(event) {
    const current = Number(event.detail && event.detail.current)
    this.setData({
      heroCurrent: Number.isInteger(current) && current >= 0 ? current : 0
    })
  },

  showTabBar() {
    wx.showTabBar({
      animation: false
    })
  },

  hideTabBar() {
    wx.hideTabBar({
      animation: false
    })
  },

  openLoginSheet(action) {
    this.hideTabBar()
    this.setData({
      showLoginSheet: true,
      pendingLoginAction: action || null
    })
  },

  handleCloseLoginSheet() {
    this.showTabBar()
    this.setData({
      showLoginSheet: false,
      pendingLoginAction: null
    })
  },

  handleLoginSheetSuccess() {
    const pendingLoginAction = this.data.pendingLoginAction

    this.showTabBar()

    this.setData({
      showLoginSheet: false,
      pendingLoginAction: null
    })

    this.continuePendingLoginAction(pendingLoginAction)
  },

  continuePendingLoginAction(action) {
    if (!action || !action.type) {
      return
    }

    if (action.type === 'start-group') {
      wx.navigateTo({
        url: `/pages/package/start/index?packageId=${this.data.packageId}`
      })
      return
    }

    if (action.type === 'join-group' && action.groupId) {
      wx.navigateTo({
        url: `/pages/payment/confirm/index?action=join&packageId=${this.data.packageId}&packageGroupId=${action.groupId}`
      })
    }
  },

  handleStartGroup() {
    if (!this.isPhoneBound()) {
      this.openLoginSheet({
        type: 'start-group'
      })
      return
    }

    this.continuePendingLoginAction({
      type: 'start-group'
    })
  },

  handleJoinGroup(event) {
    const { groupId, canJoin } = event.currentTarget.dataset
    if (!groupId || canJoin === false) {
      return
    }

    if (!this.isPhoneBound()) {
      this.openLoginSheet({
        type: 'join-group',
        groupId
      })
      return
    }

    this.continuePendingLoginAction({
      type: 'join-group',
      groupId
    })
  },

  onShareAppMessage() {
    const { packageDetail, packageId } = this.data

    return {
      title: packageDetail ? `${packageDetail.name}｜家门口组团上课` : '家门口的少儿运动团课',
      path: `/pages/course/detail/index?id=${packageId}`,
      imageUrl: packageDetail && packageDetail.cover ? packageDetail.cover : ''
    }
  },

  onShareTimeline() {
    const { packageDetail, packageId } = this.data

    return {
      title: packageDetail ? `${packageDetail.name}｜家门口组团上课` : '家门口的少儿运动团课',
      query: `id=${packageId}`,
      imageUrl: packageDetail && packageDetail.cover ? packageDetail.cover : ''
    }
  }
})
