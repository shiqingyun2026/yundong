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

const SCHEDULE_TYPES = {
  SINGLE: 'single',
  DAILY: 'daily',
  WEEKLY: 'weekly'
}

const normalizeWeekday = value => {
  const weekday = Number(value)
  return Number.isInteger(weekday) && weekday >= 1 && weekday <= 7 ? weekday : 0
}

const normalizeWeekdays = value => {
  const items = Array.isArray(value) ? value : []
  return [...new Set(items.map(normalizeWeekday).filter(Boolean))].sort((left, right) => left - right)
}

const normalizeHour = value => {
  const hour = Number(value)
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : -1
}

const normalizeMinute = value => {
  const minute = Number(value)
  return minute === 0 || minute === 30 ? minute : -1
}

const normalizeTimeText = value => {
  const normalized = `${value || ''}`.trim()
  const matched = normalized.match(/^(\d{1,2}):(\d{2})$/)

  if (!matched) {
    return ''
  }

  const hour = normalizeHour(matched[1])
  const minute = normalizeMinute(matched[2])
  if (hour < 0 || minute < 0) {
    return ''
  }

  return `${pad(hour)}:${pad(minute)}`
}

const normalizeScheduleType = value => {
  const normalized = `${value || ''}`.trim().toLowerCase()
  if (Object.values(SCHEDULE_TYPES).includes(normalized)) {
    return normalized
  }
  return ''
}

const formatPackageWeekdayLabel = weekday => `周${WEEKDAY_LABELS[normalizeWeekday(weekday)] || ''}`

const formatPackageTimeLabel = value => {
  const normalized = normalizeTimeText(value)
  return normalized || ''
}

const formatPackageHourLabel = hour => `${pad(normalizeHour(hour))}:00`

const formatPackageDateTime = value => {
  const date = parseShanghaiDate(value)
  if (!date) {
    return ''
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`
}

const toDateOnly = value => {
  const date = parseShanghaiDate(value)
  if (!date) {
    return null
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

const buildDateTimeFromDateAndTime = ({ date, time }) => {
  const targetDate = toDateOnly(date)
  const normalizedTime = normalizeTimeText(time)

  if (!targetDate || !normalizedTime) {
    return null
  }

  const [hour, minute] = normalizedTime.split(':').map(Number)
  targetDate.setHours(hour, minute, 0, 0)
  return targetDate
}

const buildScheduleItemsFromDates = dates =>
  dates.map((date, index) => ({
    index: index + 1,
    class_time: formatPackageDateTime(date),
    display_text: formatPackageDateTime(date)
  }))

const buildLegacyWeeklySchedule = ({ firstClassTime, weeks = 5 }) => {
  const firstDate = parseShanghaiDate(firstClassTime)
  const totalWeeks = Math.max(1, Number(weeks) || 5)

  if (!firstDate) {
    return []
  }

  return buildScheduleItemsFromDates(
    Array.from({ length: totalWeeks }, (_, index) => {
      const classDate = new Date(firstDate.getTime())
      classDate.setDate(classDate.getDate() + index * 7)
      return classDate
    })
  )
}

const buildSingleSchedule = ({ classCount = 1, startDate, time }) => {
  const firstDate = buildDateTimeFromDateAndTime({
    date: startDate,
    time
  })

  if (!firstDate) {
    return []
  }

  return buildScheduleItemsFromDates([firstDate].slice(0, Math.max(1, Number(classCount) || 1)))
}

const buildDailySchedule = ({ classCount, startDate, time }) => {
  const firstDate = buildDateTimeFromDateAndTime({
    date: startDate,
    time
  })
  const totalCount = Math.max(1, Number(classCount) || 0)

  if (!firstDate) {
    return []
  }

  return buildScheduleItemsFromDates(
    Array.from({ length: totalCount }, (_, index) => {
      const classDate = new Date(firstDate.getTime())
      classDate.setDate(classDate.getDate() + index)
      return classDate
    })
  )
}

const buildWeeklySchedule = ({ classCount, weekdays, time, anchorDate }) => {
  const normalizedWeekdays = normalizeWeekdays(weekdays)
  const normalizedTime = normalizeTimeText(time)
  const anchor = buildDateTimeFromDateAndTime({
    date: anchorDate,
    time: normalizedTime
  })
  const totalCount = Math.max(1, Number(classCount) || 0)

  if (!normalizedWeekdays.length || !normalizedTime || !anchor) {
    return []
  }

  const dates = []
  const cursor = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  const maxIterations = totalCount * 14
  let guard = 0

  while (dates.length < totalCount && guard < maxIterations) {
    const weekday = cursor.getDay() === 0 ? 7 : cursor.getDay()
    if (normalizedWeekdays.includes(weekday)) {
      const candidate = new Date(cursor.getTime())
      candidate.setHours(anchor.getHours(), anchor.getMinutes(), 0, 0)
      if (candidate.getTime() >= anchor.getTime()) {
        dates.push(candidate)
      }
    }

    cursor.setDate(cursor.getDate() + 1)
    guard += 1
  }

  return buildScheduleItemsFromDates(dates)
}

const buildPackageLessonSchedule = options => {
  const payload = options || {}
  const scheduleConfig = payload.scheduleConfig || payload.schedule_config || {}
  const scheduleType = normalizeScheduleType(payload.scheduleType || payload.schedule_type || scheduleConfig.scheduleType || scheduleConfig.schedule_type)
  const classCount = Number(payload.classCount || payload.class_count || scheduleConfig.classCount || scheduleConfig.class_count || 0)
  const startDate = `${payload.startDate || payload.start_date || payload.scheduleDate || payload.schedule_date || scheduleConfig.startDate || scheduleConfig.start_date || scheduleConfig.scheduleDate || scheduleConfig.schedule_date || ''}`.trim()
  const anchorDate = `${payload.anchorDate || payload.anchor_date || scheduleConfig.anchorDate || scheduleConfig.anchor_date || startDate || ''}`.trim()
  const time = payload.time || payload.scheduleTime || payload.schedule_time || scheduleConfig.time || scheduleConfig.scheduleTime || scheduleConfig.schedule_time || ''
  const weekdays = payload.weekdays || payload.scheduleDays || payload.schedule_days || scheduleConfig.weekdays || scheduleConfig.scheduleDays || scheduleConfig.schedule_days || []

  if (scheduleType === SCHEDULE_TYPES.SINGLE) {
    return buildSingleSchedule({
      classCount: classCount || 1,
      startDate,
      time
    })
  }

  if (scheduleType === SCHEDULE_TYPES.DAILY) {
    return buildDailySchedule({
      classCount,
      startDate,
      time
    })
  }

  if (scheduleType === SCHEDULE_TYPES.WEEKLY) {
    return buildWeeklySchedule({
      classCount,
      weekdays,
      time,
      anchorDate
    })
  }

  return buildLegacyWeeklySchedule({
    firstClassTime: payload.firstClassTime || payload.first_class_time,
    weeks: payload.weeks
  })
}

const resolveFirstScheduleTime = options => {
  const scheduleList = buildPackageLessonSchedule(options)
  return scheduleList.length ? parseShanghaiDate(scheduleList[0].class_time) : null
}

const computeFirstPackageClassTime = ({ successTime, weekday, hour, time, scheduleConfig, classCount = 0 }) => {
  if (scheduleConfig) {
    return resolveFirstScheduleTime({
      scheduleConfig: {
        ...scheduleConfig,
        classCount: scheduleConfig.classCount || scheduleConfig.class_count || classCount
      }
    })
  }

  const normalizedWeekday = normalizeWeekday(weekday)
  const baseTime = parseShanghaiDate(successTime)
  const normalizedTime = normalizeTimeText(time || (normalizeHour(hour) >= 0 ? `${pad(normalizeHour(hour))}:00` : ''))

  if (!normalizedWeekday || !baseTime || !normalizedTime) {
    return null
  }

  const [targetHour, targetMinute] = normalizedTime.split(':').map(Number)
  const targetJsDay = normalizedWeekday % 7
  const candidate = new Date(baseTime.getTime())
  candidate.setSeconds(0, 0)
  candidate.setHours(targetHour, targetMinute, 0, 0)

  let diffDays = (targetJsDay - candidate.getDay() + 7) % 7
  candidate.setDate(candidate.getDate() + diffDays)

  if (diffDays === 0 || candidate.getTime() < baseTime.getTime()) {
    diffDays = diffDays === 0 ? 7 : 0
    candidate.setDate(candidate.getDate() + diffDays)
  }

  return candidate
}

const formatPendingPackageScheduleText = ({ weekday, hour, scheduleConfig, classCount }) => {
  if (scheduleConfig) {
    const scheduleType = normalizeScheduleType(scheduleConfig.scheduleType || scheduleConfig.schedule_type)
    const totalCount = Number(scheduleConfig.classCount || scheduleConfig.class_count || classCount) || 0
    const timeLabel = formatPackageTimeLabel(scheduleConfig.time || scheduleConfig.schedule_time || scheduleConfig.scheduleTime)

    if (scheduleType === SCHEDULE_TYPES.SINGLE) {
      const scheduleList = buildPackageLessonSchedule({
        scheduleConfig: {
          ...scheduleConfig,
          classCount: totalCount || 1
        }
      })
      return scheduleList[0] ? scheduleList[0].display_text : '时间待定'
    }

    if (scheduleType === SCHEDULE_TYPES.DAILY) {
      return timeLabel ? `每天 ${timeLabel}，共${totalCount}次` : '时间待定'
    }

    if (scheduleType === SCHEDULE_TYPES.WEEKLY) {
      const weekdayText = normalizeWeekdays(
        scheduleConfig.weekdays || scheduleConfig.schedule_days || scheduleConfig.scheduleDays
      )
        .map(formatPackageWeekdayLabel)
        .join('、')

      return weekdayText && timeLabel ? `每${weekdayText} ${timeLabel}，共${totalCount}次` : '时间待定'
    }
  }

  const weekdayLabel = formatPackageWeekdayLabel(weekday)
  const hourLabel = formatPackageHourLabel(hour)

  if (!weekdayLabel.trim() || hourLabel === '-1:00') {
    return '时间待定'
  }

  return `每${weekdayLabel} ${hourLabel}，共5次`
}

const formatScheduleTextWithLockNote = payload => `${formatPendingPackageScheduleText(payload)}，成团后锁定课表`

module.exports = {
  SCHEDULE_TYPES,
  WEEKDAY_LABELS,
  buildPackageLessonSchedule,
  computeFirstPackageClassTime,
  formatPackageDateTime,
  formatPackageHourLabel,
  formatPackageTimeLabel,
  formatPackageWeekdayLabel,
  formatPendingPackageScheduleText,
  formatScheduleTextWithLockNote,
  normalizeHour,
  normalizeMinute,
  normalizeScheduleType,
  normalizeTimeText,
  normalizeWeekday,
  normalizeWeekdays,
  resolveFirstScheduleTime
}
