const { formatShanghaiDateTime, parseShanghaiDate } = require('../utils/dateTime')

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
  const rangeMatched = normalized.match(/^(\d{1,2}:\d{2})\s*[—–-]\s*\d{1,2}:\d{2}$/)
  const candidate = rangeMatched ? rangeMatched[1] : normalized
  const matched = candidate.match(/^(\d{1,2}):(\d{2})$/)

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
  const formatted = formatShanghaiDateTime(value)
  if (!formatted) {
    return ''
  }

  return formatted
}

const resolveShanghaiDateText = value => {
  const normalized = `${value || ''}`.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized
  }

  const formatted = formatShanghaiDateTime(value)
  if (!formatted) {
    return ''
  }

  return formatted.slice(0, 10)
}

const toDateOnly = value => {
  const dateText = resolveShanghaiDateText(value)
  if (!dateText) {
    return null
  }

  return parseShanghaiDate(`${dateText} 00:00:00`)
}

const buildDateTimeFromDateAndTime = ({ date, time }) => {
  const normalizedTime = normalizeTimeText(time)
  const dateText = resolveShanghaiDateText(date)

  if (!dateText || !normalizedTime) {
    return null
  }

  return parseShanghaiDate(`${dateText} ${normalizedTime}:00`)
}

const buildScheduleItemsFromDates = dates =>
  dates.map((date, index) => ({
    index: index + 1,
    class_time: formatPackageDateTime(date),
    display_text: formatPackageDateTime(date)
  }))

const normalizeCustomScheduleList = value => {
  const items = Array.isArray(value) ? value : []

  return items
    .map((item, index) => {
      const classTime = formatPackageDateTime(item && (item.class_time || item.classTime || item.display_text || item.displayText))
      if (!classTime) {
        return null
      }

      return {
        index: Number(item && item.index) > 0 ? Number(item.index) : index + 1,
        class_time: classTime,
        display_text: classTime
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.index - right.index)
}

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
  const cursor = toDateOnly(anchor)
  const maxIterations = totalCount * 14
  let guard = 0

  while (dates.length < totalCount && guard < maxIterations) {
    const weekdayProbe = parseShanghaiDate(`${resolveShanghaiDateText(cursor)} 12:00:00`)
    const weekday = weekdayProbe ? (weekdayProbe.getUTCDay() === 0 ? 7 : weekdayProbe.getUTCDay()) : 0
    if (normalizedWeekdays.includes(weekday)) {
      const candidate = buildDateTimeFromDateAndTime({
        date: resolveShanghaiDateText(cursor),
        time: normalizedTime
      })
      if (candidate.getTime() >= anchor.getTime()) {
        dates.push(candidate)
      }
    }

    cursor.setTime(cursor.getTime() + 24 * 60 * 60 * 1000)
    guard += 1
  }

  return buildScheduleItemsFromDates(dates)
}

const buildPackageLessonSchedule = options => {
  const payload = options || {}
  const scheduleConfig = payload.scheduleConfig || payload.schedule_config || {}
  const customScheduleList = normalizeCustomScheduleList(
    payload.scheduleList || payload.schedule_list || scheduleConfig.scheduleList || scheduleConfig.schedule_list
  )
  const scheduleType = normalizeScheduleType(payload.scheduleType || payload.schedule_type || scheduleConfig.scheduleType || scheduleConfig.schedule_type)
  const classCount = Number(payload.classCount || payload.class_count || scheduleConfig.classCount || scheduleConfig.class_count || 0)
  const startDate = `${payload.startDate || payload.start_date || payload.scheduleDate || payload.schedule_date || scheduleConfig.startDate || scheduleConfig.start_date || scheduleConfig.scheduleDate || scheduleConfig.schedule_date || ''}`.trim()
  const anchorDate = `${payload.anchorDate || payload.anchor_date || scheduleConfig.anchorDate || scheduleConfig.anchor_date || startDate || ''}`.trim()
  const time = payload.time || payload.scheduleTime || payload.schedule_time || scheduleConfig.time || scheduleConfig.scheduleTime || scheduleConfig.schedule_time || ''
  const weekdays = payload.weekdays || payload.scheduleDays || payload.schedule_days || scheduleConfig.weekdays || scheduleConfig.scheduleDays || scheduleConfig.schedule_days || []

  if (customScheduleList.length) {
    return customScheduleList
  }

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

  const cursor = toDateOnly(baseTime)
  if (!cursor) {
    return null
  }

  cursor.setTime(cursor.getTime() + 24 * 60 * 60 * 1000)

  for (let index = 0; index < 8; index += 1) {
    const dateText = resolveShanghaiDateText(cursor)
    const weekdayProbe = parseShanghaiDate(`${dateText} 12:00:00`)
    const currentWeekday = weekdayProbe ? (weekdayProbe.getUTCDay() === 0 ? 7 : weekdayProbe.getUTCDay()) : 0
    if (currentWeekday === normalizedWeekday) {
      return buildDateTimeFromDateAndTime({
        date: dateText,
        time: normalizedTime
      })
    }
    cursor.setTime(cursor.getTime() + 24 * 60 * 60 * 1000)
  }

  return null
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
  normalizeCustomScheduleList,
  normalizeScheduleType,
  normalizeTimeText,
  normalizeWeekday,
  normalizeWeekdays,
  resolveFirstScheduleTime
}
