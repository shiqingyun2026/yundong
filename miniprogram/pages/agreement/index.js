const { userAgreementNodes, privacyPolicyNodes } = require('../../utils/agreement')

Page({
  data: {
    activeTab: 'user',
    agreed: false,
    readonly: false,
    userAgreementNodes,
    privacyPolicyNodes
  },

  onLoad(options) {
    const activeTab = options && (options.tab === 'privacy' ? 'privacy' : 'user')
    const readonly = !!(options && options.readonly === '1')

    this.setData({
      activeTab,
      readonly
    })

    const app = getApp()

    if (!readonly && app.hasAgreedAgreement()) {
      wx.switchTab({
        url: '/pages/home/index'
      })
    }
  },

  handleTabChange(event) {
    const { tab } = event.currentTarget.dataset
    if (!tab || tab === this.data.activeTab) {
      return
    }

    this.setData({
      activeTab: tab
    })
  },

  handleAgreementChange(event) {
    const agreedValues = event.detail.value || []
    this.setData({
      agreed: agreedValues.includes('agreed')
    })
  },

  handleRejectTap() {
    wx.showModal({
      title: '提示',
      content: '您需要同意协议才能使用本小程序',
      confirmText: '确认',
      cancelText: '取消',
      success: result => {
        if (!result.confirm) {
          return
        }

        if (typeof wx.exitMiniProgram === 'function') {
          wx.exitMiniProgram()
        }
      }
    })
  },

  handleAgree() {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先勾选已阅读并同意',
        icon: 'none'
      })
      return
    }

    const app = getApp()
    app.setAgreementAccepted(true)

    wx.switchTab({
      url: '/pages/home/index'
    })
  }
})
