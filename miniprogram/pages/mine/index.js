const { loginWithUserProfile, authDebugConfig } = require('../../utils/auth')

const SERVICE_QR_CODE = 'https://dummyimage.com/240x240/f3f8ff/1677ff.png&text=%E5%AE%A2%E6%9C%8D%E4%BA%8C%E7%BB%B4%E7%A0%81'

Page({
  data: {
    userInfo: null,
    loginLoading: false,
    showServiceModal: false,
    menuList: [
      {
        key: 'group-buy',
        title: '我的拼团',
        desc: '查看进行中、已成团、已失败的拼团记录'
      },
      {
        key: 'agreements',
        title: '用户协议和隐私政策',
        desc: '查看用户协议与隐私政策占位内容'
      },
      {
        key: 'service',
        title: '联系客服',
        desc: '查看客服二维码并获取帮助'
      }
    ],
    serviceQrCode: SERVICE_QR_CODE
  },

  onShow() {
    const app = getApp()
    this.setData({
      userInfo: app.globalData.userInfo || wx.getStorageSync('userInfo') || null
    })
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

  async handleLogin() {
    if (this.data.loginLoading) {
      return
    }

    this.setData({
      loginLoading: true
    })

    try {
      const result = await loginWithUserProfile()
      const app = getApp()

      app.setUserInfo(result.userInfo)
      app.setToken(result.token)

      this.setData({
        userInfo: result.userInfo
      })

      wx.showToast({
        title:
          authDebugConfig.USE_MOCK_USER && !result.mock
            ? `登录成功(${authDebugConfig.MOCK_OPEN_ID || 'mock'})`
            : result.mock
              ? '已登录，当前为 mock 模式'
              : '登录成功',
        icon: 'success'
      })
    } catch (error) {
      const message =
        error && /cancel|deny|auth deny/i.test(error.errMsg || '')
          ? '你已取消微信授权，可稍后再登录'
          : '登录未完成，请稍后再试'

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
