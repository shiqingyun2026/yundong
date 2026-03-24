const formatNumber = n => {
  const stringValue = `${n}`
  return stringValue[1] ? stringValue : `0${stringValue}`
}

const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const weekMap = ['日', '一', '二', '三', '四', '五', '六']

const safeDate = value => {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatPrice = value => {
  if (value === undefined || value === null || value === '') {
    return '0.00'
  }

  return (Number(value) / 100).toFixed(2)
}

const formatMonthDay = value => {
  const date = safeDate(value)

  if (!date) {
    return '--'
  }

  return `${formatNumber(date.getMonth() + 1)}月${formatNumber(date.getDate())}日`
}

const formatHourMinute = value => {
  const date = safeDate(value)

  if (!date) {
    return '--:--'
  }

  return `${formatNumber(date.getHours())}:${formatNumber(date.getMinutes())}`
}

const formatCourseTimeRange = (startTime, endTime) => {
  const startDate = safeDate(startTime)
  const endDate = safeDate(endTime)

  if (!startDate || !endDate) {
    return '时间待定'
  }

  return `${formatMonthDay(startDate)} 周${weekMap[startDate.getDay()]} ${formatHourMinute(startDate)}-${formatHourMinute(endDate)}`
}

const formatCourseStartTime = startTime => {
  const startDate = safeDate(startTime)

  if (!startDate) {
    return '时间待定'
  }

  return `${formatMonthDay(startDate)} 周${weekMap[startDate.getDay()]} ${formatHourMinute(startDate)}`
}

const formatDistance = distance => {
  if (distance === undefined || distance === null || distance === '') {
    return ''
  }

  const numericDistance = Number(distance)
  if (Number.isNaN(numericDistance)) {
    return `${distance}`
  }

  if (numericDistance < 1) {
    return `${Math.round(numericDistance * 1000)}m`
  }

  return `${numericDistance.toFixed(1)}km`
}

const storageSet = (key, value) => {
  wx.setStorageSync(key, value)
}

const storageGet = (key, defaultValue = null) => {
  const value = wx.getStorageSync(key)
  return value === '' || value === undefined ? defaultValue : value
}

module.exports = {
  formatTime,
  formatPrice,
  formatMonthDay,
  formatHourMinute,
  formatCourseStartTime,
  formatCourseTimeRange,
  formatDistance,
  storageSet,
  storageGet
}
