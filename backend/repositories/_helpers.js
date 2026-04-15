const crypto = require('crypto')

const createNotImplementedError = methodName => {
  const error = new Error(`${methodName} is not implemented`)
  error.code = 'REPOSITORY_NOT_IMPLEMENTED'
  return error
}

const notImplemented = methodName => async () => {
  throw createNotImplementedError(methodName)
}

const toDbDateTime = value => {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString().slice(0, 19).replace('T', ' ')
}

const parseJsonField = value => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'object') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch (error) {
    return null
  }
}

const stringifyJsonField = value => {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  return JSON.stringify(value)
}

const buildInClause = values => {
  const items = [...new Set((values || []).filter(Boolean))]

  return {
    items,
    placeholders: items.map(() => '?').join(', ')
  }
}

const createUuid = () => crypto.randomUUID()

const buildOrderNo = ({ id, createdAt = new Date() }) => {
  const timestamp = toDbDateTime(createdAt) || toDbDateTime(new Date())
  const compact = `${timestamp}`.replace(/[- :]/g, '')
  const suffix = crypto
    .createHash('md5')
    .update(`${id || crypto.randomUUID()}`)
    .digest('hex')
    .slice(0, 6)

  return `LD${compact}${suffix}`.slice(0, 32)
}

module.exports = {
  buildInClause,
  buildOrderNo,
  createUuid,
  createNotImplementedError,
  notImplemented,
  parseJsonField,
  stringifyJsonField,
  toDbDateTime
}
