const { parseShanghaiDate } = require('../utils/dateTime')

const pad = value => `${value}`.padStart(2, '0')

const WEEKDAY_LABELS = {
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '日'
}

const normalizeWeekday = value => {
  const weekday = Number(value)
  return Number.isInteger(weekday) && weekday >= 1 && weekday <= 7 ? weekday : 0
}

const normalizeHour = value => {
  const hour = Number(value)
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : -1
}

const formatPackageWeekdayLabel = weekday => `周${WEEKDAY_LABELS[normalizeWeekday(weekday)] || ''}`

const formatPackageHourLabel = hour => `${pad(normalizeHour(hour))}:00`

const formatPendingPackageScheduleText = ({ weekday, hour }) => {
  const weekdayLabel = formatPackageWeekdayLabel(weekday)
  const hourLabel = formatPackageHourLabel(hour)

  if (!weekdayLabel.trim() || hourLabel === '-1:00') {
    return '时间待定'
  }

  return `每${weekdayLabel} ${hourLabel}，共5次`
}

const formatScheduleTextWithLockNote = ({ weekday, hour }) =>
  `${formatPendingPackageScheduleText({ weekday, hour })}，成团后锁定首课日期`

const formatPackageDateTime = value => {
  const date = parseShanghaiDate(value)
  if (!date) {
    return ''
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`
}

const computeFirstPackageClassTime = ({ successTime, weekday, hour }) => {
  const normalizedWeekday = normalizeWeekday(weekday)
  const normalizedHour = normalizeHour(hour)
  const baseTime = parseShanghaiDate(successTime)

  if (!normalizedWeekday || normalizedHour < 0 || !baseTime) {
    return null
  }

  const targetJsDay = normalizedWeekday % 7
  const candidate = new Date(baseTime.getTime())
  candidate.setMinutes(0, 0, 0)
  candidate.setHours(normalizedHour, 0, 0, 0)

  let diffDays = (targetJsDay - candidate.getDay() + 7) % 7
  candidate.setDate(candidate.getDate() + diffDays)

  if (candidate.getTime() < baseTime.getTime()) {
    diffDays = diffDays === 0 ? 7 : 0
    candidate.setDate(candidate.getDate() + diffDays)
  }

  return candidate
}

const buildPackageLessonSchedule = ({ firstClassTime, weeks = 5 }) => {
  const firstDate = parseShanghaiDate(firstClassTime)
  const totalWeeks = Math.max(1, Number(weeks) || 5)

  if (!firstDate) {
    return []
  }

  return Array.from({ length: totalWeeks }, (_, index) => {
    const classDate = new Date(firstDate.getTime())
    classDate.setDate(classDate.getDate() + index * 7)

    return {
      index: index + 1,
      class_time: formatPackageDateTime(classDate),
      display_text: formatPackageDateTime(classDate)
    }
  })
}

module.exports = {
  WEEKDAY_LABELS,
  buildPackageLessonSchedule,
  computeFirstPackageClassTime,
  formatPackageDateTime,
  formatPackageHourLabel,
  formatPackageWeekdayLabel,
  formatPendingPackageScheduleText,
  formatScheduleTextWithLockNote,
  normalizeHour,
  normalizeWeekday
}
