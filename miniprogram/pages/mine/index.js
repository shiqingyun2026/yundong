const { loginAndStoreSession } = require('../../utils/auth')

const SERVICE_QR_CODE = 'https://dummyimage.com/240x240/e8f8f9/1abcc5.png&text=%E5%AE%A2%E6%9C%8D%E4%BA%8C%E7%BB%B4%E7%A0%81'
const SERVICE_DIALOG_BUTTONS = [
  {
    text: '关闭'
  }
]

Page({
  data: {
    userInfo: null,
    loginLoading: false,
    showServiceModal: false,
    menuList: [
      {
        key: 'group-buy',
        title: '我的拼团'
      },
      {
        key: 'agreements',
        title: '用户协议和隐私政策'
      },
      {
        key: 'service',
        title: '联系客服'
      }
    ],
    serviceQrCode: SERVICE_QR_CODE,
    serviceDialogButtons: SERVICE_DIALOG_BUTTONS
  },

  onShow() {
    const app = getApp()
    this.showTabBar()
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

  async handleProfileTap() {
    if (!this.data.userInfo) {
      await this.handleLogin()
    }
  },

  async handleMenuTap(event) {
    const { key } = event.currentTarget.dataset
    if (key === 'group-buy') {
      if (!this.data.userInfo) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        })
        return
      }

      wx.navigateTo({
        url: '/pages/my/group-buy-list/index'
      })
      return
    }

    if (key === 'service') {
      this.setData({
        showServiceModal: true
      })
      return
    }

    if (key === 'agreements') {
      wx.navigateTo({
        url: '/pages/agreement-list/index'
      })
    }
  },

  async handleLogin() {
    if (this.data.loginLoading) {
      return false
    }

    this.setData({
      loginLoading: true
    })

    try {
      const result = await loginAndStoreSession()

      this.setData({
        userInfo: result.userInfo
      })

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      })
      return true
    } catch (error) {
      const message = error && error.message ? error.message : '登录未完成，请稍后再试'

      wx.showToast({
        title: message,
        icon: 'none'
      })
      return false
    } finally {
      this.setData({
        loginLoading: false
      })
    }
  },

  handleLogout() {
    const app = getApp()
    app.setUserInfo(null)
    app.setToken('')

    this.setData({
      userInfo: null,
      loginLoading: false
    })

    wx.showToast({
      title: '已退出登录',
      icon: 'success'
    })
  },

  handleCloseService() {
    this.setData({
      showServiceModal: false
    })
  },

  handleServiceDialogTap() {
    this.handleCloseService()
  }
})
