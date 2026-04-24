const { sendFailure, sendOk } = require('./_helpers')
const { isConsoleApiError } = require('../services/_errors')
const { loginAdmin } = require('../services/authService')
const { env } = require('../../config/env')
const {
  assertLoginAllowed,
  clearLoginFailures,
  recordLoginFailure
} = require('../services/loginRateLimiter')

const COOKIE_NAME = 'console_admin_token'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: env.nodeEnv === 'development' ? 'Lax' : 'None',
  secure: env.nodeEnv !== 'development',
  path: '/',
  maxAge: COOKIE_MAX_AGE
}

const login = async (req, res) => {
  const username = req.body && req.body.username
  const password = req.body && req.body.password
  const ip = req.ip || null

  try {
    assertLoginAllowed({ ip, username })

    const data = await loginAdmin({
      username,
      password,
      ip
    })

    res.cookie(COOKIE_NAME, encodeURIComponent(data.token), COOKIE_OPTIONS)
    clearLoginFailures({ ip, username })
    return sendOk(
      res,
      {
        user: data.user
      }
    )
  } catch (error) {
    if (isConsoleApiError(error) && error.responseCode === 1001) {
      const result = recordLoginFailure({ ip, username })
      if (result.limited) {
        return sendFailure(
          res,
          {
            ...error,
            responseCode: 1004,
            statusCode: 429,
            message: '登录尝试过于频繁，请稍后再试',
            extra: {
              retry_after_seconds: Math.max(1, Math.ceil(result.retryAfterMs / 1000))
            },
            code: 'ADMIN_LOGIN_RATE_LIMITED'
          },
          '登录失败'
        )
      }
    }

    return sendFailure(res, error, '登录失败')
  }
}

const logout = async (req, res) => {
  res.cookie(COOKIE_NAME, '', {
    ...COOKIE_OPTIONS,
    maxAge: 0
  })

  return sendOk(res, {})
}

const getSession = async (req, res) => {
  if (!req.admin) {
    return sendFailure(
      res,
      {
        responseCode: 1002,
        statusCode: 401,
        message: 'token无效或过期'
      },
      '获取会话失败'
    )
  }

  return sendOk(res, {
    user: req.admin
  })
}

module.exports = {
  getSession,
  login,
  logout
}
