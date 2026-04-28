const SHANGHAI_TIMEZONE = 'Asia/Shanghai'

const pad = value => `${value}`.padStart(2, '0')

const hasExplicitTimezone = value => /(Z|[+-]\d{2}:\d{2})$/i.test(value)

const isPlainDateTime = value => /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(value)

const toShanghaiDateTimeInput = value => {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value
  }

  const normalized = `${value}`.trim()
  if (!normalized) {
    return null
  }

  if (hasExplicitTimezone(normalized)) {
    return normalized
  }

  if (!isPlainDateTime(normalized)) {
    return normalized
  }

  const [datePart, timePart = '00:00:00'] = normalized.replace('T', ' ').split(' ')
  const [year, month, day] = datePart.split('-')
  const timeSegments = timePart.split(':')
  const hour = timeSegments[0] || '00'
  const minute = timeSegments[1] || '00'
  const second = timeSegments[2] || '00'

  return `${year}-${month}-${day}T${pad(hour)}:${pad(minute)}:${pad(second)}+08:00`
}

const parseShanghaiDate = value => {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime())
  }

  const normalizedInput = toShanghaiDateTimeInput(value)
  if (!normalizedInput) {
    return null
  }

  const date = new Date(normalizedInput)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatShanghaiDateTime = value => {
  const date = parseShanghaiDate(value)
  if (!date) {
    return ''
  }

  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHANGHAI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  })
    .formatToParts(date)
    .reduce((result, part) => {
      if (part.type !== 'literal') {
        result[part.type] = part.value
      }

      return result
    }, {})

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

module.exports = {
  SHANGHAI_TIMEZONE,
  formatShanghaiDateTime,
  parseShanghaiDate,
  toShanghaiDateTimeInput
}
