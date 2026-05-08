const {
  START_HOUR_OPTIONS,
  calculatePackageMemberAmountFen,
  closePaymentOrder,
  createPackageStartOrder,
  fetchPaymentStatus,
  fetchPackageDetail,
  formatDisplayAmount,
  mockPaymentSuccess,
  preparePayment
} = require('../../../utils/package')
const { loginAndStoreSession } = require('../../../utils/auth')

const START_PAGE_WEEKDAY_LABELS = {
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '天'
}

const weekdayOptions = Object.keys(START_PAGE_WEEKDAY_LABELS).map(key => ({
  value: Number(key),
  label: START_PAGE_WEEKDAY_LABELS[key]
}))

const hourOptions = START_HOUR_OPTIONS.map(hour => ({
  value: hour,
  label: `${hour}`.padStart(2, '0') + ':00'
}))

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

const waitForPaymentConfirmation = async ({ orderId, fallbackPackageGroupId = '' }) => {
  let latestStatus = null

  for (let index = 0; index < 6; index += 1) {
    if (index > 0) {
      await new Promise(resolve => setTimeout(resolve, 1500))
    }

    latestStatus = await fetchPaymentStatus({ orderId })

    if (latestStatus && latestStatus.orderStatus === 'success') {
      return {
        confirmed: true,
        packageGroupId: latestStatus.packageGroupId || fallbackPackageGroupId
      }
    }

    if (latestStatus && ['closed', 'refunded'].includes(latestStatus.orderStatus)) {
      return {
        confirmed: false,
        terminal: true,
        packageGroupId: latestStatus.packageGroupId || fallbackPackageGroupId
      }
    }
  }

  return {
    confirmed: false,
    terminal: false,
    packageGroupId: (latestStatus && latestStatus.packageGroupId) || fallbackPackageGroupId
  }
}

Page({
  data: {
    packageId: '',
    packageDetail: null,
    loading: true,
    submitting: false,
    agreementChecked: true,
    weekdayOptions,
    hourOptions,
    selectedTargetCount: 0,
    selectedWeekday: 6,
    selectedHour: 10,
    selectedWeekdayIndex: 5,
    selectedHourIndex: 1,
    memberAmountText: '0.00',
    memberAmountDisplayText: '0',
    childNickname: '',
    childAge: '',
    parentMobile: ''
  },

  async onLoad(options) {
    const packageId = options.packageId || ''
    const selectedTargetCount = Number(options.targetCount) || 0
    const selectedWeekday = Number(options.weekday) || 6
    const selectedHour = Number(options.hour) || 10
    const selectedWeekdayIndex = Math.max(0, weekdayOptions.findIndex(item => item.value === selectedWeekday))
    const selectedHourIndex = Math.max(0, hourOptions.findIndex(item => item.value === selectedHour))
    this.setData({
      packageId,
      selectedTargetCount,
      selectedWeekday,
      selectedHour,
      selectedWeekdayIndex,
      selectedHourIndex,
      childNickname: decodeURIComponent(options.childNickname || ''),
      childAge: decodeURIComponent(options.childAge || ''),
      parentMobile: decodeURIComponent(options.parentMobile || '')
    })
    await this.loadPackageDetail(packageId)
  },

  async loadPackageDetail(packageId) {
    if (!packageId) {
      wx.showToast({
        title: '课程信息不存在',
        icon: 'none'
      })
      return
    }

    this.setData({
      loading: true
    })

    try {
      const packageDetail = await fetchPackageDetail(packageId)
      const preferredTargetCount = packageDetail.supportedPeople.includes(4)
        ? 4
        : (packageDetail.supportedPeople[0] || 2)
      const defaultTargetCount = this.data.selectedTargetCount || preferredTargetCount

      this.setData({
        packageDetail,
        selectedTargetCount: defaultTargetCount
      })
      this.updateAmountPreview(packageDetail, defaultTargetCount)
    } catch (error) {
      wx.showToast({
        title: '开团信息加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({
        loading: false
      })
    }
  },

  updateAmountPreview(packageDetail, targetCount) {
    const amountFen = calculatePackageMemberAmountFen({
      totalPriceFen: packageDetail ? Number(packageDetail.totalPriceFen) || 0 : 0,
      targetCount,
      groupPriceConfig: packageDetail ? packageDetail.groupPriceConfig || [] : []
    })

    this.setData({
      memberAmountText: (amountFen / 100).toFixed(2),
      memberAmountDisplayText: formatDisplayAmount((amountFen / 100).toFixed(2))
    })
  },

  handleTargetSelect(event) {
    const { value } = event.currentTarget.dataset
    const selectedTargetCount = Number(value) || 0

    this.setData({
      selectedTargetCount
    })
    this.updateAmountPreview(this.data.packageDetail, selectedTargetCount)
  },

  handleWeekdayChange(event) {
    const selectedWeekdayIndex = Number(event.detail.value) || 0
    const option = this.data.weekdayOptions[selectedWeekdayIndex] || this.data.weekdayOptions[0]

    this.setData({
      selectedWeekdayIndex,
      selectedWeekday: option.value
    })
  },

  handleHourChange(event) {
    const selectedHourIndex = Number(event.detail.value) || 0
    const option = this.data.hourOptions[selectedHourIndex] || this.data.hourOptions[0]

    this.setData({
      selectedHourIndex,
      selectedHour: option.value
    })
  },

  handleAgreementToggle() {
    this.setData({
      agreementChecked: !this.data.agreementChecked
    })
  },

  handleChildNicknameInput(event) {
    this.setData({
      childNickname: `${event.detail.value || ''}`.trimStart()
    })
  },

  handleChildAgeInput(event) {
    const nextValue = `${event.detail.value || ''}`.replace(/[^\d]/g, '')
    this.setData({
      childAge: nextValue
    })
  },

  handleParentMobileInput(event) {
    const nextValue = `${event.detail.value || ''}`.replace(/[^\d]/g, '').slice(0, 11)
    this.setData({
      parentMobile: nextValue
    })
  },

  handleStudentInputConfirm() {
    wx.hideKeyboard()
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
      wx.showToast({
        title: (error && error.message) || '登录失败，请稍后再试',
        icon: 'none'
      })
      return false
    }
  },

  async handleSubmit() {
    if (!this.data.agreementChecked) {
      wx.showToast({
        title: '请先同意课程服务协议',
        icon: 'none'
      })
      return
    }

    if (!this.data.selectedTargetCount) {
      wx.showToast({
        title: '请选择拼团人数',
        icon: 'none'
      })
      return
    }

    if (!`${this.data.childNickname || ''}`.trim()) {
      wx.showToast({
        title: '请填写学生昵称',
        icon: 'none'
      })
      return
    }

    if (!/^\d+$/.test(`${this.data.childAge || ''}`)) {
      wx.showToast({
        title: '请填写学生年龄',
        icon: 'none'
      })
      return
    }

    if (!/^1\d{10}$/.test(`${this.data.parentMobile || ''}`)) {
      wx.showToast({
        title: '请填写正确的家长手机号',
        icon: 'none'
      })
      return
    }

    if (!(await this.ensureLogin())) {
      return
    }

    if (this.data.submitting) {
      return
    }

    this.setData({
      submitting: true
    })

    try {
      const order = await createPackageStartOrder({
        packageId: this.data.packageId,
        targetCount: this.data.selectedTargetCount,
        weekday: this.data.selectedWeekday,
        hour: this.data.selectedHour,
        childNickname: this.data.childNickname.trim(),
        childAge: this.data.childAge,
        parentMobile: this.data.parentMobile
      })
      const orderId = order.orderId || ''

      if (!orderId) {
        throw new Error('订单创建失败')
      }
      this._lastOrderId = orderId

      let nextPackageGroupId = order.packageGroupId || ''
      const paymentPreparation = await preparePayment({
        orderId
      })

      if (paymentPreparation && paymentPreparation.canUseRequestPayment) {
        await invokeWechatPayment(paymentPreparation.paymentParams || {})
        wx.showLoading({
          title: '确认支付中',
          mask: true
        })
        const confirmation = await waitForPaymentConfirmation({
          orderId,
          fallbackPackageGroupId: nextPackageGroupId
        })
        wx.hideLoading()
        nextPackageGroupId = confirmation.packageGroupId || nextPackageGroupId

        if (!confirmation.confirmed) {
          wx.redirectTo({
            url:
              `/pages/payment/result/index?status=processing` +
              `&packageId=${this.data.packageId}` +
              `&packageGroupId=${encodeURIComponent(nextPackageGroupId)}` +
              `&action=start` +
              `&targetCount=${this.data.selectedTargetCount}` +
              `&weekday=${this.data.selectedWeekday}` +
              `&hour=${this.data.selectedHour}` +
              `&childNickname=${encodeURIComponent(this.data.childNickname.trim())}` +
              `&childAge=${encodeURIComponent(this.data.childAge)}` +
              `&parentMobile=${encodeURIComponent(this.data.parentMobile)}`
          })
          return
        }
      } else {
        if (paymentPreparation && paymentPreparation.paymentMode === 'wechat') {
          throw new Error('支付暂不可用，请稍后重试')
        }

        const paymentResult = await mockPaymentSuccess({
          orderId
        })
        nextPackageGroupId = (paymentResult && paymentResult.packageGroupId) || nextPackageGroupId
      }

      wx.redirectTo({
        url:
          `/pages/group/detail/index?packageGroupId=${encodeURIComponent(nextPackageGroupId)}` +
          `&entry=paymentSuccess` +
          `&successType=start` +
          `&action=start` +
          `&packageId=${this.data.packageId}`
      })
    } catch (error) {
      const message = `${error && (error.errMsg || error.message || '')}`.toLowerCase()
      wx.hideLoading()

      if (message.includes('cancel')) {
        if (this._lastOrderId) {
          try {
            await closePaymentOrder({
              orderId: this._lastOrderId
            })
          } catch (closeError) {
            console.warn('[package/start] close canceled order failed', closeError)
          }
        }

        wx.showToast({
          title: '已取消支付',
          icon: 'none'
        })
        wx.redirectTo({
          url:
            `/pages/payment/result/index?status=cancel` +
            `&packageId=${this.data.packageId}` +
            `&action=start` +
            `&targetCount=${this.data.selectedTargetCount}` +
            `&weekday=${this.data.selectedWeekday}` +
            `&hour=${this.data.selectedHour}` +
            `&childNickname=${encodeURIComponent(this.data.childNickname.trim())}` +
            `&childAge=${encodeURIComponent(this.data.childAge)}` +
            `&parentMobile=${encodeURIComponent(this.data.parentMobile)}`
        })
      } else {
        wx.redirectTo({
          url:
            `/pages/payment/result/index?status=fail` +
            `&packageId=${this.data.packageId}` +
            `&action=start` +
            `&targetCount=${this.data.selectedTargetCount}` +
            `&weekday=${this.data.selectedWeekday}` +
            `&hour=${this.data.selectedHour}` +
            `&childNickname=${encodeURIComponent(this.data.childNickname.trim())}` +
            `&childAge=${encodeURIComponent(this.data.childAge)}` +
            `&parentMobile=${encodeURIComponent(this.data.parentMobile)}`
        })
      }
    } finally {
      this.setData({
        submitting: false
      })
    }
  }
})
