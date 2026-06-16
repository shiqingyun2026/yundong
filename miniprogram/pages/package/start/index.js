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

const formatSelectedWeekdaysText = days => {
  const labels = (Array.isArray(days) ? days : [])
    .map(day => WEEKDAY_OPTIONS.find(option => option.value === Number(day)))
    .filter(Boolean)
    .map(item => item.label)

  return labels.length ? labels.join('、') : '请选择'
}

const EMPTY_SCHEDULE_TEXT = '请选择'

const formatClassTimeValue = ({ date, time }) => (date && time ? `${date} ${time}:00` : '')

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

const buildTimeOptions = durationMinutes =>
  START_TIME_OPTIONS.map(value => ({
    value,
    label: `${value}—${addMinutesToTimeText(value, durationMinutes)}`
  }))

const formatDateText = date => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseDateText = dateText => {
  const matched = `${dateText || ''}`.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!matched) {
    return null
  }

  const nextDate = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]), 0, 0, 0, 0)
  return Number.isNaN(nextDate.getTime()) ? null : nextDate
}

const buildSelectableScheduleDates = ({ startDateText, totalDays = 45, currentDateText = '' }) => {
  const startDate = parseDateText(startDateText) || new Date()
  const normalizedCurrentDateText = `${currentDateText || ''}`.trim()
  const options = []

  for (let index = 0; index < totalDays; index += 1) {
    const optionDate = new Date(startDate)
    optionDate.setDate(startDate.getDate() + index)
    const value = formatDateText(optionDate)
    options.push({
      value,
      label: value
    })
  }

  if (normalizedCurrentDateText && !options.some(option => option.value === normalizedCurrentDateText)) {
    const currentDate = parseDateText(normalizedCurrentDateText)
    if (currentDate) {
      options.push({
        value: normalizedCurrentDateText,
        label: normalizedCurrentDateText
      })
      options.sort((left, right) => left.value.localeCompare(right.value))
    }
  }

  return options
}

const formatPreviewDisplayText = (classTime, endTimeText = '') => {
  const [datePart = '', timePart = ''] = `${classTime || ''}`.trim().split(' ')
  if (!datePart || !timePart) {
    return ''
  }

  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const weekday = WEEKDAY_OPTIONS.find(item => item.value === (date.getDay() === 0 ? 7 : date.getDay()))
  const startTimeText = `${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`
  const rangeText = endTimeText ? `${startTimeText}-${endTimeText}` : startTimeText
  return `${datePart} ${weekday ? weekday.label : ''} ${rangeText}`.trim()
}

const buildEditableScheduleList = (schedulePreviewList, classDurationMinutes) =>
  (Array.isArray(schedulePreviewList) ? schedulePreviewList : []).map((item, index) => {
    const classTime = `${item.classTime || ''}`.trim()
    const [scheduleDate = '', rawTime = ''] = classTime.split(' ')
    const scheduleTime = rawTime.slice(0, 5)
    const endTime = addMinutesToTimeText(scheduleTime, classDurationMinutes)

    return {
      index: Number(item.index) || index + 1,
      classTime,
      scheduleDate,
      scheduleTime,
      endTime,
      displayText: formatPreviewDisplayText(classTime, endTime)
    }
  })

const buildWeekdayOptionsState = days => {
  const selectedSet = new Set((Array.isArray(days) ? days : []).map(Number).filter(Boolean))
  return WEEKDAY_OPTIONS.map(option => ({
    ...option,
    active: selectedSet.has(option.value)
  }))
}

const buildScheduleUiState = ({
  selectedScheduleTypeValue,
  selectedScheduleDays,
  pendingScheduleDays
}) => {
  const { scheduleType, weeklyTimes } = parseScheduleTypeValue(selectedScheduleTypeValue)

  return {
    isWeeklySchedule: scheduleType === SCHEDULE_TYPES.WEEKLY,
    requiredScheduleDaysCount: scheduleType === SCHEDULE_TYPES.WEEKLY ? weeklyTimes : 0,
    weekdayOptions: buildWeekdayOptionsState(pendingScheduleDays),
    scheduleDaysDisplayText: formatSelectedWeekdaysText(selectedScheduleDays)
  }
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
    weekdayOptions: buildWeekdayOptionsState([]),
    timeOptions: buildTimeOptions(90),
    scheduleTypeOptions: [],
    selectedTargetCount: 0,
    classCount: 1,
    minScheduleDate: '',
    selectedScheduleTypeValue: SCHEDULE_TYPES.SINGLE,
    selectedScheduleDate: '',
    selectedScheduleDays: [],
    pendingScheduleDays: [],
    selectedScheduleTime: '',
    selectedScheduleTimeLabel: EMPTY_SCHEDULE_TEXT,
    selectedTimeIndex: -1,
    isWeeklySchedule: false,
    requiredScheduleDaysCount: 0,
    scheduleDaysDisplayText: '请选择',
    showScheduleDaysPopup: false,
    showScheduleItemEditor: false,
    editingScheduleItemIndex: -1,
    editingScheduleDateOptions: [],
    editingScheduleDateIndex: 0,
    editingScheduleItemDate: '',
    editingScheduleItemTime: START_TIME_OPTIONS[0],
    editingScheduleItemTimeIndex: 0,
    editingScheduleItemTimeLabel: buildTimeOptions(90)[0].label,
    editingScheduleItemEndTime: '',
    memberAmountText: '0.00',
    memberAmountDisplayText: '0',
    childNickname: '',
    childAge: '',
    parentMobile: '',
    schedulePreviewList: [],
    editableScheduleList: []
  },

  async onLoad(options) {
    const packageId = options.packageId || ''
    const selectedTargetCount = Number(options.targetCount) || 0
    const selectedScheduleTypeValue = `${options.scheduleType || ''}`.trim() || SCHEDULE_TYPES.SINGLE
    const selectedScheduleDate = `${options.scheduleDate || options.classDate || ''}`.trim()
    const selectedScheduleDays = decodeScheduleDays(options.scheduleDays)
    const selectedScheduleTime = `${options.scheduleTime || (options.hour ? `${`${options.hour}`.padStart(2, '0')}:00` : '') || ''}`.trim()
    const defaultTimeOptions = buildTimeOptions(90)
    const selectedTimeIndex = defaultTimeOptions.findIndex(item => item.value === selectedScheduleTime)
    const selectedTimeOption = selectedTimeIndex >= 0 ? defaultTimeOptions[selectedTimeIndex] : null

    this.setData({
      packageId,
      selectedTargetCount,
      selectedScheduleTypeValue,
      selectedScheduleDate,
      selectedScheduleDays,
      selectedScheduleTime: (selectedTimeOption && selectedTimeOption.value) || '',
      selectedScheduleTimeLabel: (selectedTimeOption && selectedTimeOption.label) || EMPTY_SCHEDULE_TEXT,
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
      const classDurationMinutes = Number(packageDetail.classDurationMinutes) || 90
      const timeOptions = buildTimeOptions(classDurationMinutes)
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
      const selectedScheduleDate =
        classCount === 1 ? this.data.selectedScheduleDate || minScheduleDate : `${this.data.selectedScheduleDate || ''}`.trim()
      const { scheduleType, weeklyTimes } = parseScheduleTypeValue(defaultScheduleTypeValue)
      const selectedScheduleDays =
        scheduleType === SCHEDULE_TYPES.WEEKLY ? this.normalizeSelectedScheduleDays(this.data.selectedScheduleDays, weeklyTimes) : []
      const pendingScheduleDays = selectedScheduleDays
      const selectedScheduleTime =
        classCount === 1
          ? `${this.data.selectedScheduleTime || ''}`.trim() || (timeOptions[0] && timeOptions[0].value) || ''
          : timeOptions.some(item => item.value === this.data.selectedScheduleTime)
            ? this.data.selectedScheduleTime
            : ''
      const selectedTimeIndex = timeOptions.findIndex(item => item.value === selectedScheduleTime)
      const selectedTimeOption = selectedTimeIndex >= 0 ? timeOptions[selectedTimeIndex] : null

      this.setData({
        packageDetail,
        classCount,
        timeOptions,
        selectedTargetCount: defaultTargetCount,
        minScheduleDate,
        scheduleTypeOptions,
        selectedScheduleTypeValue: defaultScheduleTypeValue,
        selectedScheduleDate,
        selectedScheduleDays,
        pendingScheduleDays,
        selectedTimeIndex,
        selectedScheduleTime: (selectedTimeOption && selectedTimeOption.value) || '',
        selectedScheduleTimeLabel: (selectedTimeOption && selectedTimeOption.label) || EMPTY_SCHEDULE_TEXT,
        ...buildScheduleUiState({
          selectedScheduleTypeValue: defaultScheduleTypeValue,
          selectedScheduleDays,
          pendingScheduleDays
        })
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
    return normalized.slice(0, Math.max(0, requiredCount))
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
    const baseSchedulePreviewList = buildSchedulePreview({
      classCount: this.data.classCount,
      scheduleTypeValue: this.data.selectedScheduleTypeValue,
      scheduleDate: this.data.selectedScheduleDate,
      scheduleAnchorDate: this.data.minScheduleDate,
      scheduleDays: this.data.selectedScheduleDays,
      scheduleTime: this.data.selectedScheduleTime
    })
    const classDurationMinutes =
      Number(this.data.packageDetail && this.data.packageDetail.classDurationMinutes) || 90
    const editableScheduleList = buildEditableScheduleList(baseSchedulePreviewList, classDurationMinutes)

    this.setData({
      schedulePreviewList: editableScheduleList,
      editableScheduleList,
      showScheduleItemEditor: false,
      editingScheduleItemIndex: -1
    })
  },

  syncScheduleItemEditorState({ editingScheduleItemDate, editingScheduleItemTime }) {
    const nextDate = `${editingScheduleItemDate || ''}`.trim() || this.data.minScheduleDate
    const nextTime = `${editingScheduleItemTime || ''}`.trim() || START_TIME_OPTIONS[0]
    const editingScheduleDateOptions = buildSelectableScheduleDates({
      startDateText: this.data.minScheduleDate,
      totalDays: 45,
      currentDateText: nextDate
    })
    const editingScheduleDateIndex = Math.max(
      0,
      editingScheduleDateOptions.findIndex(option => option.value === nextDate)
    )
    const editingScheduleItemTimeIndex = Math.max(
      0,
      this.data.timeOptions.findIndex(option => option.value === nextTime)
    )
    const editingTimeOption = this.data.timeOptions[editingScheduleItemTimeIndex] || this.data.timeOptions[0]
    const classDurationMinutes =
      Number(this.data.packageDetail && this.data.packageDetail.classDurationMinutes) || 90

    this.setData({
      editingScheduleDateOptions,
      editingScheduleDateIndex,
      editingScheduleItemDate:
        (editingScheduleDateOptions[editingScheduleDateIndex] && editingScheduleDateOptions[editingScheduleDateIndex].value) || nextDate,
      editingScheduleItemTimeIndex,
      editingScheduleItemTime: (editingTimeOption && editingTimeOption.value) || START_TIME_OPTIONS[0],
      editingScheduleItemTimeLabel: (editingTimeOption && editingTimeOption.label) || '',
      editingScheduleItemEndTime: addMinutesToTimeText(
        (editingTimeOption && editingTimeOption.value) || START_TIME_OPTIONS[0],
        classDurationMinutes
      )
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
    const selectedScheduleDays = []
    const pendingScheduleDays = []

    this.setData({
      selectedScheduleTypeValue,
      selectedScheduleDate: '',
      selectedScheduleTime: '',
      selectedScheduleTimeLabel: EMPTY_SCHEDULE_TEXT,
      selectedTimeIndex: -1,
      selectedScheduleDays,
      pendingScheduleDays,
      ...buildScheduleUiState({
        selectedScheduleTypeValue,
        selectedScheduleDays,
        pendingScheduleDays
      }),
      showScheduleDaysPopup: false
    })
    this.updateSchedulePreview()
  },

  handleScheduleDateChange(event) {
    const nextValue = `${event.detail.value || ''}`.trim()
    this.setData({
      selectedScheduleDate: nextValue
    })
    this.updateSchedulePreview()
  },

  handleTimeChange(event) {
    const selectedTimeIndex = Number(event.detail.value) || 0
    const option = this.data.timeOptions[selectedTimeIndex] || this.data.timeOptions[0]

    this.setData({
      selectedTimeIndex,
      selectedScheduleTime: option.value,
      selectedScheduleTimeLabel: option.label
    })
    this.updateSchedulePreview()
  },

  openScheduleDaysPopup() {
    const { scheduleType, weeklyTimes } = parseScheduleTypeValue(this.data.selectedScheduleTypeValue)
    if (scheduleType !== SCHEDULE_TYPES.WEEKLY) {
      return
    }

    const pendingScheduleDays = this.normalizeSelectedScheduleDays(this.data.selectedScheduleDays, weeklyTimes)
    this.setData({
      pendingScheduleDays,
      weekdayOptions: buildWeekdayOptionsState(pendingScheduleDays),
      showScheduleDaysPopup: true
    })
  },

  closeScheduleDaysPopup() {
    const pendingScheduleDays = this.data.selectedScheduleDays
    this.setData({
      showScheduleDaysPopup: false,
      pendingScheduleDays,
      weekdayOptions: buildWeekdayOptionsState(pendingScheduleDays)
    })
  },

  handleScheduleDayToggle(event) {
    const day = Number(event.currentTarget.dataset.day) || 0
    const { weeklyTimes } = parseScheduleTypeValue(this.data.selectedScheduleTypeValue)
    if (!day || !weeklyTimes) {
      return
    }

    const selectedSet = new Set(this.data.pendingScheduleDays || [])
    if (selectedSet.has(day)) {
      selectedSet.delete(day)
    } else if (selectedSet.size < weeklyTimes) {
      selectedSet.add(day)
    } else {
      wx.showToast({
        title: `需选择${weeklyTimes}天`,
        icon: 'none'
      })
      return
    }

    this.setData({
      pendingScheduleDays: [...selectedSet].sort((left, right) => left - right),
      weekdayOptions: buildWeekdayOptionsState([...selectedSet].sort((left, right) => left - right))
    })
  },

  confirmScheduleDaysPopup() {
    const { weeklyTimes } = parseScheduleTypeValue(this.data.selectedScheduleTypeValue)
    const pendingScheduleDays = [...(this.data.pendingScheduleDays || [])].sort((left, right) => left - right)

    if (pendingScheduleDays.length !== weeklyTimes) {
      wx.showToast({
        title: `需选择${weeklyTimes}天`,
        icon: 'none'
      })
      return
    }

    this.setData({
      selectedScheduleDays: pendingScheduleDays,
      pendingScheduleDays,
      ...buildScheduleUiState({
        selectedScheduleTypeValue: this.data.selectedScheduleTypeValue,
        selectedScheduleDays: pendingScheduleDays,
        pendingScheduleDays
      }),
      showScheduleDaysPopup: false
    })
    this.updateSchedulePreview()
  },

  openScheduleItemEditor(event) {
    const itemIndex = Number(event.currentTarget.dataset.index)
    const targetItem = (this.data.editableScheduleList || []).find(item => Number(item.index) === itemIndex)

    if (!targetItem) {
      return
    }

    this.setData({
      showScheduleItemEditor: true,
      editingScheduleItemIndex: itemIndex,
      editingScheduleItemDate: targetItem.scheduleDate || this.data.minScheduleDate,
      editingScheduleItemTime: targetItem.scheduleTime || START_TIME_OPTIONS[0]
    })
    this.syncScheduleItemEditorState({
      editingScheduleItemDate: targetItem.scheduleDate || this.data.minScheduleDate,
      editingScheduleItemTime: targetItem.scheduleTime || START_TIME_OPTIONS[0]
    })
  },

  closeScheduleItemEditor() {
    this.setData({
      showScheduleItemEditor: false,
      editingScheduleItemIndex: -1
    })
  },

  handleScheduleItemPickerChange(event) {
    const detailValue = Array.isArray(event.detail.value) ? event.detail.value : []
    const editingScheduleDateIndex = Math.max(0, Number(detailValue[0]) || 0)
    const editingScheduleItemTimeIndex = Math.max(0, Number(detailValue[1]) || 0)
    const selectedDateOption =
      this.data.editingScheduleDateOptions[editingScheduleDateIndex] || this.data.editingScheduleDateOptions[0]
    const selectedTimeOption = this.data.timeOptions[editingScheduleItemTimeIndex] || this.data.timeOptions[0]
    const classDurationMinutes =
      Number(this.data.packageDetail && this.data.packageDetail.classDurationMinutes) || 90

    this.setData({
      editingScheduleDateIndex,
      editingScheduleItemDate: (selectedDateOption && selectedDateOption.value) || this.data.minScheduleDate,
      editingScheduleItemTimeIndex,
      editingScheduleItemTime: (selectedTimeOption && selectedTimeOption.value) || START_TIME_OPTIONS[0],
      editingScheduleItemTimeLabel: (selectedTimeOption && selectedTimeOption.label) || '',
      editingScheduleItemEndTime: addMinutesToTimeText(
        (selectedTimeOption && selectedTimeOption.value) || START_TIME_OPTIONS[0],
        classDurationMinutes
      )
    })
  },

  confirmScheduleItemEditor() {
    const { editingScheduleItemIndex, editingScheduleItemDate, editingScheduleItemTime, editableScheduleList, minScheduleDate } = this.data

    if (editingScheduleItemIndex <= 0) {
      return
    }

    const nextDate = `${editingScheduleItemDate || ''}`.trim() || minScheduleDate
    if (nextDate < minScheduleDate) {
      wx.showToast({
        title: '上课日期不能早于开团后第3天',
        icon: 'none'
      })
      return
    }

    const classDurationMinutes =
      Number(this.data.packageDetail && this.data.packageDetail.classDurationMinutes) || 90
    const nextScheduleList = (editableScheduleList || []).map(item => {
      if (Number(item.index) !== editingScheduleItemIndex) {
        return item
      }

      const classTime = formatClassTimeValue({
        date: nextDate,
        time: editingScheduleItemTime
      })

      return {
        ...item,
        classTime,
        scheduleDate: nextDate,
        scheduleTime: editingScheduleItemTime,
        endTime: addMinutesToTimeText(editingScheduleItemTime, classDurationMinutes),
        displayText: formatPreviewDisplayText(
          classTime,
          addMinutesToTimeText(editingScheduleItemTime, classDurationMinutes)
        )
      }
    })

    this.setData({
      editableScheduleList: nextScheduleList,
      schedulePreviewList: nextScheduleList,
      showScheduleItemEditor: false,
      editingScheduleItemIndex: -1
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
        return '请选择上课日期'
      }
      return ''
    }

    if (scheduleType === SCHEDULE_TYPES.WEEKLY) {
      if ((selectedScheduleDays || []).length !== weeklyTimes) {
        return `需选择${weeklyTimes}天`
      }
      return ''
    }

    return '请选择上课频率'
  },

  validateSchedulePreviewUniqueness() {
    const classTimes = (this.data.editableScheduleList || [])
      .map(item => `${item.classTime || ''}`.trim())
      .filter(Boolean)

    if (!classTimes.length) {
      return ''
    }

    return new Set(classTimes).size === classTimes.length ? '' : '上课时间不可重复'
  },

  buildSchedulePayload() {
    const { classCount, selectedScheduleTypeValue, selectedScheduleDate, selectedScheduleDays, selectedScheduleTime, minScheduleDate } = this.data
    const { scheduleType } = parseScheduleTypeValue(selectedScheduleTypeValue)
    const scheduleList = (this.data.editableScheduleList || []).map(item => ({
      index: item.index,
      class_time: item.classTime
    }))

    if (classCount === 1) {
      return {
        scheduleType: SCHEDULE_TYPES.SINGLE,
        scheduleDate: selectedScheduleDate,
        scheduleDays: [],
        scheduleTime: selectedScheduleTime,
        scheduleList
      }
    }

    if (scheduleType === SCHEDULE_TYPES.DAILY) {
      return {
        scheduleType: SCHEDULE_TYPES.DAILY,
        scheduleDate: selectedScheduleDate,
        scheduleDays: [],
        scheduleTime: selectedScheduleTime,
        scheduleList
      }
    }

    return {
      scheduleType: SCHEDULE_TYPES.WEEKLY,
      scheduleDate: minScheduleDate,
      scheduleDays: this.data.selectedScheduleDays,
      scheduleTime: selectedScheduleTime,
      scheduleList
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

    const duplicateScheduleError = this.validateSchedulePreviewUniqueness()
    if (duplicateScheduleError) {
      wx.showToast({
        title: duplicateScheduleError,
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
        scheduleList: schedulePayload.scheduleList,
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
