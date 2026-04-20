const {
  START_HOUR_OPTIONS,
  WEEKDAY_LABELS,
  fetchPackageDetail
} = require('../../../utils/package')
const { loginAndStoreSession } = require('../../../utils/auth')

const weekdayOptions = Object.keys(WEEKDAY_LABELS).map(key => ({
  value: Number(key),
  label: WEEKDAY_LABELS[key]
}))

const hourOptions = START_HOUR_OPTIONS.map(hour => ({
  value: hour,
  label: `${hour}`.padStart(2, '0') + ':00'
}))

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
    memberAmountText: '0.00'
  },

  async onLoad(options) {
    const packageId = options.packageId || ''
    this.setData({
      packageId
    })
    await this.loadPackageDetail(packageId)
  },

  async loadPackageDetail(packageId) {
    if (!packageId) {
      wx.showToast({
        title: '课包信息不存在',
        icon: 'none'
      })
      return
    }

    this.setData({
      loading: true
    })

    try {
      const packageDetail = await fetchPackageDetail(packageId)
      const defaultTargetCount = packageDetail.supportedPeople[0] || 2

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
    const totalPriceFen = packageDetail ? Number(packageDetail.totalPriceFen) || 0 : 0
    const amountFen = targetCount > 0 ? Math.floor(totalPriceFen / targetCount) : 0

    this.setData({
      memberAmountText: (amountFen / 100).toFixed(2)
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

  handleAgreementChange(event) {
    const values = event.detail.value || []
    this.setData({
      agreementChecked: values.includes('agree')
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
        title: '请选择目标人数',
        icon: 'none'
      })
      return
    }

    if (!(await this.ensureLogin())) {
      return
    }

    wx.navigateTo({
      url:
        `/pages/payment/confirm/index?action=start` +
        `&packageId=${this.data.packageId}` +
        `&targetCount=${this.data.selectedTargetCount}` +
        `&weekday=${this.data.selectedWeekday}` +
        `&hour=${this.data.selectedHour}`
    })
  }
})
