const normalizeBoolean = value => value === true || value === 'true' || value === 1 || value === '1'

const ok = (res, data = {}, message = 'ok') =>
  res.json({
    code: 0,
    message,
    data
  })

const fail = (res, code, message, status = 400, extra = {}) =>
  res.status(status).json({
    code,
    message,
    ...extra
  })

const getPagination = query => {
  const page = Math.max(1, Number(query.page) || 1)
  const size = Math.max(1, Math.min(100, Number(query.size) || 10))

  return {
    page,
    size,
    from: (page - 1) * size,
    to: page * size - 1
  }
}

const getShanghaiDateParts = value => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  })

  return formatter.formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') {
      result[part.type] = part.value
    }

    return result
  }, {})
}

const formatDateTime = value => {
  if (!value) {
    return ''
  }

  const parts = getShanghaiDateParts(value)
  if (!parts) {
    return ''
  }

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

const formatAmountYuan = amount => Number(amount || 0)

const mapCourseStatus = startTime => {
  if (!startTime) {
    return 0
  }

  return new Date(startTime).getTime() > Date.now() ? 0 : 1
}

const pickFirst = value => (Array.isArray(value) ? value[0] : value)

const parseShanghaiDateTimeInput = value => {
  if (!value) {
    return null
  }

  if (typeof value !== 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const normalized = value.trim().replace('T', ' ')
  if (!normalized) {
    return null
  }

  const timezonePattern = /(Z|[+-]\d{2}:\d{2})$/
  if (timezonePattern.test(normalized)) {
    const date = new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  )

  if (!match) {
    const date = new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`
}

module.exports = {
  normalizeBoolean,
  ok,
  fail,
  getPagination,
  parseShanghaiDateTimeInput,
  formatDateTime,
  formatAmountYuan,
  mapCourseStatus,
  pickFirst
}
