const { getAgreementPageContent } = require('../../utils/agreement')
const REJECT_DIALOG_BUTTONS = [
  {
    text: '取消',
    extClass: 'dialog-button-cancel'
  },
  {
    text: '确认',
    extClass: 'dialog-button-confirm'
  }
]

Page({
  data: {
    tabs: [
      { key: 'user', label: '用户协议' },
      { key: 'privacy', label: '隐私政策' }
    ],
    activeTab: 'user',
    agreed: false,
    readonly: false,
    showRejectModal: false,
    rejectDialogButtons: REJECT_DIALOG_BUTTONS,
    userAgreementNodes: [],
    privacyPolicyNodes: []
  },

  onLoad(options) {
    const activeTab = options && (options.tab === 'privacy' ? 'privacy' : 'user')
    const readonly = !!(options && options.readonly === '1')

    const { userAgreementNodes, privacyPolicyNodes } = getAgreementPageContent()

    this.setData({
      activeTab,
      readonly,
      userAgreementNodes,
      privacyPolicyNodes
    })

    const app = getApp()

    if (!readonly && app.hasAgreedAgreement()) {
      wx.switchTab({
        url: '/pages/home/index'
      })
    }
  },

  handleTabChange(event) {
    const tab = (event.detail && event.detail.key) || (event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.tab)
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
    this.setData({
      showRejectModal: true
    })
  },

  handleCloseRejectModal() {
    this.setData({
      showRejectModal: false
    })
  },

  handleRejectDialogTap(event) {
    const { index } = event.detail || {}

    if (index === 0) {
      this.handleCloseRejectModal()
      return
    }

    this.handleConfirmReject()
  },

  handleConfirmReject() {
    this.setData({
      showRejectModal: false
    })

    if (typeof wx.exitMiniProgram === 'function') {
      wx.exitMiniProgram()
    }
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
