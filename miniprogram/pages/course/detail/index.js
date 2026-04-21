const { fetchPackageDetail } = require('../../../utils/package')

const SERVICE_DIALOG_BUTTONS = [
  {
    text: '关闭'
  }
]

Page({
  data: {
    packageId: '',
    packageDetail: null,
    loading: true,
    showServiceModal: false,
    showLoginSheet: false,
    pendingLoginAction: null,
    serviceDialogButtons: SERVICE_DIALOG_BUTTONS
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
      return
    }

    this.setData({
      loading: true
    })

    try {
      const packageDetail = await fetchPackageDetail(packageId)

      this.setData({
        packageDetail
      })
    } catch (error) {
      wx.showToast({
        title: '课程详情加载失败',
        icon: 'none'
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

  handleServiceDialogTap() {
    this.handleCloseService()
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
    if (!wx.getStorageSync('token')) {
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
    const { groupId } = event.currentTarget.dataset
    if (!groupId) {
      return
    }

    if (!wx.getStorageSync('token')) {
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
      title: packageDetail ? `邀请你一起拼「${packageDetail.name}」` : '邻动体适能课程拼团',
      path: `/pages/course/detail/index?id=${packageId}`,
      imageUrl: packageDetail && packageDetail.cover ? packageDetail.cover : ''
    }
  }
})
