const { loginWithWechat } = require('../../utils/auth')

const SERVICE_QR_CODE = 'https://dummyimage.com/240x240/f3f8ff/1677ff.png&text=%E5%AE%A2%E6%9C%8D%E4%BA%8C%E7%BB%B4%E7%A0%81'

Page({
  data: {
    userInfo: null,
    loginLoading: false,
    showLoginModal: false,
    loginAgreementChecked: false,
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
    serviceQrCode: SERVICE_QR_CODE
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

  hideTabBar() {
    wx.hideTabBar({
      animation: false
    })
  },

  showTabBar() {
    wx.showTabBar({
      animation: false
    })
  },

  handleProfileTap() {
    if (!this.data.userInfo) {
      this.handleLogin()
    }
  },

  handleMenuTap(event) {
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

  handleLogin() {
    if (this.data.loginLoading) {
      return
    }

    this.setData({
      showLoginModal: true,
      loginAgreementChecked: false
    })
    this.hideTabBar()
  },

  handleCloseLoginModal() {
    if (this.data.loginLoading) {
      return
    }

    this.setData({
      showLoginModal: false
    })
    this.showTabBar()
  },

  handleOpenAgreement() {
    wx.navigateTo({
      url: '/pages/agreement-content/index?key=user'
    })
  },

  handleOpenPrivacy() {
    wx.navigateTo({
      url: '/pages/agreement-content/index?key=privacy'
    })
  },

  handleToggleLoginAgreement() {
    this.setData({
      loginAgreementChecked: !this.data.loginAgreementChecked
    })
  },

  async handleConfirmLogin() {
    if (this.data.loginLoading) {
      return
    }

    if (!this.data.loginAgreementChecked) {
      wx.showToast({
        title: '请先阅读并勾选用户协议',
        icon: 'none'
      })
      return
    }

    this.setData({
      loginLoading: true
    })

    try {
      const result = await loginWithWechat()
      const app = getApp()

      app.setUserInfo(result.userInfo)
      app.setToken(result.token)

      this.setData({
        userInfo: result.userInfo,
        showLoginModal: false
      })
      this.showTabBar()

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      })
    } catch (error) {
      const message = error && error.message ? error.message : '登录未完成，请稍后再试'

      wx.showToast({
        title: message,
        icon: 'none'
      })
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
      userInfo: null
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

  handleConfirmService() {
    this.setData({
      showServiceModal: false
    })
  }
})
