const { fetchPackageGroupDetail } = require('../../../utils/package')
const { loginAndStoreSession } = require('../../../utils/auth')

const STATUS_MAP = {
  active: {
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

Page({
  data: {
    packageGroupId: '',
    loading: true,
    groupDetail: null,
    statusText: '',
    statusClassName: '',
    bottomStatusText: '拼团失败，已退款'
  },

  async onLoad(options) {
    this._isAlive = true
    this.setData({
      packageGroupId: options.packageGroupId || options.groupId || ''
    })

    await this.ensureLogin()
    await this.loadGroupDetail(this.data.packageGroupId)
  },

  async onShow() {
    if (!this.data.packageGroupId) {
      return
    }

    await this.loadGroupDetail(this.data.packageGroupId)
  },

  onUnload() {
    this._isAlive = false
  },

  safeSetData(payload) {
    if (!this._isAlive) {
      return
    }

    this.setData(payload)
  },

  async ensureLogin() {
    if (wx.getStorageSync('token')) {
      return true
    }

    try {
      await loginAndStoreSession()
      return true
    } catch (error) {
      return false
    }
  },

  updateGroupPresentation(groupDetail) {
    const statusInfo = STATUS_MAP[groupDetail.status] || STATUS_MAP.active

    this.safeSetData({
      groupDetail,
      statusText: statusInfo.text,
      statusClassName: statusInfo.className,
      bottomStatusText:
        groupDetail.status === 'success'
          ? '已成团，等待上课'
          : groupDetail.status === 'failed'
            ? '拼团失败，已退款'
            : '邀请好友一起参团'
    })
  },

  async loadGroupDetail(packageGroupId) {
    if (!packageGroupId) {
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
      const groupDetail = await fetchPackageGroupDetail(packageGroupId)
      this.updateGroupPresentation(groupDetail)
    } catch (error) {
      wx.showToast({
        title: (error && error.message) || '拼团详情加载失败',
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
        title: '邻动体适能课包拼团',
        path: '/pages/home/index'
      }
    }

    return {
      title: `邀请你加入「${groupDetail.packageInfo.name}」拼团`,
      path: `/pages/group/detail/index?packageGroupId=${groupDetail.id}`,
      imageUrl: ''
    }
  },

  handleJoinGroup() {
    const { groupDetail } = this.data
    if (!groupDetail || groupDetail.status !== 'active') {
      return
    }

    wx.navigateTo({
      url: `/pages/payment/confirm/index?action=join&packageId=${groupDetail.packageInfo.id}&packageGroupId=${groupDetail.id}`
    })
  }
})
