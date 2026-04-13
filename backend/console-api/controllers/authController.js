const { sendFailure, sendOk } = require('./_helpers')
const { isConsoleApiError } = require('../services/_errors')
const { loginAdmin } = require('../services/authService')
const {
  assertLoginAllowed,
  clearLoginFailures,
  recordLoginFailure
} = require('../services/loginRateLimiter')

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

    clearLoginFailures({ ip, username })
    return sendOk(res, data)
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

module.exports = {
  login
}
