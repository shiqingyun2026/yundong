const { ensurePhoneIdentity } = require('../../utils/auth')

const HIDE_DURATION = 300

Component({
  options: {
    addGlobalClass: true,
    styleIsolation: 'shared'
  },

  properties: {
    show: {
      type: Boolean,
      value: false,
      observer: '_showChange'
    },
    maskClosable: {
      type: Boolean,
      value: true
    }
  },

  data: {
    wrapperShow: false,
    innerShow: false,
    agreed: false,
    loginLoading: false
  },

  lifetimes: {
    detached() {
      if (this._hideTimer) {
        clearTimeout(this._hideTimer)
        this._hideTimer = null
      }
    }
  },

  methods: {
    _showChange(show) {
      if (this._hideTimer) {
        clearTimeout(this._hideTimer)
        this._hideTimer = null
      }

      if (show) {
        this.setData({
          wrapperShow: true,
          innerShow: true,
          agreed: false,
          loginLoading: false
        })
        return
      }

      this.setData({
        innerShow: false,
        loginLoading: false
      })

      this._hideTimer = setTimeout(() => {
        this._hideTimer = null
        this.setData({
          wrapperShow: false
        })
      }, HIDE_DURATION)
    },

    noop() {},

    toggleAgreement() {
      if (this.data.loginLoading) {
        return
      }

      this.setData({
        agreed: !this.data.agreed
      })
    },

    handleMaskTap() {
      if (!this.data.maskClosable || this.data.loginLoading) {
        return
      }

      this.triggerEvent('close', {
        reason: 'mask'
      })
    },

    handleLaterTap() {
      if (this.data.loginLoading) {
        return
      }

      this.triggerEvent('close', {
        reason: 'later'
      })
    },

    handleOpenAgreement(event) {
      const { key } = event.currentTarget.dataset

      if (!key) {
        return
      }

      wx.navigateTo({
        url: `/pages/agreement-content/index?key=${key}`
      })
    },

    handlePhoneVerifyTap() {
      if (this.data.loginLoading) {
        return
      }

      if (!this.data.agreed) {
        wx.showToast({
          title: '请先阅读并勾选用户协议',
          icon: 'none'
        })
      }
    },

    async handleGetPhoneNumber(event) {
      if (this.data.loginLoading) {
        return
      }

      this.setData({
        loginLoading: true
      })

      try {
        const detail = (event && event.detail) || {}
        const phoneCode = detail.code
        const errMsg = `${detail.errMsg || ''}`

        if (!phoneCode || /fail|deny|cancel/i.test(errMsg)) {
          throw new Error('你已取消手机号授权')
        }

        const result = await ensurePhoneIdentity(phoneCode)

        this.triggerEvent('success', {
          result
        })
      } catch (error) {
        wx.showToast({
          title: (error && error.message) || '登录失败，请稍后再试',
          icon: 'none'
        })
      } finally {
        this.setData({
          loginLoading: false
        })
      }
    }
  }
})
