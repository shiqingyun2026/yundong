const {
  calculatePackageMemberAmountFen,
  closePaymentOrder,
  createPackageJoinOrder,
  createPackageStartOrder,
  fetchPaymentStatus,
  fetchPackageDetail,
  fetchPackageGroupDetail,
  formatDisplayAmount,
  buildPackageGroupShareTitle,
  mockPaymentSuccess,
  preparePayment,
  resolveShareImageUrl
} = require('../../../utils/package')
const { ensureSilentLogin } = require('../../../utils/auth')

const WEEKDAY_LABELS = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日'
}

const addMinutesToTimeText = (timeText, durationMinutes) => {
  const normalized = `${timeText || ''}`.trim()
  const matched = normalized.match(/^(\d{2}):(\d{2})$/)
  const minutesToAdd = Math.max(0, Number(durationMinutes) || 0)

  if (!matched || !minutesToAdd) {
    return normalized
  }

  const totalMinutes = Number(matched[1]) * 60 + Number(matched[2]) + minutesToAdd
  const hour = Math.floor(totalMinutes / 60) % 24
  const minute = totalMinutes % 60
  return `${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`
}

const formatPaymentScheduleDisplayText = ({ classTime, fallbackText = '', durationMinutes = 90 }) => {
  const source = `${classTime || fallbackText || ''}`.trim()
  const matched = source.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})(?::\d{2})?/)
  if (!matched) {
    return fallbackText || source
  }

  const date = new Date(`${matched[1]}T12:00:00`)
  const weekday = WEEKDAY_LABELS[date.getDay() === 0 ? 7 : date.getDay()] || ''
  const startTime = `${matched[2]}:${matched[3]}`
  const endTime = addMinutesToTimeText(startTime, durationMinutes)
  return `${matched[1]} ${weekday}${startTime} - ${endTime}`
}

const buildPaymentScheduleList = ({ packageGroupDetail, packageDetail }) => {
  const durationMinutes = Number(packageDetail && packageDetail.classDurationMinutes) || 90
  return (packageGroupDetail && Array.isArray(packageGroupDetail.scheduleList) ? packageGroupDetail.scheduleList : []).map((item, index) => ({
    ...item,
    index: Number(item && item.index) || index + 1,
    displayText: formatPaymentScheduleDisplayText({
      classTime: item && (item.class_time || item.classTime),
      fallbackText: item && (item.display_text || item.displayText),
      durationMinutes
    })
  }))
}

const buildJoinScheduleSummaryText = packageGroupDetail => {
  const detail = packageGroupDetail || null
  if (!detail) {
    return ''
  }

  const hasScheduleList = Array.isArray(detail.scheduleList) && detail.scheduleList.length > 0
  const classCount = Number(detail.packageInfo && detail.packageInfo.classCount) || (hasScheduleList ? detail.scheduleList.length : 0)
  if (classCount > 1 && hasScheduleList) {
    return `${classCount}节课，详见课表`
  }

  return detail.firstClassTimeText || detail.scheduleDisplayText || detail.scheduleText || ''
}

const buildGroupTypeText = ({ packageDetail, packageGroupDetail, targetCount }) => {
  const detailMinSuccessCount = Number(packageGroupDetail && packageGroupDetail.minSuccessCount) || 0
  const detailTargetCount = Number(packageGroupDetail && packageGroupDetail.targetCount) || 0
  const finalTargetCount = detailTargetCount || Number(targetCount) || 0
  const matchedConfig = packageDetail && Array.isArray(packageDetail.groupPriceConfig)
    ? packageDetail.groupPriceConfig.find(item => Number(item.targetCount) === finalTargetCount)
    : null
  const minSuccessCount = detailMinSuccessCount || Number(matchedConfig && matchedConfig.minSuccessCount) || finalTargetCount

  if (minSuccessCount <= 1 && finalTargetCount <= 1) {
    return '1对1私教'
  }

  return minSuccessCount && finalTargetCount && minSuccessCount !== finalTargetCount
    ? `${minSuccessCount}～${finalTargetCount}人团`
    : `${finalTargetCount}人团`
}

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
    action: 'start',
    packageId: '',
    packageGroupId: '',
    orderId: '',
    targetCount: 0,
    scheduleType: '',
    scheduleDate: '',
    scheduleDays: '[]',
    scheduleTime: '',
    childNickname: '',
    childAge: '',
    parentMobile: '',
    packageDetail: null,
    packageGroupDetail: null,
    paymentScheduleList: [],
    joinScheduleSummaryText: '',
    groupTypeText: '',
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
      scheduleType: decodeURIComponent(options.scheduleType || ''),
      scheduleDate: decodeURIComponent(options.scheduleDate || ''),
      scheduleDays: decodeURIComponent(options.scheduleDays || '[]'),
      scheduleTime: decodeURIComponent(options.scheduleTime || ''),
      childNickname: decodeURIComponent(options.childNickname || ''),
      childAge: decodeURIComponent(options.childAge || ''),
      parentMobile: decodeURIComponent(options.parentMobile || '')
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
        paymentScheduleList: buildPaymentScheduleList({
          packageGroupDetail,
          packageDetail
        }),
        joinScheduleSummaryText: buildJoinScheduleSummaryText(packageGroupDetail),
        groupTypeText: buildGroupTypeText({
          packageDetail,
          packageGroupDetail,
          targetCount: nextTargetCount
        }),
        targetCount: nextTargetCount,
        paymentAmountText: (amountFen / 100).toFixed(2),
        paymentAmountButtonText: `${formatDisplayAmount((amountFen / 100).toFixed(2))}元`
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

  handleAgreementToggle() {
    this.safeSetData({
      agreementChecked: !this.data.agreementChecked
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

  handleParentMobileInput(event) {
    const nextValue = `${event.detail.value || ''}`.replace(/[^\d]/g, '').slice(0, 11)
    this.safeSetData({
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
    try {
      await ensureSilentLogin()
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
        throw new Error('请填写学生昵称')
      }

      if (!/^\d+$/.test(`${this.data.childAge || ''}`)) {
        throw new Error('请填写学生年龄')
      }

      if (!/^1\d{10}$/.test(`${this.data.parentMobile || ''}`)) {
        throw new Error('请填写正确的家长手机号')
      }

      return createPackageJoinOrder({
        packageId: this.data.packageId,
        packageGroupId: this.data.packageGroupId,
        childNickname: this.data.childNickname.trim(),
        childAge: this.data.childAge,
        parentMobile: this.data.parentMobile
      })
    }

    if (!`${this.data.childNickname || ''}`.trim()) {
      throw new Error('请填写学生昵称')
    }

    if (!/^\d+$/.test(`${this.data.childAge || ''}`)) {
      throw new Error('请填写学生年龄')
    }

    if (!/^1\d{10}$/.test(`${this.data.parentMobile || ''}`)) {
      throw new Error('请填写正确的家长手机号')
    }

    return createPackageStartOrder({
      packageId: this.data.packageId,
      targetCount: this.data.targetCount,
      scheduleType: this.data.scheduleType,
      scheduleDate: this.data.scheduleDate,
      scheduleDays: (() => {
        try {
          return JSON.parse(this.data.scheduleDays || '[]')
        } catch (error) {
          return []
        }
      })(),
      scheduleTime: this.data.scheduleTime,
      childNickname: this.data.childNickname.trim(),
      childAge: this.data.childAge,
      parentMobile: this.data.parentMobile
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
      this._lastOrderId = orderId

      let nextPackageGroupId = this.data.packageGroupId || order.packageGroupId || ''
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
              `&action=${this.data.action}` +
              `&targetCount=${this.data.targetCount}` +
              `&scheduleType=${encodeURIComponent(this.data.scheduleType)}` +
              `&scheduleDate=${encodeURIComponent(this.data.scheduleDate)}` +
              `&scheduleDays=${encodeURIComponent(this.data.scheduleDays)}` +
              `&scheduleTime=${encodeURIComponent(this.data.scheduleTime)}` +
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
          `&successType=${this.data.action === 'join' ? 'join' : 'start'}` +
          `&action=${this.data.action}` +
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
            console.warn('[payment] close canceled order failed', closeError)
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
            `&packageGroupId=${encodeURIComponent(this.data.packageGroupId || '')}` +
            `&action=${this.data.action}` +
            `&targetCount=${this.data.targetCount}` +
            `&scheduleType=${encodeURIComponent(this.data.scheduleType)}` +
            `&scheduleDate=${encodeURIComponent(this.data.scheduleDate)}` +
            `&scheduleDays=${encodeURIComponent(this.data.scheduleDays)}` +
            `&scheduleTime=${encodeURIComponent(this.data.scheduleTime)}` +
            `&childNickname=${encodeURIComponent(this.data.childNickname.trim())}` +
            `&childAge=${encodeURIComponent(this.data.childAge)}` +
            `&parentMobile=${encodeURIComponent(this.data.parentMobile)}`
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

  onShareAppMessage() {
    const { action, packageId, packageDetail, packageGroupDetail, packageGroupId } = this.data
    const currentGroupId = (packageGroupDetail && packageGroupDetail.id) || packageGroupId || ''

    if (action !== 'join' || !currentGroupId) {
      return {
        title: packageDetail ? `${packageDetail.name}｜家门口组团上课` : '家门口的少儿运动团课',
        path: packageDetail ? `/pages/course/detail/index?id=${packageId}` : '/pages/home/index',
        imageUrl: resolveShareImageUrl(packageDetail && packageDetail.wechatShareCover)
      }
    }

    const packageName = (packageDetail && packageDetail.name) || '邻动体适能课程'

    return {
      title: buildPackageGroupShareTitle({
        minSuccessCount: packageGroupDetail && packageGroupDetail.minSuccessCount,
        targetCount: packageGroupDetail && packageGroupDetail.targetCount,
        currentCount: packageGroupDetail && packageGroupDetail.currentCount,
        packageName
      }),
      path:
        `/pages/group/detail/index?packageGroupId=${encodeURIComponent(currentGroupId)}` +
        `&packageId=${encodeURIComponent(packageId || '')}` +
        `&entry=share&action=join`,
      imageUrl: resolveShareImageUrl(packageDetail && packageDetail.wechatShareCover)
    }
  }
})
