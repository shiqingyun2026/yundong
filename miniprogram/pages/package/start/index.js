const {
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
const {
  buildMinScheduleDate,
  buildSchedulePreview,
  getAllowedScheduleTypeOptions,
  parseScheduleTypeValue,
  resolveScheduleTypeValue,
  SCHEDULE_TYPES,
  START_TIME_OPTIONS,
  WEEKDAY_OPTIONS
} = require('../../../utils/packageSchedule')

const timeOptions = START_TIME_OPTIONS.map(value => ({
  value,
  label: value
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

const encodeScheduleDays = value => encodeURIComponent(JSON.stringify(Array.isArray(value) ? value : []))

const decodeScheduleDays = value => {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value))
    return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : []
  } catch (error) {
    return []
  }
}

Page({
  data: {
    packageId: '',
    packageDetail: null,
    loading: true,
    submitting: false,
    agreementChecked: true,
    weekdayOptions: WEEKDAY_OPTIONS,
    timeOptions,
    scheduleTypeOptions: [],
    selectedTargetCount: 0,
    classCount: 1,
    minScheduleDate: '',
    selectedScheduleTypeValue: SCHEDULE_TYPES.SINGLE,
    selectedScheduleDate: '',
    selectedScheduleDays: [],
    selectedScheduleTime: START_TIME_OPTIONS[0],
    selectedTimeIndex: 0,
    memberAmountText: '0.00',
    memberAmountDisplayText: '0',
    childNickname: '',
    childAge: '',
    parentMobile: '',
    schedulePreviewList: []
  },

  async onLoad(options) {
    const packageId = options.packageId || ''
    const selectedTargetCount = Number(options.targetCount) || 0
    const selectedScheduleTypeValue = `${options.scheduleType || ''}`.trim() || SCHEDULE_TYPES.SINGLE
    const selectedScheduleDate = `${options.scheduleDate || options.classDate || ''}`.trim()
    const selectedScheduleDays = decodeScheduleDays(options.scheduleDays)
    const selectedScheduleTime = `${options.scheduleTime || (options.hour ? `${`${options.hour}`.padStart(2, '0')}:00` : '') || START_TIME_OPTIONS[0]}`.trim()
    const selectedTimeIndex = Math.max(0, timeOptions.findIndex(item => item.value === selectedScheduleTime))

    this.setData({
      packageId,
      selectedTargetCount,
      selectedScheduleTypeValue,
      selectedScheduleDate,
      selectedScheduleDays,
      selectedScheduleTime,
      selectedTimeIndex,
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
        : packageDetail.supportedPeople[0] || 2
      const defaultTargetCount = this.data.selectedTargetCount || preferredTargetCount
      const classCount = Math.max(1, Number(packageDetail.classCount) || 1)
      const minScheduleDate = buildMinScheduleDate(new Date())
      const scheduleTypeOptions = getAllowedScheduleTypeOptions(classCount)
      const defaultScheduleTypeValue =
        classCount === 1
          ? SCHEDULE_TYPES.SINGLE
          : this.data.selectedScheduleTypeValue && scheduleTypeOptions.some(item => item.value === this.data.selectedScheduleTypeValue)
            ? this.data.selectedScheduleTypeValue
            : resolveScheduleTypeValue({
                classCount,
                scheduleType: classCount >= 2 ? SCHEDULE_TYPES.DAILY : SCHEDULE_TYPES.SINGLE,
                weeklyTimes: 1
              })
      const selectedScheduleDate = this.data.selectedScheduleDate || minScheduleDate
      const { scheduleType, weeklyTimes } = parseScheduleTypeValue(defaultScheduleTypeValue)
      const selectedScheduleDays =
        scheduleType === SCHEDULE_TYPES.WEEKLY
          ? this.normalizeSelectedScheduleDays(this.data.selectedScheduleDays, weeklyTimes)
          : []

      this.setData({
        packageDetail,
        classCount,
        selectedTargetCount: defaultTargetCount,
        minScheduleDate,
        scheduleTypeOptions,
        selectedScheduleTypeValue: defaultScheduleTypeValue,
        selectedScheduleDate,
        selectedScheduleDays
      })
      this.updateAmountPreview(packageDetail, defaultTargetCount)
      this.updateSchedulePreview()
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

  normalizeSelectedScheduleDays(days, requiredCount) {
    const normalized = [...new Set((Array.isArray(days) ? days : []).map(Number).filter(Boolean))].sort((left, right) => left - right)
    if (normalized.length === requiredCount) {
      return normalized
    }
    return WEEKDAY_OPTIONS.slice(0, requiredCount).map(item => item.value)
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

  updateSchedulePreview() {
    const schedulePreviewList = buildSchedulePreview({
      classCount: this.data.classCount,
      scheduleTypeValue: this.data.selectedScheduleTypeValue,
      scheduleDate: this.data.selectedScheduleDate,
      scheduleDays: this.data.selectedScheduleDays,
      scheduleTime: this.data.selectedScheduleTime
    })

    this.setData({
      schedulePreviewList
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

  handleScheduleTypeSelect(event) {
    const { value } = event.currentTarget.dataset
    const selectedScheduleTypeValue = `${value || ''}`.trim()
    const { scheduleType, weeklyTimes } = parseScheduleTypeValue(selectedScheduleTypeValue)

    this.setData({
      selectedScheduleTypeValue,
      selectedScheduleDays: scheduleType === SCHEDULE_TYPES.WEEKLY ? this.normalizeSelectedScheduleDays([], weeklyTimes) : []
    })
    this.updateSchedulePreview()
  },

  handleScheduleDateChange(event) {
    const nextValue = `${event.detail.value || ''}`.trim()
    this.setData({
      selectedScheduleDate: nextValue || this.data.minScheduleDate
    })
    this.updateSchedulePreview()
  },

  handleTimeChange(event) {
    const selectedTimeIndex = Number(event.detail.value) || 0
    const option = this.data.timeOptions[selectedTimeIndex] || this.data.timeOptions[0]

    this.setData({
      selectedTimeIndex,
      selectedScheduleTime: option.value
    })
    this.updateSchedulePreview()
  },

  handleScheduleDayToggle(event) {
    const day = Number(event.currentTarget.dataset.day) || 0
    const { weeklyTimes } = parseScheduleTypeValue(this.data.selectedScheduleTypeValue)
    if (!day || !weeklyTimes) {
      return
    }

    const selectedSet = new Set(this.data.selectedScheduleDays || [])
    if (selectedSet.has(day)) {
      selectedSet.delete(day)
    } else if (selectedSet.size < weeklyTimes) {
      selectedSet.add(day)
    } else {
      wx.showToast({
        title: `每周${weeklyTimes}次需选择${weeklyTimes}个星期`,
        icon: 'none'
      })
      return
    }

    this.setData({
      selectedScheduleDays: [...selectedSet].sort((left, right) => left - right)
    })
    this.updateSchedulePreview()
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

  validateScheduleSelection() {
    const { classCount, selectedScheduleTypeValue, selectedScheduleDate, selectedScheduleDays, selectedScheduleTime } = this.data
    const { scheduleType, weeklyTimes } = parseScheduleTypeValue(selectedScheduleTypeValue)

    if (!selectedScheduleTime) {
      return '请选择上课时间'
    }

    if (classCount === 1) {
      if (!selectedScheduleDate) {
        return '请选择上课日期'
      }
      return ''
    }

    if (scheduleType === SCHEDULE_TYPES.DAILY) {
      if (!selectedScheduleDate) {
        return '请选择开始上课日期'
      }
      return ''
    }

    if (scheduleType === SCHEDULE_TYPES.WEEKLY) {
      if ((selectedScheduleDays || []).length !== weeklyTimes) {
        return `每周${weeklyTimes}次需选择${weeklyTimes}个不同星期`
      }
      return ''
    }

    return '请选择上课频率'
  },

  buildSchedulePayload() {
    const { classCount, selectedScheduleTypeValue, selectedScheduleDate, selectedScheduleDays, selectedScheduleTime, minScheduleDate } = this.data
    const { scheduleType } = parseScheduleTypeValue(selectedScheduleTypeValue)

    if (classCount === 1) {
      return {
        scheduleType: SCHEDULE_TYPES.SINGLE,
        scheduleDate: selectedScheduleDate,
        scheduleDays: [],
        scheduleTime: selectedScheduleTime
      }
    }

    if (scheduleType === SCHEDULE_TYPES.DAILY) {
      return {
        scheduleType: SCHEDULE_TYPES.DAILY,
        scheduleDate: selectedScheduleDate,
        scheduleDays: [],
        scheduleTime: selectedScheduleTime
      }
    }

    return {
      scheduleType: SCHEDULE_TYPES.WEEKLY,
      scheduleDate: minScheduleDate,
      scheduleDays: this.data.selectedScheduleDays,
      scheduleTime: selectedScheduleTime
    }
  },

  buildResultUrl({ status, packageGroupId = '' }) {
    const schedulePayload = this.buildSchedulePayload()
    return (
      `/pages/payment/result/index?status=${status}` +
      `&packageId=${this.data.packageId}` +
      `&packageGroupId=${encodeURIComponent(packageGroupId)}` +
      `&action=start` +
      `&targetCount=${this.data.selectedTargetCount}` +
      `&scheduleType=${encodeURIComponent(resolveScheduleTypeValue({ classCount: this.data.classCount, scheduleType: schedulePayload.scheduleType, weeklyTimes: schedulePayload.scheduleDays.length || 1 }))}` +
      `&scheduleDate=${encodeURIComponent(schedulePayload.scheduleDate || '')}` +
      `&scheduleDays=${encodeScheduleDays(schedulePayload.scheduleDays)}` +
      `&scheduleTime=${encodeURIComponent(schedulePayload.scheduleTime || '')}` +
      `&childNickname=${encodeURIComponent(this.data.childNickname.trim())}` +
      `&childAge=${encodeURIComponent(this.data.childAge)}` +
      `&parentMobile=${encodeURIComponent(this.data.parentMobile)}`
    )
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

    const scheduleError = this.validateScheduleSelection()
    if (scheduleError) {
      wx.showToast({
        title: scheduleError,
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

    if (!(await this.ensureLogin()) || this.data.submitting) {
      return
    }

    this.setData({
      submitting: true
    })

    try {
      const schedulePayload = this.buildSchedulePayload()
      const order = await createPackageStartOrder({
        packageId: this.data.packageId,
        targetCount: this.data.selectedTargetCount,
        scheduleType: schedulePayload.scheduleType,
        scheduleDate: schedulePayload.scheduleDate,
        scheduleDays: schedulePayload.scheduleDays,
        scheduleTime: schedulePayload.scheduleTime,
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
            url: this.buildResultUrl({
              status: 'processing',
              packageGroupId: nextPackageGroupId
            })
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
          url: this.buildResultUrl({
            status: 'cancel'
          })
        })
      } else {
        wx.redirectTo({
          url: this.buildResultUrl({
            status: 'fail'
          })
        })
      }
    } finally {
      this.setData({
        submitting: false
      })
    }
  }
})
