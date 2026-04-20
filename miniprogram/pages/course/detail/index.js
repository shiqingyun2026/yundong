const { fetchPackageDetail } = require('../../../utils/package')
const { loginAndStoreSession } = require('../../../utils/auth')

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
    loginLoading: false,
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
    if (!this.data.packageId) {
      return
    }

    await this.loadPageData(this.data.packageId)
  },

  async loadPageData(packageId) {
    if (!packageId) {
      wx.showToast({
        title: '课包信息不存在',
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
        title: '课包详情加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({
        loading: false
      })
    }
  },

  async ensureLogin() {
    const token = wx.getStorageSync('token')
    if (token) {
      return true
    }

    if (this.data.loginLoading) {
      return false
    }

    this.setData({
      loginLoading: true
    })

    try {
      await loginAndStoreSession()
      return true
    } catch (error) {
      wx.showToast({
        title: (error && error.message) || '登录失败，请稍后再试',
        icon: 'none'
      })
      return false
    } finally {
      this.setData({
        loginLoading: false
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

  async handleStartGroup() {
    if (!(await this.ensureLogin())) {
      return
    }

    wx.navigateTo({
      url: `/pages/package/start/index?packageId=${this.data.packageId}`
    })
  },

  async handleJoinGroup(event) {
    const { groupId } = event.currentTarget.dataset
    if (!groupId) {
      return
    }

    if (!(await this.ensureLogin())) {
      return
    }

    wx.navigateTo({
      url: `/pages/payment/confirm/index?action=join&packageId=${this.data.packageId}&packageGroupId=${groupId}`
    })
  },

  onShareAppMessage() {
    const { packageDetail, packageId } = this.data

    return {
      title: packageDetail ? `邀请你一起拼「${packageDetail.name}」` : '邻动体适能课包拼团',
      path: `/pages/course/detail/index?id=${packageId}`,
      imageUrl: packageDetail && packageDetail.cover ? packageDetail.cover : ''
    }
  }
})
