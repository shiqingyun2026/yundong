const pad = value => `${value}`.padStart(2, '0')

const WEEKDAY_OPTIONS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' }
]

const SCHEDULE_TYPES = {
  SINGLE: 'single',
  DAILY: 'daily',
  WEEKLY: 'weekly'
}

const SCHEDULE_TYPE_OPTIONS = [
  { value: SCHEDULE_TYPES.DAILY, label: '每天1次' },
  { value: `${SCHEDULE_TYPES.WEEKLY}:1`, label: '每周1次' },
  { value: `${SCHEDULE_TYPES.WEEKLY}:2`, label: '每周2次' },
  { value: `${SCHEDULE_TYPES.WEEKLY}:3`, label: '每周3次' }
]

const START_TIME_OPTIONS = Array.from({ length: 21 }, (_, index) => {
  const totalMinutes = 9 * 60 + index * 30
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${pad(hour)}:${pad(minute)}`
})

const toDateOnly = value => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  date.setHours(0, 0, 0, 0)
  return date
}

const parseDateTime = value => {
  if (!value) {
    return null
  }

  const normalized = `${value}`.trim()
  if (!normalized) {
    return null
  }

  const date = new Date(normalized.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

const buildDateTime = ({ date, time }) => {
  const targetDate = toDateOnly(date)
  if (!targetDate || !time) {
    return null
  }

  const [hour, minute] = `${time}`.split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null
  }

  targetDate.setHours(hour, minute, 0, 0)
  return targetDate
}

const formatDateInputValue = value => {
  const date = toDateOnly(value)
  if (!date) {
    return ''
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const formatPreviewText = date => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return ''
  }

  const weekday = WEEKDAY_OPTIONS.find(item => item.value === (date.getDay() === 0 ? 7 : date.getDay()))
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${weekday ? weekday.label : ''} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const buildMinScheduleDate = now => {
  const date = toDateOnly(now || new Date())
  if (!date) {
    return ''
  }

  date.setDate(date.getDate() + 2)
  return formatDateInputValue(date)
}

const resolveScheduleTypeValue = ({ classCount, scheduleType, weeklyTimes = 1 }) => {
  const totalCount = Math.max(1, Number(classCount) || 0)
  if (totalCount === 1) {
    return SCHEDULE_TYPES.SINGLE
  }

  if (scheduleType === SCHEDULE_TYPES.DAILY) {
    return SCHEDULE_TYPES.DAILY
  }

  return `${SCHEDULE_TYPES.WEEKLY}:${Math.max(1, Number(weeklyTimes) || 1)}`
}

const parseScheduleTypeValue = value => {
  const normalized = `${value || ''}`.trim()
  if (normalized === SCHEDULE_TYPES.SINGLE || normalized === SCHEDULE_TYPES.DAILY) {
    return {
      scheduleType: normalized,
      weeklyTimes: 0
    }
  }

  const [scheduleType, weeklyTimes] = normalized.split(':')
  if (scheduleType === SCHEDULE_TYPES.WEEKLY) {
    return {
      scheduleType,
      weeklyTimes: Math.max(1, Number(weeklyTimes) || 1)
    }
  }

  return {
    scheduleType: '',
    weeklyTimes: 0
  }
}

const getAllowedScheduleTypeOptions = classCount => {
  const totalCount = Math.max(1, Number(classCount) || 0)
  if (totalCount === 1) {
    return []
  }

  return SCHEDULE_TYPE_OPTIONS.filter(option => {
    if (option.value === SCHEDULE_TYPES.DAILY || option.value === `${SCHEDULE_TYPES.WEEKLY}:1`) {
      return true
    }

    if (option.value === `${SCHEDULE_TYPES.WEEKLY}:2`) {
      return totalCount >= 2
    }

    if (option.value === `${SCHEDULE_TYPES.WEEKLY}:3`) {
      return totalCount >= 3
    }

    return false
  })
}

const buildSchedulePreview = ({ classCount, scheduleTypeValue, scheduleDate, scheduleAnchorDate, scheduleDays, scheduleTime }) => {
  const totalCount = Math.max(1, Number(classCount) || 0)
  const { scheduleType, weeklyTimes } = parseScheduleTypeValue(scheduleTypeValue)
  const normalizedDays = [...new Set((Array.isArray(scheduleDays) ? scheduleDays : []).map(Number).filter(Boolean))].sort(
    (left, right) => left - right
  )

  if (totalCount === 1) {
    const date = buildDateTime({
      date: scheduleDate,
      time: scheduleTime
    })

    return date
      ? [
          {
            index: 1,
            classTime: `${formatDateInputValue(date)} ${scheduleTime}:00`,
            displayText: formatPreviewText(date)
          }
        ]
      : []
  }

  if (scheduleType === SCHEDULE_TYPES.DAILY) {
    const firstDate = buildDateTime({
      date: scheduleDate,
      time: scheduleTime
    })
    if (!firstDate) {
      return []
    }

    return Array.from({ length: totalCount }, (_, index) => {
      const current = new Date(firstDate.getTime())
      current.setDate(current.getDate() + index)
      return {
        index: index + 1,
        classTime: `${formatDateInputValue(current)} ${scheduleTime}:00`,
        displayText: formatPreviewText(current)
      }
    })
  }

  if (scheduleType === SCHEDULE_TYPES.WEEKLY && normalizedDays.length === weeklyTimes) {
    const anchor = buildDateTime({
      date: scheduleDate || scheduleAnchorDate,
      time: scheduleTime
    })
    if (!anchor) {
      return []
    }

    const result = []
    const cursor = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())

    while (result.length < totalCount) {
      const weekday = cursor.getDay() === 0 ? 7 : cursor.getDay()
      if (normalizedDays.includes(weekday)) {
        const current = new Date(cursor.getTime())
        current.setHours(anchor.getHours(), anchor.getMinutes(), 0, 0)
        if (current.getTime() >= anchor.getTime()) {
          result.push({
            index: result.length + 1,
            classTime: `${formatDateInputValue(current)} ${scheduleTime}:00`,
            displayText: formatPreviewText(current)
          })
        }
      }
      cursor.setDate(cursor.getDate() + 1)
    }

    return result
  }

  return []
}

module.exports = {
  buildMinScheduleDate,
  buildSchedulePreview,
  formatDateInputValue,
  getAllowedScheduleTypeOptions,
  parseScheduleTypeValue,
  resolveScheduleTypeValue,
  SCHEDULE_TYPES,
  SCHEDULE_TYPE_OPTIONS,
  START_TIME_OPTIONS,
  WEEKDAY_OPTIONS
}
