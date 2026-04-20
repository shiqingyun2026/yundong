const { fail, ok } = require('../routes/_helpers')
const { isConsoleApiError } = require('../services/_errors')

const sendOk = (res, data = {}, message = 'ok') => ok(res, data, message)

const sendFailure = (res, error, fallbackMessage = '操作失败') => {
  if (isConsoleApiError(error)) {
    return fail(res, error.responseCode, error.message, error.statusCode, error.extra || {})
  }

  return fail(res, 5000, error.message || fallbackMessage, 500)
}

const createOkHandler = (fallbackMessage, handler) => async (req, res) => {
  try {
    return sendOk(res, await handler(req, res))
  } catch (error) {
    return sendFailure(res, error, fallbackMessage)
  }
}

module.exports = {
  createOkHandler,
  sendFailure,
  sendOk
}
