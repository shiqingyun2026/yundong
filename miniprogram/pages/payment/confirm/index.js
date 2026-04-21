const {
  calculatePackageMemberAmountFen,
  createPackageJoinOrder,
  createPackageStartOrder,
  fetchPackageDetail,
  fetchPackageGroupDetail,
  mockPaymentSuccess,
  preparePayment
} = require('../../../utils/package')
const { loginAndStoreSession } = require('../../../utils/auth')

const invokeWechatPayment = paymentParams =>
  new Promise((resolve, reject) => {
    if (!wx.requestPayment) {
      reject(new Error('当前微信版本不支持支付能力'))
      return
    }

    wx.requestPayment({
      ...(paymentParams || {}),
      success(result) {
        resolve(result || {})
      },
      fail(error) {
        reject(error)
      }
    })
  })

Page({
  data: {
    action: 'start',
    packageId: '',
    packageGroupId: '',
    orderId: '',
    targetCount: 0,
    weekday: 6,
    hour: 10,
    childNickname: '',
    childAge: '',
    packageDetail: null,
    packageGroupDetail: null,
    paymentAmountText: '0.00',
    paymentAmountButtonText: '0元',
    agreementChecked: true,
    loading: true,
    paying: false
  },

  async onLoad(options) {
    this._isAlive = true
    this.setData({
      action: options.action || 'start',
      packageId: options.packageId || '',
      packageGroupId: options.packageGroupId || '',
      orderId: options.orderId || '',
      targetCount: Number(options.targetCount) || 0,
      weekday: Number(options.weekday) || 6,
      hour: Number(options.hour) || 10,
      childNickname: decodeURIComponent(options.childNickname || ''),
      childAge: decodeURIComponent(options.childAge || '')
    })

    wx.setNavigationBarTitle({
      title: this.data.action === 'join' ? '参与拼团' : '确认支付'
    })

    await this.ensureLogin()
    await this.loadPageData()
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

  async loadPageData() {
    this.safeSetData({
      loading: true
    })

    try {
      const tasks = [fetchPackageDetail(this.data.packageId)]

      if (this.data.packageGroupId) {
        tasks.push(fetchPackageGroupDetail(this.data.packageGroupId))
      }

      const [packageDetail, packageGroupDetail] = await Promise.all(tasks)
      const nextTargetCount = this.data.action === 'join' && packageGroupDetail ? packageGroupDetail.targetCount : this.data.targetCount
      const amountFen =
        this.data.action === 'join' && packageGroupDetail
          ? packageGroupDetail.memberAmountFen
          : calculatePackageMemberAmountFen({
              totalPriceFen: Number(packageDetail.totalPriceFen) || 0,
              targetCount: nextTargetCount,
              groupPriceConfig: packageDetail.groupPriceConfig || []
            })

      this.safeSetData({
        packageDetail,
        packageGroupDetail: packageGroupDetail || null,
        targetCount: nextTargetCount,
        paymentAmountText: (amountFen / 100).toFixed(2),
        paymentAmountButtonText: `${(amountFen / 100).toFixed(2)}元`
      })
    } catch (error) {
      wx.showToast({
        title: '支付信息加载失败',
        icon: 'none'
      })
    } finally {
      this.safeSetData({
        loading: false
      })
    }
  },

  handleAgreementChange(event) {
    const values = event.detail.value || []
    this.safeSetData({
      agreementChecked: values.includes('agree')
    })
  },

  handleChildNicknameInput(event) {
    this.safeSetData({
      childNickname: `${event.detail.value || ''}`.trimStart()
    })
  },

  handleChildAgeInput(event) {
    const nextValue = `${event.detail.value || ''}`.replace(/[^\d]/g, '')
    this.safeSetData({
      childAge: nextValue
    })
  },

  handleOpenAgreement() {
    wx.navigateTo({
      url: '/pages/service-agreement/index'
    })
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

  async createOrderIfNeeded() {
    if (this.data.orderId) {
      return {
        orderId: this.data.orderId,
        packageGroupId: this.data.packageGroupId
      }
    }

    if (this.data.action === 'join') {
      if (!`${this.data.childNickname || ''}`.trim()) {
        throw new Error('请填写孩子昵称')
      }

      if (!/^\d+$/.test(`${this.data.childAge || ''}`)) {
        throw new Error('请填写孩子年龄')
      }

      return createPackageJoinOrder({
        packageId: this.data.packageId,
        packageGroupId: this.data.packageGroupId,
        childNickname: this.data.childNickname.trim(),
        childAge: this.data.childAge
      })
    }

    return createPackageStartOrder({
      packageId: this.data.packageId,
      targetCount: this.data.targetCount,
      weekday: this.data.weekday,
      hour: this.data.hour,
      childNickname: this.data.childNickname,
      childAge: this.data.childAge
    })
  },

  async handleConfirmPay() {
    if (!this.data.agreementChecked) {
      wx.showToast({
        title: '请先同意课程服务协议',
        icon: 'none'
      })
      return
    }

    if (this.data.paying) {
      return
    }

    if (!(await this.ensureLogin())) {
      wx.showToast({
        title: '请先完成登录',
        icon: 'none'
      })
      return
    }

    this.safeSetData({
      paying: true
    })

    try {
      const order = await this.createOrderIfNeeded()
      const orderId = order.orderId || ''

      if (!orderId) {
        throw new Error('订单创建失败')
      }

      const paymentPreparation = await preparePayment({
        orderId
      })
      let nextPackageGroupId = this.data.packageGroupId || order.packageGroupId || ''

      if (paymentPreparation && paymentPreparation.canUseRequestPayment) {
        await invokeWechatPayment(paymentPreparation.paymentParams || {})
      } else {
        const paymentResult = await mockPaymentSuccess({
          orderId
        })
        nextPackageGroupId = (paymentResult && paymentResult.packageGroupId) || nextPackageGroupId
      }

      wx.redirectTo({
        url:
          `/pages/payment/result/index?status=success` +
          `&packageId=${this.data.packageId}` +
          `&packageGroupId=${encodeURIComponent(nextPackageGroupId)}`
      })
    } catch (error) {
      const message = `${error && (error.errMsg || error.message || '')}`.toLowerCase()

      if (message.includes('cancel')) {
        wx.showToast({
          title: '已取消支付',
          icon: 'none'
        })
      } else {
        wx.showToast({
          title: (error && error.message) || '支付失败，请稍后重试',
          icon: 'none'
        })
      }
    } finally {
      this.safeSetData({
        paying: false
      })
    }
  },

  handleMockFail() {
    wx.redirectTo({
      url:
        `/pages/payment/result/index?status=fail` +
        `&packageId=${this.data.packageId}` +
        `&packageGroupId=${encodeURIComponent(this.data.packageGroupId || '')}` +
        `&action=${this.data.action}` +
        `&targetCount=${this.data.targetCount}` +
        `&weekday=${this.data.weekday}` +
        `&hour=${this.data.hour}`
    })
  }
})
