const { createConsoleApiError } = require('./_errors')

const MAX_FAILURES = Math.max(1, Number(process.env.ADMIN_LOGIN_MAX_FAILURES || 5))
const WINDOW_MS = Math.max(1_000, Number(process.env.ADMIN_LOGIN_WINDOW_MS || 15 * 60 * 1000))
const LOCKOUT_MS = Math.max(1_000, Number(process.env.ADMIN_LOGIN_LOCKOUT_MS || 15 * 60 * 1000))

const attempts = new Map()

const normalizeSegment = value => `${value || ''}`.trim().toLowerCase()

const buildKeys = ({ ip, username }) => {
  const normalizedIp = normalizeSegment(ip) || 'unknown-ip'
  const normalizedUsername = normalizeSegment(username) || 'unknown-user'

  return [
    `ip:${normalizedIp}`,
    `user:${normalizedUsername}`,
    `combo:${normalizedIp}:${normalizedUsername}`
  ]
}

const getRecord = key => {
  const existing = attempts.get(key)
  if (existing) {
    return existing
  }

  const created = {
    failureTimestamps: [],
    lockUntil: 0
  }
  attempts.set(key, created)
  return created
}

const pruneRecord = (record, now) => {
  record.failureTimestamps = record.failureTimestamps.filter(timestamp => now - timestamp <= WINDOW_MS)

  if (record.lockUntil <= now && record.failureTimestamps.length === 0) {
    record.lockUntil = 0
  }
}

const createRateLimitError = retryAfterMs => {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))

  return createConsoleApiError({
    responseCode: 1004,
    statusCode: 429,
    message: '登录尝试过于频繁，请稍后再试',
    extra: {
      retry_after_seconds: retryAfterSeconds
    },
    code: 'ADMIN_LOGIN_RATE_LIMITED'
  })
}

const assertLoginAllowed = ({ ip, username, now = Date.now() }) => {
  for (const key of buildKeys({ ip, username })) {
    const record = getRecord(key)
    pruneRecord(record, now)

    if (record.lockUntil > now) {
      throw createRateLimitError(record.lockUntil - now)
    }
  }
}

const recordLoginFailure = ({ ip, username, now = Date.now() }) => {
  let retryAfterMs = 0

  for (const key of buildKeys({ ip, username })) {
    const record = getRecord(key)
    pruneRecord(record, now)
    record.failureTimestamps.push(now)

    if (record.failureTimestamps.length >= MAX_FAILURES) {
      record.lockUntil = now + LOCKOUT_MS
      record.failureTimestamps = []
      retryAfterMs = Math.max(retryAfterMs, LOCKOUT_MS)
    }
  }

  return {
    limited: retryAfterMs > 0,
    retryAfterMs
  }
}

const clearLoginFailures = ({ ip, username }) => {
  for (const key of buildKeys({ ip, username })) {
    attempts.delete(key)
  }
}

const __unsafeResetForTests = () => {
  attempts.clear()
}

module.exports = {
  assertLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
  __unsafeResetForTests
}
