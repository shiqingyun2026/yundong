Page({
  data: {
    userInfo: null,
    showLoginSheet: false,
    pendingLoginAction: '',
    menuList: [
      {
        key: 'group-buy',
        title: '我的拼团'
      },
      {
        key: 'agreements',
        title: '用户协议和隐私政策'
      }
    ]
  },

  onShow() {
    const app = getApp()
    if (!this.data.showLoginSheet) {
      this.showTabBar()
    }
    this.setData({
      userInfo: app.globalData.userInfo || wx.getStorageSync('userInfo') || null
    })
  },

  onUnload() {
    this.showTabBar()
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

  async handleProfileTap() {
    if (!this.data.userInfo) {
      this.openLoginSheet()
    }
  },

  handleMenuTap(event) {
    const { key } = event.currentTarget.dataset
    if (key === 'group-buy') {
      if (!this.data.userInfo) {
        this.openLoginSheet('group-buy')
        return
      }

      this.openGroupBuyList()
      return
    }

    if (key === 'agreements') {
      wx.navigateTo({
        url: '/pages/agreement-list/index'
      })
    }
  },

  openLoginSheet(action = '') {
    this.hideTabBar()
    this.setData({
      showLoginSheet: true,
      pendingLoginAction: action
    })
  },

  handleCloseLoginSheet() {
    this.showTabBar()
    this.setData({
      showLoginSheet: false,
      pendingLoginAction: ''
    })
  },

  handleLoginSheetSuccess(event) {
    const app = getApp()
    const result = event.detail && event.detail.result
    const userInfo =
      (result && result.userInfo) ||
      app.globalData.userInfo ||
      wx.getStorageSync('userInfo') ||
      null
    const pendingLoginAction = this.data.pendingLoginAction

    this.showTabBar()

    this.setData({
      userInfo,
      showLoginSheet: false,
      pendingLoginAction: ''
    })

    if (pendingLoginAction === 'group-buy') {
      this.openGroupBuyList()
      return
    }

    wx.showToast({
      title: '登录成功',
      icon: 'success'
    })
  },

  openGroupBuyList() {
    wx.navigateTo({
      url: '/pages/my/group-buy-list/index'
    })
  },

  handleLogout() {
    const app = getApp()
    app.setUserInfo(null)
    app.setToken('')

    this.showTabBar()

    this.setData({
      userInfo: null,
      showLoginSheet: false,
      pendingLoginAction: ''
    })

    wx.showToast({
      title: '已退出登录',
      icon: 'success'
    })
  },

  handleContact(event) {
    if (event && event.detail) {
      console.log('[mine] contact event', event.detail)
    }
  }
})
