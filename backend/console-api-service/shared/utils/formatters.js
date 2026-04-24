const { safeDate } = require('../../utils/courseLifecycle')

const pad = value => `${value}`.padStart(2, '0')

const formatDateTime = value => {
  const date = safeDate(value)
  if (!date) {
    return ''
  }

  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const formatCourseTimeRange = (startTime, endTime = startTime) => {
  const startDate = safeDate(startTime)
  const endDate = safeDate(endTime)

  if (!startDate || !endDate) {
    return '时间待定'
  }

  const weekMap = ['日', '一', '二', '三', '四', '五', '六']

  return `${pad(startDate.getMonth() + 1)}月${pad(startDate.getDate())}日 周${weekMap[startDate.getDay()]} ${pad(startDate.getHours())}:${pad(startDate.getMinutes())}-${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`
}

const formatPrice = value => Number(value || 0).toFixed(2)

const getRemainingSeconds = (expireTime, now = Date.now()) => {
  const expireAt = safeDate(expireTime)
  if (!expireAt) {
    return 0
  }

  return Math.max(0, Math.floor((expireAt.getTime() - now) / 1000))
}

module.exports = {
  formatCourseTimeRange,
  formatDateTime,
  formatPrice,
  getRemainingSeconds
}
